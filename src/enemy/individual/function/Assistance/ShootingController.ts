import * as THREE from 'three';
import type { PlayerDecision, ShootingDecision } from "../Decision/DecisionTypes";
import type { SensorData } from "../Detector/Sensor";
import type { TurretBehavior } from "../Movement/TurretBehavior";
import type { ShootBehavior } from "../Weapon/ShootBehavior";
import type { Tank } from '../../../../object/tank/Tank';
import type { ResolvedCharacter } from '../../../../enemy/master/function/DecideCharacter';
import type { BattleFieldConfig } from '../../../../scene/battle/BattleField';
import { EnemyMaster } from '../../../master/EnemyMaster';
import { SHELL_STATS } from '../../../../Definition/ShellDefinition';
import type { AI_LEVEL } from '../../../../Definition/AILevel';
import { TARGETING_RELOAD_MULTIPLIER_BY_LEVEL, FAN_CHANCE_BY_LEVEL } from '../../../../Definition/AILevel';
import { OffsetFireHandler } from './OffsetFireHandler';
import type { ShotPattern } from './ShotPattern/ShotPattern';
import { RapidPattern } from './ShotPattern/RapidPattern';
import { FanPattern } from './ShotPattern/FanPattern';
import { CounterPattern } from './ShotPattern/CounterPattern';
import { SniperPattern } from './ShotPattern/SniperPattern';

export const targetingReloadTime = {
    rapid:   0.1,
    fan:     0.7,
    counter: 1.0,
    sniper:  2.0,
} as const;

export class ShootingController {
    private readonly _tankId:           string;
    private readonly _turretBehavior:   TurretBehavior;
    private readonly _shootBehavior:    ShootBehavior;
    /** EnemyMaster の record.character と同一参照。rerandomize* による変更が即座に反映される。 */
    private readonly _character:        ResolvedCharacter;
    private readonly _cellSize:         number;
    private readonly _maxX:             number;
    private readonly _maxZ:             number;
    private readonly _offsetHandler:    OffsetFireHandler;
    private readonly _aiLevel:          AI_LEVEL;
    private readonly _reloadMultiplier: number;
    /** 改善5: シングルトン参照をフィールドに保持（呼び出しごとのプロパティアクセスを排除） */
    private readonly _master:           EnemyMaster;
    private _pattern:                   ShotPattern;

    /** タンク移動判定用：直前フレームの位置（初回フレームは null） */
    private _lastTankPos: THREE.Vector3 | null = null;
    private static readonly MOVING_THRESHOLD_SQ = 1e-4;

    /**
     * 改善・追加: 反射ルート計算キャッシュ。
     * 自・敵の位置が閾値未満しか動いていなければ前フレームの結果を再利用し、
     * 毎フレーム最大5回の重い反射計算を走らせるのを防ぐ。
     */
    private _reflectCache: {
        selfPos:   THREE.Vector3;
        targetPos: THREE.Vector3;
        result:    THREE.Vector3 | null;
    } | null = null;
    private static readonly REFLECT_RECOMPUTE_THRESHOLD_SQ = 0.25; // 0.5 m 未満なら再計算しない

    /** shootingType 再抽選タイマー */
    private _shootingTypeTimer    = 0;
    private _shootingTypeInterval = ShootingController._nextInterval();

    /** shotPattern 再抽選タイマー */
    private _shotPatternTimer    = 0;
    private _shotPatternInterval = ShootingController._nextInterval();

    constructor(
        tankId:         string,
        turretBehavior: TurretBehavior,
        shootBehavior:  ShootBehavior,
        character:      ResolvedCharacter,
        config:         BattleFieldConfig,
        aiLevel:        AI_LEVEL,
    ) {
        this._tankId           = tankId;
        this._turretBehavior   = turretBehavior;
        this._shootBehavior    = shootBehavior;
        this._character        = character;
        this._cellSize         = config.cellSize;
        this._maxX             = config.cols * config.cellSize;
        this._maxZ             = config.rows * config.cellSize;
        this._offsetHandler    = new OffsetFireHandler(turretBehavior, shootBehavior);
        this._aiLevel          = aiLevel;
        this._reloadMultiplier = TARGETING_RELOAD_MULTIPLIER_BY_LEVEL[aiLevel];
        this._master           = EnemyMaster.instance;
        this._pattern          = this._buildPattern(this._resolveFanChance(character.shootingType));
    }

