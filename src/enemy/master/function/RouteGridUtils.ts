// ルートグリッド共有ユーティリティ
/** RouteCalculator と EscapeRouteCalculator が共通で使うグリッド操作・判定関数 */

import { StageObjectManager } from '../../../managers/StageObjectManager';
import type { MineObservation } from './ObservationEquipment';

/** グリッド上のセル位置 */
export interface Cell {
    col: number;
    row: number;
}

/** セルがグリッド範囲内かどうかを判定する */
export function inBounds(col: number, row: number, rows: number, cols: number): boolean {
    return col >= 0 && col < cols && row >= 0 && row < rows;
}

/** StageObjectManager の壁情報から通行可否グリッドを構築する */
export function buildPassableGrid(rows: number, cols: number, cellSize: number): boolean[][] {
    const grid: boolean[][] = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(true));

    for (const { cube } of StageObjectManager.instance.allCubes) {
        if (!cube.info.stats.tankBlocker) continue;
        const col = Math.floor(cube.object.position.x / cellSize);
        const row = Math.floor(cube.object.position.z / cellSize);
        if (inBounds(col, row, rows, cols)) {
            grid[row][col] = false;
        }
    }

    return grid;
}

/** セルが任意の地雷の爆発範囲内にあるか判定する。margin を指定すると安全距離を延長できる */
export function isPointNearMine(point: Cell, mines: MineObservation[], cellSize: number, margin = 0): boolean {
    const cx = point.col * cellSize + cellSize / 2;
    const cz = point.row * cellSize + cellSize / 2;
    for (const { position, explosionRange } of mines) {
        const dx = cx - position.x;
        const dz = cz - position.z;
        const safeRange = explosionRange + margin;
        if (dx * dx + dz * dz <= safeRange * safeRange) return true;
    }
    return false;
}
