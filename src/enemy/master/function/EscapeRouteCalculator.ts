// 緊急脱出ルート計算
/** もらう：タンクの位置
 *  わたす：地雷爆発範囲外への最短ルート（セル）
 */

import * as THREE from 'three';
import type { BattleFieldConfig } from '../../../scene/battle/BattleField';
import { ObservationEquipment } from './ObservationEquipment';
import type { MineObservation } from './ObservationEquipment';
import { type Cell, buildPassableGrid, inBounds, isPointNearMine } from './RouteGridUtils';

export class EscapeRouteCalculator {
    /** 壁のみの通行可否グリッドキャッシュ（壁変更時に null でリセット） */
    private _passableCache: boolean[][] | null = null;

    /** 壁変更時にグリッドキャッシュを無効化する（EnemyMaster から呼ぶ） */
    invalidateGrid(): void {
        this._passableCache = null;
    }

    // ─── メイン計算 ──────────────────────────────────────────

    /**
     * 地雷の爆発範囲から緊急脱出するルートを計算する。
     * タンクの現在位置から最短で地雷の爆発範囲外に出るルートを返す。
     * タンクが既に安全な位置にいる場合は空配列を返す。
     * タンクが地雷範囲内にいる場合も正常に動作する（BFS で範囲外へ最短脱出）。
     */
    calculateMineEscapeRoute(from: THREE.Vector3, config: BattleFieldConfig): Cell[] {
        const { rows, cols, cellSize } = config;

        // 1. 通行可否グリッド取得（BFS は読み取りのみ、コピー不要）
        const passable = this._getBaseGrid(rows, cols, cellSize);

        // 2. 開始セル
        const startCol = Math.floor(from.x / cellSize);
        const startRow = Math.floor(from.z / cellSize);
        if (!inBounds(startCol, startRow, rows, cols)) return [];

        // 3. 地雷観測情報を取得
        const mines = ObservationEquipment.instance.mineObservations;
        if (mines.length === 0) return [];

        // 4. タンクが既に安全な位置にいるなら脱出不要
        if (!isPointNearMine({ col: startCol, row: startRow }, mines, cellSize)) return [];

        // 5. BFS で爆発範囲外の最近傍セルへの最短ルートを探索（安全距離を1マス分延長）
        return this._bfsToSafeCell(passable, rows, cols, cellSize, startCol, startRow, mines, cellSize);
    }

    // ─── BFS 探索 ─────────────────────────────────────────────

    /**
     * BFS で地雷の爆発範囲外の最近傍セルへの最短ルートを返す。
     * 壁を避けながら、最初に到達した安全セルまでの経路を返す（スタートセルは含まない）。
     */
    private _bfsToSafeCell(
        passable: boolean[][],
        rows: number, cols: number,
        cellSize: number,
        startCol: number, startRow: number,
        mines: MineObservation[],
        margin = 0,
    ): Cell[] {
        type BNode = { col: number; row: number; parent: BNode | null };

        const visited = new Set<number>();
        const idx = (c: number, r: number) => r * cols + c;
        const queue: BNode[] = [{ col: startCol, row: startRow, parent: null }];
        visited.add(idx(startCol, startRow));

        const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;

        while (queue.length > 0) {
            const cur = queue.shift()!;

            // 安全なセルに到達したら経路を再構築して返す
            // （スタートセルは unsafe 確認済みのため、ここで safe が見つかるのは隣接以降）
            if (!isPointNearMine({ col: cur.col, row: cur.row }, mines, cellSize, margin)) {
                const path: Cell[] = [];
                let node: BNode | null = cur;
                while (node) {
                    path.unshift({ col: node.col, row: node.row });
                    node = node.parent;
                }
                path.shift(); // スタートセルは現在地なので除外
                return path;
            }

            for (const [dc, dr] of DIRS) {
                const nc = cur.col + dc;
                const nr = cur.row + dr;
                if (!inBounds(nc, nr, rows, cols)) continue;
                if (!passable[nr][nc]) continue;
                if (visited.has(idx(nc, nr))) continue;
                visited.add(idx(nc, nr));
                queue.push({ col: nc, row: nr, parent: cur });
            }
        }

        return []; // 安全なセルへの経路なし
    }

    // ─── グリッド構築 ─────────────────────────────────────────

    private _getBaseGrid(rows: number, cols: number, cellSize: number): boolean[][] {
        if (!this._passableCache) {
            this._passableCache = buildPassableGrid(rows, cols, cellSize);
        }
        return this._passableCache;
    }
}
