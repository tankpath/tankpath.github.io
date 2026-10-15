import * as THREE from 'three';
import type { Tank } from '../../../../../object/tank/Tank';
import type { ShootingDecision, PlayerDecision } from '../../Decision/DecisionTypes';
import type { TurretBehavior } from '../../Movement/TurretBehavior';
import type { ShootBehavior } from '../../Weapon/ShootBehavior';
import type { ShotPattern } from './ShotPattern';
import { SHELL_STATS, SPEED_RULE } from '../../../../../Definition/ShellDefinition';
import { ShootingCondition } from '../../../../../Definition/PrerequisiteAI';

/** SPEED_RULE の基準値に掛ける倍率（UniformLinearMotion と同値） */
const SPEED_MULTIPLIER = 7;

/** 自タンク移動判定しきい値（フレーム間距離の二乗） */
const TANK_MOVING_THRESHOLD_SQ = 0.001;

/** 反射照準の再計算間隔（秒） */
const REFLECT_RECALC_TIME = 0.5;

/**
 * 狙撃パターン：
 * - 自タンク静止時：反射計算で照準を固定（近傍2セル以内なら再計算しない）、照準一致で即発砲
 * - 自タンク移動時：プレイヤー運動方向・弾速から到達時間を推定してリード補正。
 *                   反射の場合は0.5秒に1回再計算。
 */
export class SniperPattern implements ShotPattern {
    private readonly _turret:        TurretBehavior;
    private readonly _shoot:         ShootBehavior;
    private readonly _searchReflect: (tank: Tank, target: THREE.Vector3) => THREE.Vector3 | null;
    private readonly _cellSize:      number;

    private _lastPlayerPos:    THREE.Vector3 | null = null;
    private _playerVelocity:   THREE.Vector3        = new THREE.Vector3();
    private _lastTankPos:      THREE.Vector3 | null = null;
    private _lockedAimPos:     THREE.Vector3 | null = null;
    private _lockPlayerPos:    THREE.Vector3 | null = null;
    private _reflectCalcTimer: number               = 0;
    private _wasTankMoving:    boolean              = false;
    private readonly _leadCache: THREE.Vector3      = new THREE.Vector3();

    constructor(
        turret:        TurretBehavior,
        shoot:         ShootBehavior,
        searchReflect: (tank: Tank, target: THREE.Vector3) => THREE.Vector3 | null,
        cellSize:      number,
    ) {
        this._turret        = turret;
        this._shoot         = shoot;
        this._searchReflect = searchReflect;
        this._cellSize      = cellSize;
    }

    update(
        tank:            Tank,
        _playerTank:     Tank | null,
        target:          THREE.Vector3,
        aimMode:         'direct' | 'reflect',
        decisionShoot:   ShootingDecision,
        _playerDecision: PlayerDecision | null,
        delta:           number,
    ): void {
        // プレイヤー速度を更新（リード補正用）
        if (this._lastPlayerPos) {
            this._playerVelocity.set(
                (target.x - this._lastPlayerPos.x) / delta,
                0,
                (target.z - this._lastPlayerPos.z) / delta,
            );
        }
        if (!this._lastPlayerPos) this._lastPlayerPos = new THREE.Vector3();
        this._lastPlayerPos.copy(target);

        // 自タンクの移動を検出
        const currentTankPos  = tank.movement.position;
        const isTankMoving    = this._lastTankPos
            ? this._lastTankPos.distanceToSquared(currentTankPos) > TANK_MOVING_THRESHOLD_SQ
            : false;
        if (!this._lastTankPos) this._lastTankPos = new THREE.Vector3();
        this._lastTankPos.copy(currentTankPos);

        // ステート遷移時の初期化
        if (isTankMoving && !this._wasTankMoving) {
            this._lockedAimPos     = null;
            this._lockPlayerPos    = null;
            this._reflectCalcTimer = 0;
        }
        if (!isTankMoving && this._wasTankMoving) {
            this._reflectCalcTimer = 0;
        }
        this._wasTankMoving = isTankMoving;

        if (!isTankMoving) {
            this._handleStationary(tank, target, aimMode, decisionShoot.directlineClear);
        } else {
            this._handleMoving(tank, target, aimMode, decisionShoot.directlineClear, delta);
        }
    }

