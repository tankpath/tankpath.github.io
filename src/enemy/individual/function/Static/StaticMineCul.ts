import type { Tank } from '../../../../object/tank/Tank';
import { MINE_STATS } from '../../../../Definition/MineDefinition';
import { StageObjectManager } from '../../../../managers/StageObjectManager';

export class StaticMineCul {

    /** 自タンクが設置した地雷のうち最近傍のものとの距離の二乗を返す。地雷がなければ Infinity */
    static distSqToNearestMine(tank: Tank): number {
        const pos = tank.movement.position;
        let minDistSq = Infinity;
        for (const m of StageObjectManager.instance.allMines) {
            if (m.ownerTankId !== tank.info.id) continue;
            const mp = m.mine.object.position;
            const dx = mp.x - pos.x;
            const dz = mp.z - pos.z;
            const dSq = dx * dx + dz * dz;
            if (dSq < minDistSq) minDistSq = dSq;
        }
        return minDistSq;
    }

    /** 自タンクの地雷タイプの爆発範囲（ワールド単位）を返す */
    static nearestMineExplodeRange(tank: Tank, cellSize: number): number {
        return MINE_STATS[tank.minePlacer.mineType].explosionRange * cellSize;
    }

    /** タンクの前後左右の隣接セルに壁があるかを確認する */
    static checkPassage(tank: Tank, cellSize: number): {
        forwardClear:  boolean;
        backwardClear: boolean;
        leftWall:      boolean;
        rightWall:     boolean;
    } {
        const pos  = tank.movement.position;
        const rotY = tank.movement.rotationY;
        const fwdX = Math.sin(rotY), fwdZ = Math.cos(rotY);
        const rgtX = Math.cos(rotY), rgtZ = -Math.sin(rotY);

        const hasWallAt = (cx: number, cz: number): boolean => {
            const threshold = cellSize * 0.5;
            for (const { cube } of StageObjectManager.instance.allCubes) {
                if (cube.info.type !== 'wall' && cube.info.type !== 'break_wall') continue;
                const cp = cube.object.position;
                const dx = cp.x - cx, dz = cp.z - cz;
                if (dx * dx + dz * dz < threshold * threshold) return true;
            }
            return false;
        };

        /** 指定方向に 1〜3 マスの範囲内で壁があるか（1〜3マス幅通路に対応） */
        const hasWallInRange = (dx: number, dz: number): boolean => {
            for (let n = 1; n <= 3; n++) {
                if (hasWallAt(pos.x + dx * n * cellSize, pos.z + dz * n * cellSize)) return true;
            }
            return false;
        };

        return {
            forwardClear:  !hasWallAt(pos.x + fwdX * cellSize, pos.z + fwdZ * cellSize),
            backwardClear: !hasWallAt(pos.x - fwdX * cellSize, pos.z - fwdZ * cellSize),
            leftWall:      hasWallInRange(-rgtX, -rgtZ),
            rightWall:     hasWallInRange( rgtX,  rgtZ),
        };
    }
}