    // ───公開メソッド────────────
    // 砲塔回転から発砲まで
    execute(
        tank:           Tank,
        perception:     SensorData,
        decisionShoot:  ShootingDecision,
        decisionPlayer: PlayerDecision | null,
        playerPos:      THREE.Vector3 | null,
        delta:          number,
    ): void {
        // 0. shootingType / shotPattern を 10〜20 秒ごとに再抽選
        this._tickShootingTypeTimer(delta);
        this._tickShotPatternTimer(delta);

        // 移動判定：前フレームとの位置差分でジャミングのON/OFF切替
        // 改善・追加: 初回のみ clone()。以降は既存オブジェクトに copy() してアロケーションを回避。
        const currPos = tank.movement.position;
        if (this._lastTankPos === null) {
            this._lastTankPos = currPos.clone();
        } else {
            const isMoving = this._lastTankPos.distanceToSquared(currPos) > ShootingController.MOVING_THRESHOLD_SQ;
            this._shootBehavior.setMoving(isMoving);
            this._lastTankPos.copy(currPos);
        }

        // 1. 危険弾を検知 → 相殺射撃（照準リロード無視・3秒クールダウン管理）
        //    クールダウン中はタイマーだけ進めて通常射撃に制御を渡す。
        const dangerShell = perception.zoneOffset[0] ?? null;
        if (decisionShoot.shouldOffset && dangerShell) {
            if (this._offsetHandler.isCooldown) {
                this._offsetHandler.tick(delta);
                // fall through to normal pattern
            } else {
                this._offsetHandler.update(tank, dangerShell, delta);
                return;
            }
        }

        // 2. プレイヤー位置が分かる場合 → aimMode決定 → 射撃パターン発動
        //    Zone_4外（ObservationEquipment経由）でも発砲を試みる。
        //    Zone_4外では directlineClear が壁チェックなし（true扱い）、
        //    facingDirection が null になるが、距離・shotPattern に従い動作する。
        if (playerPos) {
            const playerTank = perception.zonePlayer[0] ?? null;
            const aimMode = this._determineAimMode(tank, playerPos, decisionPlayer, decisionShoot);
            this._pattern.update(tank, playerTank, playerPos, aimMode, decisionShoot, decisionPlayer, delta);
        }
    }

    // ───非公開メソッド────────────

    /**
     * aimMode を決定する。
     * - プレイヤーが縦向き                          → direct
     * - 距離5セル以内                               → direct
     * - shotPattern === 'direct'                    → direct
     * - shotPattern === 'reflect' かつ speed=0        → reflect（CoreBreaker除く）
     * - shotPattern === 'reflect' かつ direct線クリア → direct
     * - 壁あり かつ CoreBreaker/CoreBreaker_Spread  → direct（反射しない）
     * - 壁あり かつ 通常弾                          → reflect
     */
    private _determineAimMode(
        tank:           Tank,
        playerPos:      THREE.Vector3,
        decisionPlayer: PlayerDecision | null,
        decisionShoot:  ShootingDecision,
    ): 'direct' | 'reflect' {
        if (decisionPlayer?.facingDirection === 'vertical') return 'direct';

        const pos = tank.movement.position;
        const dx  = playerPos.x - pos.x;
        const dz  = playerPos.z - pos.z;
        if (dx * dx + dz * dz <= (this._cellSize * 5) ** 2) return 'direct';

        if (this._character.shotPattern !== 'reflect') return 'direct';

        // reflect タイプ：速度0は直撃ルートでも reflect を優先
        if (tank.movement.speed === 0) {
            const bt = tank.shot.bulletType;
            if (bt === 'CoreBreaker' || bt === 'CoreBreaker_Spread') return 'direct';
            return 'reflect';
        }

        // reflect タイプ：まず直撃ルートを確認
        if (decisionShoot.directlineClear) return 'direct';

        // 壁あり：貫通弾は反射しない
        const bt = tank.shot.bulletType;
        if (bt === 'CoreBreaker' || bt === 'CoreBreaker_Spread') return 'direct';

        return 'reflect';
    }

    private _tickShootingTypeTimer(delta: number): void {
        this._shootingTypeTimer += delta;
        if (this._shootingTypeTimer < this._shootingTypeInterval) return;
        this._shootingTypeTimer    = 0;
        this._shootingTypeInterval = ShootingController._nextInterval();
        this._master.rerandomizeShootingType(this._tankId, false);
        // 改善4: fan→rapid 差し替えの責務を _buildPattern から分離
        this._pattern = this._buildPattern(this._resolveFanChance(this._character.shootingType));
    }

