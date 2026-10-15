import * as THREE from 'three';
import type { Tank } from '../../../../../object/tank/Tank';
import type { ShootingDecision, PlayerDecision } from '../../Decision/DecisionTypes';
import type { TurretBehavior } from '../../Movement/TurretBehavior';
import type { ShootBehavior } from '../../Weapon/ShootBehavior';
import type { ShotPattern } from './ShotPattern';
import { AimHelper } from './AimHelper';

/** プレイヤー周囲の十字方向オフセット（上・左・右・下の順） */
const CROSS_DIRS = [
    new THREE.Vector3( 0, 0, -1),  // 上
    new THREE.Vector3(-1, 0,  0),  // 左
    new THREE.Vector3( 1, 0,  0),  // 右
    new THREE.Vector3( 0, 0,  1),  // 下
] as const;

/** 反射ルート再計算間隔（秒） */
const REFLECT_RECALC_TIME = 0.5;

/** 発砲後のクールダウン（秒）。playerFired 検出の連続誤検知を防ぐ */
const FIRE_COOLDOWN = 1.0;

/**
 * カウンターパターン：常に照準を保ち、プレイヤーが発砲した瞬間に
 * プレイヤーの周囲十字方向（1セル先）へ即時発砲する。
 * - aimMode === 'direct'  : 直線クリアかつ照準一致で発砲可
 * - aimMode === 'reflect' : 反射ルートを0.5s毎に再計算し、照準一致で発砲可
 */
export class CounterPattern implements ShotPattern {
    private readonly _turret:        TurretBehavior;
    private readonly _shoot:         ShootBehavior;
    private readonly _searchReflect: (tank: Tank, target: THREE.Vector3) => THREE.Vector3 | null;
    private readonly _cellSize:      number;
    private readonly _aim:           AimHelper;

    private _reflectFirePos:         THREE.Vector3 | null = null;
    private _reflectRecalcTimer:     number              = 0;
    private _fireCooldown:           number              = 0;
    private readonly _crossTargetCache: THREE.Vector3    = new THREE.Vector3();
    private readonly _dirCache:         THREE.Vector3    = new THREE.Vector3();

    constructor(
        turretBehavior: TurretBehavior,
        shoot:          ShootBehavior,
        searchReflect:  (tank: Tank, target: THREE.Vector3) => THREE.Vector3 | null,
        cellSize:       number,
        maxX:           number,
        maxZ:           number,
    ) {
        this._turret        = turretBehavior;
        this._shoot         = shoot;
        this._searchReflect = searchReflect;
        this._cellSize      = cellSize;
        this._aim           = new AimHelper(turretBehavior, maxX, maxZ);
    }

    update(
        tank:           Tank,
        _playerTank:    Tank | null,
        target:         THREE.Vector3,
        aimMode:        'direct' | 'reflect',
        decisionShoot:  ShootingDecision,
        playerDecision: PlayerDecision | null,
        delta:          number,
    ): void {
        this._fireCooldown = Math.max(0, this._fireCooldown - delta);

        const lead = this._aim.leadTarget(tank, target, delta);

        // ─── 照準維持 ──────────────────────────────────────────
        let aimTarget: THREE.Vector3 | null = null;

        if (aimMode === 'direct') {
            if (!decisionShoot.directlineClear) {
                this._aim.aimAt(tank, lead);
                return;
            }
            this._aim.aimAt(tank, lead);
            if (this._turret.isAligned(tank, lead)) {
                aimTarget = lead;
            }
        } else {
            // 反射ルートを定期的に再計算しつつ、常にルート方向へ照準を向ける
            this._reflectRecalcTimer = Math.max(0, this._reflectRecalcTimer - delta);
            if (this._reflectRecalcTimer <= 0) {
                const found = this._searchReflect(tank, lead);
                if (found) this._reflectFirePos = found;
                this._reflectRecalcTimer = REFLECT_RECALC_TIME;
            }

            if (!this._reflectFirePos) {
                this._aim.aimAt(tank, lead);
                return;
            }
            this._aim.aimAt(tank, this._reflectFirePos);
            if (this._turret.isAligned(tank, this._reflectFirePos)) {
                aimTarget = this._reflectFirePos;
            }
        }

        // ─── 発砲条件チェック ──────────────────────────────────
        if (!aimTarget) return;                         // 照準未一致
        if (!playerDecision?.playerFired) return;       // プレイヤー未発砲
        if (this._fireCooldown > 0) return;             // クールダウン中

        this._fireCooldown = FIRE_COOLDOWN;

        // プレイヤーの周囲十字4方向へ発砲（上・左・右・下の順）
        // 各 crossTarget との間に wall/break_wall がある場合は発砲しない
        const muzzlePos = tank.turret.muzzleWorldPosition;
        for (const offset of CROSS_DIRS) {
            this._crossTargetCache.set(
                lead.x + offset.x * this._cellSize,
                lead.y,
                lead.z + offset.z * this._cellSize,
            );
            if (this._aim.isLeadObstructed(tank, this._crossTargetCache)) continue;
            this._dirCache.set(
                this._crossTargetCache.x - muzzlePos.x,
                0,
                this._crossTargetCache.z - muzzlePos.z,
            ).normalize();
            this._shoot.shootInDirection(tank, this._dirCache);
        }
    }
}
