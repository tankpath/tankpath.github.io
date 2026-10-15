// 砲塔の挙動

import * as THREE from 'three';
import type { Tank } from '../../../../object/tank/Tank';

export class TurretBehavior {
    /**
     * 砲塔を target に向ける。
     * ワールド照準角をローカル角度に変換してから TurretMove.rotateTo に渡す。
     * 角度慣例はプレイヤー（TankDriver）と同じ atan2(-dx, -dz) を使用する。
     */
    aimAt(tank: Tank, target: THREE.Vector3): void {
        const turretPos = tank.turret.worldPosition;
        const dx = target.x - turretPos.x;
        const dz = target.z - turretPos.z;
        if (Math.abs(dx) < 1e-9 && Math.abs(dz) < 1e-9) return;

        // ワールド照準角 → ローカル角度（ボディ角を引く）
        const worldAimAngle = Math.atan2(-dx, -dz);
        const localAngle    = worldAimAngle - tank.movement.rotationY;
        tank.turret.rotateTo(localAngle);
    }

    /**
     * 砲塔が target にほぼ向いているかチェックする。
     * turret.angle はローカル角度（旋回後 = localAim + π/2）のため、
     * ワールド角度に変換してから目標角と比較する。
     *
     * @param tolerance 許容角度誤差（ラジアン、デフォルト 0.2）
     */
    isAligned(tank: Tank, target: THREE.Vector3, tolerance = 0.3): boolean {
        const turretPos = tank.turret.worldPosition;
        const dx = target.x - turretPos.x;
        const dz = target.z - turretPos.z;
        if (Math.abs(dx) < 1e-9 && Math.abs(dz) < 1e-9) return false;

        const worldTargetAngle = Math.atan2(-dx, -dz);
        // turret.angle = localRotation.y = localAim + angleOffset（モデルにより異なる）
        // ワールド角 = (turret.angle - angleOffset) + bodyAngle
        const worldCurrentAngle = tank.turret.angle - tank.turret.angleOffset + tank.movement.rotationY;

        let diff = Math.abs(worldTargetAngle - worldCurrentAngle) % (Math.PI * 2);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        return diff < tolerance;
    }
}
