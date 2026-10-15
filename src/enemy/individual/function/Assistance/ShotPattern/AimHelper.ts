import * as THREE from 'three';
import type { Tank } from '../../../../../object/tank/Tank';
import type { TurretBehavior } from '../../Movement/TurretBehavior';
import { SHELL_STATS, SPEED_RULE } from '../../../../../Definition/ShellDefinition';
import { ShootingCondition } from '../../../../../Definition/PrerequisiteAI';

/** SniperPattern と同値 */
const SPEED_MULTIPLIER = 7;

/** 静止とみなす速度閾値（units/s の二乗） */
const STATIONARY_THRESHOLD_SQ = 0.5;

/**
 * 照準・照準リロードタイマーの共通ロジック。
 * directAim / reflectAim それぞれ独立したタイマーを持つ。
 */
export class AimHelper {
    private readonly _turret:           TurretBehavior;
    private readonly _maxX:             number;
    private readonly _maxZ:             number;
    private readonly _reloadMultiplier: number;
    private _directTimer:               number               = 0;
    private _reflectTimer:              number               = 0;
    private _lastTargetPos:             THREE.Vector3 | null = null;
    private _targetVelocity:            THREE.Vector3        = new THREE.Vector3();
    private _prevMoving:                boolean              = false;
    private _useLeadForSequence:        boolean              = false;
    private readonly _leadCache:        THREE.Vector3        = new THREE.Vector3();

    constructor(turret: TurretBehavior, maxX: number, maxZ: number, reloadMultiplier = 1.0) {
        this._turret           = turret;
        this._maxX             = maxX;
        this._maxZ             = maxZ;
        this._reloadMultiplier = reloadMultiplier;
    }

    /**
     * プレイヤー速度を更新し、弾の到達時間を考慮したリード補正済みの目標位置を返す。
     * - 静止中は補正なし。
     * - 移動開始時にランダムで補正の有無を決定し、移動中は同じ判定を維持する。
     * - 補正後の座標がステージ外になる場合は補正なしで返す。
     * 毎フレーム呼び出すこと。
     */
    leadTarget(tank: Tank, target: THREE.Vector3, delta: number): THREE.Vector3 {
        if (this._lastTargetPos) {
            this._targetVelocity.set(
                (target.x - this._lastTargetPos.x) / delta,
                0,
                (target.z - this._lastTargetPos.z) / delta,
            );
        }
        if (!this._lastTargetPos) this._lastTargetPos = new THREE.Vector3();
        this._lastTargetPos.copy(target);

        const nowMoving = this._targetVelocity.lengthSq() >= STATIONARY_THRESHOLD_SQ;

        // 静止→移動の遷移タイミングでランダムに補正適用を決める
        if (nowMoving && !this._prevMoving) {
            this._useLeadForSequence = Math.random() < 0.5;
        }
        this._prevMoving = nowMoving;

        if (!nowMoving || !this._useLeadForSequence) return target;

        const tankPos   = tank.movement.position;
        const dist      = Math.sqrt((target.x - tankPos.x) ** 2 + (target.z - tankPos.z) ** 2);
        const speed     = SPEED_RULE[SHELL_STATS[tank.shot.bulletType].speed] * SPEED_MULTIPLIER;
        const timeToHit = dist / speed;

        const lead = this._leadCache.set(
            target.x + this._targetVelocity.x * timeToHit,
            target.y,
            target.z + this._targetVelocity.z * timeToHit,
        );

        // ステージ外に飛び出す場合は補正しない
        if (lead.x < 0 || lead.x > this._maxX || lead.z < 0 || lead.z > this._maxZ) {
            return target;
        }

        return lead;
    }

    /**
     * 直撃照準。照準リロードタイマーが切れていて、かつ砲塔が合っていれば true を返す。
     * 合っていればタイマーをリセットする。
     */
    directAim(tank: Tank, target: THREE.Vector3, delta: number, reloadTime: number): boolean {
        this._directTimer = Math.max(0, this._directTimer - delta);
        if (this._directTimer > 0) return false;

        this._turret.aimAt(tank, target);
        if (!this._turret.isAligned(tank, target)) return false;

        this._directTimer = reloadTime * this._reloadMultiplier;
        return true;
    }

    /**
     * 反射照準。照準リロードタイマーが切れていて、反射計算が成功し、かつ砲塔が合っていれば
     * 発砲目標位置を返す。それ以外は null を返す。
     */
    reflectAim(
        tank:       Tank,
        target:     THREE.Vector3,
        delta:      number,
        reloadTime: number,
        searchFn:   (tank: Tank, target: THREE.Vector3) => THREE.Vector3 | null,
    ): THREE.Vector3 | null {
        this._reflectTimer = Math.max(0, this._reflectTimer - delta);
        if (this._reflectTimer > 0) return null;

        const firePos = searchFn(tank, target);
        if (!firePos) return null;

        this._turret.aimAt(tank, firePos);
        if (!this._turret.isAligned(tank, firePos)) return null;

        this._reflectTimer = reloadTime * this._reloadMultiplier;
        return firePos;
    }

    /** 照準のみ（発砲なし） */
    aimAt(tank: Tank, target: THREE.Vector3): void {
        this._turret.aimAt(tank, target);
    }

    /**
     * タンク→leadPos 間に wall/break_wall が存在するか判定する。
     * direct モードの発砲前チェックに使用する（reflect は壁への命中が意図的なため対象外）。
     */
    isLeadObstructed(tank: Tank, leadPos: THREE.Vector3): boolean {
        const { hasWallBetween, hasBreakableWallBetween } = ShootingCondition.scanObstaclesToPos(tank, leadPos);
        return !ShootingCondition.isDirectLineClear(hasWallBetween, hasBreakableWallBetween, ShootingCondition.allowBreakWallShot(tank));
    }
}
