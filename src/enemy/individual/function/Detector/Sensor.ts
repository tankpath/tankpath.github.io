/** センサー
 * 　弾：Zone_1（セル1.5半径）、Zone_2（セル4半径）
 * 　地雷：Zone_3（各地雷の爆発範囲 + セル1.5の円）
 * 　危険弾を検知し、それを知らせる
 * 　地雷を検知し、それをしらせる
 */

import type { Shell } from '../../../../object/tank_object/shell/Shell';
import type { Mine } from '../../../../object/tank_object/mine/Mine';
import type { Tank } from '../../../../object/tank/Tank';
import { StageObjectManager } from '../../../../managers/StageObjectManager';

export interface SensorData {
    /** 近距離危険弾（Zone_1：セル半径1.5以内、自機へ向かっているもの） */
    zoneOffset: Shell[];
    /** 中距離危険弾（Zone_2：セル半径4以内、自機へ向かっているもの） */
    zoneAvoid: Shell[];
    /** 前方の地雷（Zone_3：各地雷の爆発範囲 + セル1.5の円） */
    frontMines: Mine[];
    /** いずれかの地雷の爆発範囲内に自機がいるか */
    inMineExplosionRange: boolean;
    /** 接触している他の敵タンク一覧 */
    touchingEnemyTanks: Tank[];
    /** 前後の敵（Zone_4：前後方10セル × 幅5セルの矩形内）。タンクに近い順 */
    zonePlayer: Tank[];
}

export class Sensor {
    private readonly _ownerId: string;
    private readonly _cellSize: number;

    constructor(ownerId: string, cellSize: number) {
        this._ownerId = ownerId;
        this._cellSize = cellSize;
    }

    detect(tank: Tank): SensorData {
        const pos   = tank.movement.position;
        const r1sq  = (this._cellSize * 1.5) ** 2;
        const r2sq  = (this._cellSize * 4.0) ** 2;

        const zoneOffset: Shell[] = [];
        const zoneAvoid: Shell[] = [];

        for (const entry of StageObjectManager.instance.allBullets) {
            if (entry.ownerTankId === this._ownerId) continue;

            const sp = entry.shell.object.position;
            const dx = sp.x - pos.x;
            const dz = sp.z - pos.z;
            const distSq = dx * dx + dz * dz;

            if (distSq > r2sq) continue;

            // 自機へ向かっているか（水平内積チェック）
            const dir    = entry.shell.motion.direction;
            const len    = Math.sqrt(distSq);
            const toMeX  = -dx / len;
            const toMeZ  = -dz / len;
            const dirLen = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
            const hDirX  = dir.x / dirLen;
            const hDirZ  = dir.z / dirLen;

            // 直接内積の値を入力（45度）
            const threshold = 0.672;
            if (hDirX * toMeX + hDirZ * toMeZ < threshold) continue;

            if (distSq <= r1sq) {
                zoneOffset.push(entry.shell);
            } else {
                zoneAvoid.push(entry.shell);
            }
        }

        // 地雷検知（mineDetection を持つタンクのみ）
        const frontMines: Mine[] = [];
        let inMineExplosionRange = false;
        if (tank.minePlacer.canDetect) {
            for (const entry of StageObjectManager.instance.allMines) {
                const mine = entry.mine;
                const mp = mine.object.position;
                const rx = mp.x - pos.x;
                const rz = mp.z - pos.z;
                const distSq = rx * rx + rz * rz;
                const explosionRange = mine.info.stats.explosionRange;
                if (distSq <= explosionRange * explosionRange) inMineExplosionRange = true;
                const detectionRange = explosionRange + this._cellSize * 1.5;
                if (distSq > detectionRange * detectionRange) continue;
                frontMines.push(mine);
            }
        }

        // 他の敵タンクとの接触判定
        const selfBox = tank.getBoundingBox();
        const touchingEnemyTanks = StageObjectManager.instance.allTanks.filter(
            t => !t.info.isPlayer && t.info.id !== this._ownerId && t.isAlive && selfBox.intersectsBox(t.getBoundingBox())
        );

        // プレイヤー検知（Zone_4：前後方10セル × 幅5セルの矩形内）
        const rotY = tank.movement.rotationY;
        const fwdX =  Math.sin(rotY);
        const fwdZ =  Math.cos(rotY);
        // 右方向 = 前方を時計回り90°回転（XZ平面）
        const rgtX =  Math.cos(rotY);
        const rgtZ = -Math.sin(rotY);

        const depthMax  = this._cellSize * 5;
        const halfWidth = this._cellSize * 2.5;

        const zonePlayer: Tank[] = [];
        for (const t of StageObjectManager.instance.allTanks) {
            if (!t.info.isPlayer || !t.isAlive) continue;
            const pp     = t.movement.position;
            const dx     = pp.x - pos.x;
            const dz     = pp.z - pos.z;
            const fwdDot = dx * fwdX + dz * fwdZ;
            const rgtDot = dx * rgtX + dz * rgtZ;
            if (Math.abs(fwdDot) <= depthMax && Math.abs(rgtDot) <= halfWidth) {
                zonePlayer.push(t);
            }
        }
        zonePlayer.sort((a, b) => {
            const ap = a.movement.position;
            const bp = b.movement.position;
            const adx = ap.x - pos.x, adz = ap.z - pos.z;
            const bdx = bp.x - pos.x, bdz = bp.z - pos.z;
            return (adx * adx + adz * adz) - (bdx * bdx + bdz * bdz);
        });

        return { zoneOffset, zoneAvoid, frontMines, inMineExplosionRange, touchingEnemyTanks, zonePlayer };
    }
}
