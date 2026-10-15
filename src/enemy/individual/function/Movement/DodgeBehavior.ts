// 回避の制御

import * as THREE from 'three';
import type { Tank } from '../../../../object/tank/Tank';
import type { Shell } from '../../../../object/tank_object/shell/Shell';
import { StageObjectManager } from '../../../../managers/StageObjectManager';

export class DodgeBehavior {

    /** 壁チェックの前方探索距離（セル）: 隣接マス（中心間1ユニット）まで */
    private static readonly WALL_CHECK_DISTANCE = 1.0;
    /** タンク半幅(0.35) + キューブ半幅(0.5) */
    private static readonly PERP_THRESHOLD = 0.85;

    private readonly _dir = new THREE.Vector3();

    constructor() {}
    /**
     * 弾進行方向の垂直方向へ移動して回避する。
     * 垂直方向（弾の進行方向90度）のみで回避する。
     * 両側とも壁の場合は弾の来た方向へ後退する。
     */
    execute(tank: Tank, dangerShell: Shell, delta: number): void {
        const dir = dangerShell.motion.direction;
        const sx  = dir.x;
        const sz  = dir.z;

        // 垂直方向（弾の進行方向を 90 度回転）
        const perpX = -sz;
        const perpZ =  sx;

        // 後退方向（弾の来た方向の逆、両側壁ブロック時のみ使用）
        const backX = -sx;
        const backZ = -sz;

        // タンクが弾の左右どちら側にいるかで回避方向を決める
        const toTankX = tank.movement.position.x - dangerShell.object.position.x;
        const toTankZ = tank.movement.position.z - dangerShell.object.position.z;
        let side      = (toTankX * perpX + toTankZ * perpZ) >= 0 ? 1 : -1;

        let dodgeX = perpX * side;
        let dodgeZ = perpZ * side;
        const perpLen = Math.sqrt(dodgeX * dodgeX + dodgeZ * dodgeZ);
        if (perpLen < 1e-9) return;

        const primaryNdx =  dodgeX / perpLen;
        const primaryNdz =  dodgeZ / perpLen;

        const primaryBlocked   = DodgeBehavior.hasWallInDirection(tank.movement.position,  primaryNdx,  primaryNdz);
        const secondaryBlocked = DodgeBehavior.hasWallInDirection(tank.movement.position, -primaryNdx, -primaryNdz);

        let finalX: number;
        let finalZ: number;

        if (primaryBlocked && secondaryBlocked) {
            // 両側とも壁：弾の来た方向へ後退
            const bLen = Math.sqrt(backX * backX + backZ * backZ);
            if (bLen < 1e-9) return;
            finalX = backX / bLen;
            finalZ = backZ / bLen;
        } else {
            // 主方向が塞がれていれば逆側へ
            if (primaryBlocked) {
                side   = -side;
                dodgeX = perpX * side;
                dodgeZ = perpZ * side;
            }

            // 垂直のみの回避
            const cl = Math.sqrt(dodgeX * dodgeX + dodgeZ * dodgeZ);
            if (cl < 1e-9) return;
            finalX = dodgeX / cl;
            finalZ = dodgeZ / cl;
        }

        this._dir.set(finalX, 0, finalZ);
        tank.movement.setRotation(Math.atan2(this._dir.x, this._dir.z));
        tank.movement.move(this._dir, delta);
    }

    /**
     * 指定方向（正規化済み XZ）の前方 WALL_CHECK_DISTANCE セル以内に
     * tankBlocker なキューブがあるか判定する。
     */
    private static hasWallInDirection(
        pos: THREE.Vector3,
        ndx: number,
        ndz: number,
    ): boolean {
        const LOOK   = DodgeBehavior.WALL_CHECK_DISTANCE;
        const PERP_T = DodgeBehavior.PERP_THRESHOLD;

        for (const { cube } of StageObjectManager.instance.allCubes) {
            if (!cube.info.stats.tankBlocker) continue;

            const cp  = cube.object.position;
            const dx  = cp.x - pos.x;
            const dz  = cp.z - pos.z;

            // 前方成分
            const fwd = dx * ndx + dz * ndz;
            if (fwd < 0 || fwd > LOOK) continue;

            // 垂直成分
            const perpX = dx - fwd * ndx;
            const perpZ = dz - fwd * ndz;
            if (Math.sqrt(perpX * perpX + perpZ * perpZ) < PERP_T) return true;
        }
        return false;
    }
}