    // ─── 静止時 ───────────────────────────────────────────────────────

    private _handleStationary(tank: Tank, target: THREE.Vector3, aimMode: 'direct' | 'reflect', directlineClear: boolean): void {
        if (aimMode === 'direct') {
            if (!directlineClear) {
                this._turret.aimAt(tank, target);
                return;
            }
            this._turret.aimAt(tank, target);
            if (this._turret.isAligned(tank, target)) {
                this._shoot.tryShoot(tank, target);
            }
            return;
        }

        // 反射：近傍2セル以内なら照準をロック保持、外れたら再計算
        const twoCell = this._cellSize * 2;
        const needsRecalc = !this._lockedAimPos
            || !this._lockPlayerPos
            || this._lockPlayerPos.distanceToSquared(target) > twoCell * twoCell;

        if (needsRecalc) {
            const firePos = this._searchReflect(tank, target);
            if (firePos) {
                this._lockedAimPos  = firePos;
                if (!this._lockPlayerPos) this._lockPlayerPos = new THREE.Vector3();
                this._lockPlayerPos.copy(target);
            }
        }

        if (!this._lockedAimPos) {
            // 反射ルートが見つからない場合はプレイヤー方向へ照準のみ維持（発砲しない）
            this._turret.aimAt(tank, target);
            return;
        }

        this._turret.aimAt(tank, this._lockedAimPos);
        if (this._turret.isAligned(tank, this._lockedAimPos)) {
            this._shoot.tryShoot(tank, this._lockedAimPos);
        }
    }

    // ─── 移動時 ───────────────────────────────────────────────────────

    private _handleMoving(tank: Tank, target: THREE.Vector3, aimMode: 'direct' | 'reflect', directlineClear: boolean, delta: number): void {
        const leadTarget = this._calcLeadTarget(tank, target);

        if (aimMode === 'direct') {
            if (!directlineClear) {
                this._turret.aimAt(tank, leadTarget);
                return;
            }
            this._turret.aimAt(tank, leadTarget);
            if (this._turret.isAligned(tank, leadTarget)) {
                const { hasWallBetween, hasBreakableWallBetween } = ShootingCondition.scanObstaclesToPos(tank, leadTarget);
                if (ShootingCondition.isDirectLineClear(hasWallBetween, hasBreakableWallBetween, ShootingCondition.allowBreakWallShot(tank))) {
                    this._shoot.tryShoot(tank, leadTarget);
                }
            }
            return;
        }

        // 反射：0.5秒ごとに再計算
        this._reflectCalcTimer = Math.max(0, this._reflectCalcTimer - delta);
        if (this._reflectCalcTimer <= 0) {
            const firePos = this._searchReflect(tank, leadTarget);
            if (firePos) this._lockedAimPos = firePos;
            this._reflectCalcTimer = REFLECT_RECALC_TIME;
        }

        if (!this._lockedAimPos) {
            // 反射ルートが未確立の場合はリード先へ照準のみ維持（発砲しない）
            this._turret.aimAt(tank, leadTarget);
            return;
        }

        this._turret.aimAt(tank, this._lockedAimPos);
        if (this._turret.isAligned(tank, this._lockedAimPos)) {
            this._shoot.tryShoot(tank, this._lockedAimPos);
        }
    }

    // ─── ユーティリティ ──────────────────────────────────────────────

    private _calcLeadTarget(tank: Tank, target: THREE.Vector3): THREE.Vector3 {
        const tankPos     = tank.movement.position;
        const dist        = Math.sqrt((target.x - tankPos.x) ** 2 + (target.z - tankPos.z) ** 2);
        const bulletSpeed = this._getBulletSpeed(tank);
        const timeToHit   = dist / bulletSpeed;

        return this._leadCache.set(
            target.x + this._playerVelocity.x * timeToHit,
            target.y,
            target.z + this._playerVelocity.z * timeToHit,
        );
    }

    private _getBulletSpeed(tank: Tank): number {
        const gear = SHELL_STATS[tank.shot.bulletType].speed;
        return SPEED_RULE[gear] * SPEED_MULTIPLIER;
    }
}