    private _tickShotPatternTimer(delta: number): void {
        this._shotPatternTimer += delta;
        if (this._shotPatternTimer < this._shotPatternInterval) return;
        this._shotPatternTimer    = 0;
        this._shotPatternInterval = ShootingController._nextInterval();
        this._master.rerandomizeShotPattern(this._tankId);
    }

    private static _nextInterval(): number {
        return 10 + Math.random() * 10;
    }

    /** 改善4: fan が低確率の場合に rapid へ差し替える（AIレベル依存の抽選）。 */
    private _resolveFanChance(type: ResolvedCharacter['shootingType']): ResolvedCharacter['shootingType'] {
        return (type === 'fan' && Math.random() >= FAN_CHANCE_BY_LEVEL[this._aiLevel]) ? 'rapid' : type;
    }

    private _buildPattern(shootingType: ResolvedCharacter['shootingType']): ShotPattern {
        const searchFn = this._buildSearchFn();
        const { _maxX: maxX, _maxZ: maxZ, _cellSize: cellSize, _reloadMultiplier: rm } = this;
        switch (shootingType) {
            case 'rapid':   return new RapidPattern(this._turretBehavior, this._shootBehavior, searchFn, maxX, maxZ, rm);
            case 'fan':     return new FanPattern(this._turretBehavior, this._shootBehavior, searchFn, maxX, maxZ, cellSize, rm);
            case 'counter': return new CounterPattern(this._turretBehavior, this._shootBehavior, searchFn, cellSize, maxX, maxZ);
            case 'sniper':  return new SniperPattern(this._turretBehavior, this._shootBehavior, searchFn, cellSize);
        }
    }

    private _buildSearchFn(): (tank: Tank, target: THREE.Vector3) => THREE.Vector3 | null {
        return (tank: Tank, target: THREE.Vector3): THREE.Vector3 | null => {
            const rc = tank.info.stats.reflectCount;
            if (rc === 0) return null;  // 反射なし → 呼び出し元が direct にフォールバック

            // 改善・追加: 位置が閾値未満しか変化していなければキャッシュを返す
            const selfPos = tank.movement.position;
            const cache   = this._reflectCache;
            if (cache &&
                cache.selfPos.distanceToSquared(selfPos)  < ShootingController.REFLECT_RECOMPUTE_THRESHOLD_SQ &&
                cache.targetPos.distanceToSquared(target) < ShootingController.REFLECT_RECOMPUTE_THRESHOLD_SQ) {
                return cache.result;
            }

            const result = rc === 1
                ? this._searchSimpleReflect(tank, target)
                : this._searchReflect(tank, target);

            // 位置スナップショットとともにキャッシュ更新（clone は再計算時のみ）
            this._reflectCache = { selfPos: selfPos.clone(), targetPos: target.clone(), result };
            return result;
        };
    }

    // 改善2: _buildSearchFn 側で rc===1 を確認済みのため冗長ガードを削除
    // 簡易反射ルート検索（reflectCount === 1 専用）
    private _searchSimpleReflect(tank: Tank, targetPos: THREE.Vector3): THREE.Vector3 | null {
        const shellRadius = SHELL_STATS[tank.shot.bulletType].radius;
        return this._master.requestSimpleReflect(
            tank.movement.position,
            targetPos,
            shellRadius,
        );
    }

    // 改善3: 多重反射ルート検索（reflectCount >= 2：最大反射回数から降順に試みる）
    private _searchReflect(tank: Tank, targetPos: THREE.Vector3): THREE.Vector3 | null {
        const maxRc = tank.info.stats.reflectCount;
        if (maxRc < 2) return null;
        const shellRadius = SHELL_STATS[tank.shot.bulletType].radius;
        const selfPos = tank.movement.position;

        // maxRc=3 → 3→2→1、maxRc=5 → 5→4→3→2→1 の順に有効ルートを探索
        for (let rc = maxRc; rc >= 1; rc--) {
            const result = rc === 1
                ? this._master.requestSimpleReflect(selfPos, targetPos, shellRadius, maxRc)
                : this._master.requestReflect(selfPos, targetPos, rc, shellRadius, maxRc);
            if (result !== null) return result;
        }
        return null;
    }
}
