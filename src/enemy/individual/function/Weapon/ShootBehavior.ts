// 発砲の制御

import * as THREE from 'three';
import type { Tank } from '../../../../object/tank/Tank';
import type { TurretBehavior } from '../Movement/TurretBehavior';
import type { AI_LEVEL } from '../../../../Definition/AILevel';
import { AIM_JITTER_BY_LEVEL } from '../../../../Definition/AILevel';

export class ShootBehavior {
    private readonly _turretBehavior: TurretBehavior;
    private readonly _aimJitter: number;
    /** 直前フレームにタンクが移動中かどうか（ShootingController から毎フレーム更新） */
    private _isMoving = true;

    constructor(turretBehavior: TurretBehavior, aiLevel: AI_LEVEL) {
        this._turretBehavior = turretBehavior;
        this._aimJitter      = AIM_JITTER_BY_LEVEL[aiLevel];
    }

    private readonly _dir = new THREE.Vector3();

    /** 毎フレーム ShootingController から呼ぶ。停止中はジャミングを無効化するために使用 */
    setMoving(isMoving: boolean): void {
        this._isMoving = isMoving;
    }

    /**
     * 砲塔が target に向いていれば発砲する。
     * @param tank   制御対象タンク
     * @param target 照準先ワールド座標
     */
    /**
     * 方向を直接指定して発砲する。砲塔の向きに関係なく指定方向へ発射。
     * 連射など角度オフセットが必要な場合に使用。
     */
    shootInDirection(tank: Tank, direction: THREE.Vector3): void {
        if (!tank.shot.canShoot()) return;
        tank.shot.shoot(tank.turret.muzzleWorldPosition, direction.normalize());
    }

    /**
     * リロードタイマーを無視して指定方向へ発砲する。在弾数上限のみチェック。
     * 連射パターンの発射シーケンス専用。
     * @returns 発砲に成功した場合 true、在弾数が上限に達していた場合 false
     */
    shootInDirectionIgnoreReload(tank: Tank, direction: THREE.Vector3): boolean {
        return tank.shot.shootIgnoreReload(tank.turret.muzzleWorldPosition, direction.normalize()) !== null;
    }

    tryShoot(tank: Tank, target: THREE.Vector3): void {
        if (!tank.shot.canShoot()) return;
        if (!this._turretBehavior.isAligned(tank, target)) return;

        // MuzzlePoint ノードがあればその位置、なければ砲塔中心を使用
        const muzzlePos = tank.turret.muzzleWorldPosition;
        const dx = target.x - muzzlePos.x;
        const dz = target.z - muzzlePos.z;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len < 1e-9) return;

        if (this._aimJitter > 0 && this._isMoving) {
            // 照準ジャミング：発射方向にランダムな偏角を加える
            const baseAngle  = Math.atan2(dx, dz);
            const jitter     = (Math.random() * 2 - 1) * this._aimJitter;
            const finalAngle = baseAngle + jitter;
            this._dir.set(Math.sin(finalAngle), 0, Math.cos(finalAngle));
        } else {
            this._dir.set(dx / len, 0, dz / len);
        }
        tank.shot.shoot(muzzlePos, this._dir);
    }
}
