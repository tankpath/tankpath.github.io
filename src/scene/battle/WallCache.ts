import * as THREE from 'three';
import type { CubeEntry } from '../../managers/StageObjectManager';

/**
 * wall / break_wall を型で分けず空間的な連続性だけでグルーピングしたエントリ。
 * - box    : 外接 Box（ブロードフェーズ用）
 * - merged : 行走査マージ済み Box 群（精密当たり判定用・継ぎ目なし）
 * - entries: グループ内の全セル（break_wall の破壊対象特定用）
 *            外壁コライダーのような非グリッドセルは entries に含まれない。
 */
export interface UnifiedWallGroup {
    box:     THREE.Box3;
    merged:  readonly THREE.Box3[];
    entries: readonly CubeEntry[];
}

/**
 * 壁当たり判定の集約キャッシュ。
 * wall / break_wall を一括して扱い、連続するセルを矩形マージする。
 * - 外壁コライダー（1 セルより大きい wall 型）はグリッド外として単独グループ化する。
 * - penetrate_wall は shells を通すため別管理（CollisionSystem 側で個別処理）。
 * StageObjectManager.onCubeChanged() で dirty フラグを立て、次フレームで再構築する。
 */
export class WallCache {
    private _wallGroups: UnifiedWallGroup[] = [];

    get wallGroups(): readonly UnifiedWallGroup[] { return this._wallGroups; }

    rebuild(cubes: readonly CubeEntry[]): void {
        this._wallGroups = this._buildUnifiedGroups(cubes);
    }

    // ── 統合グループ構築 ─────────────────────────────────────────────
    private _buildUnifiedGroups(cubes: readonly CubeEntry[]): UnifiedWallGroup[] {
        const result:      UnifiedWallGroup[] = [];
        const unitEntries: CubeEntry[]        = [];
        const tmp     = new THREE.Box3();
        const tmpSize = new THREE.Vector3();

        for (const e of cubes) {
            if (e.cube.info.type === 'penetrate_wall') continue; // shells を通す壁は除外

            e.cube.getBoundingBox(tmp);
            tmp.getSize(tmpSize);

            if (tmpSize.x > 1.01 || tmpSize.z > 1.01) {
                // 外壁コライダー：グリッドマージ対象外。単独グループとして保持。
                const box = tmp.clone();
                result.push({ box, merged: [box], entries: [] });
            } else {
                unitEntries.push(e);
            }
        }

        // グリッドセルを座標キーでマップ化（wall + break_wall 混在）
        const posMap = new Map<string, CubeEntry>();
        for (const e of unitEntries) {
            e.cube.getBoundingBox(tmp);
            const col = Math.round(tmp.min.x);
            const row = Math.round(tmp.min.z);
            posMap.set(`${col},${row}`, e);
        }

        // 4-連結 BFS で連結成分を求める
        const visited = new Set<string>();
        for (const startKey of posMap.keys()) {
            if (visited.has(startKey)) continue;

            const component: CubeEntry[] = [];
            const queue = [startKey];
            visited.add(startKey);

            while (queue.length > 0) {
                const key   = queue.shift()!;
                component.push(posMap.get(key)!);

                const comma = key.indexOf(',');
                const col   = parseInt(key.slice(0, comma), 10);
                const row   = parseInt(key.slice(comma + 1), 10);

                for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
                    const nk = `${col + dc},${row + dr}`;
                    if (posMap.has(nk) && !visited.has(nk)) {
                        visited.add(nk);
                        queue.push(nk);
                    }
                }
            }

            const box = new THREE.Box3().makeEmpty();
            for (const e of component) { e.cube.getBoundingBox(tmp); box.union(tmp); }

            result.push({
                box,
                merged:  this._mergeUnitCells(component),
                entries: component,
            });
        }

        return result;
    }

    // ── 1×1 セル群を行走査で矩形マージ ──────────────────────────────
    private _mergeUnitCells(entries: readonly CubeEntry[]): THREE.Box3[] {
        if (entries.length === 0) return [];

        const rowMap = new Map<number, number[]>();
        const tmp    = new THREE.Box3();

        for (const e of entries) {
            e.cube.getBoundingBox(tmp);
            const col = Math.round(tmp.min.x);
            const row = Math.round(tmp.min.z);
            if (!rowMap.has(row)) rowMap.set(row, []);
            rowMap.get(row)!.push(col);
        }

        const sortedRows = [...rowMap.keys()].sort((a, b) => a - b);
        for (const cols of rowMap.values()) cols.sort((a, b) => a - b);

        const getRuns = (row: number): Array<[number, number]> => {
            const cols = rowMap.get(row)!;
            const runs: Array<[number, number]> = [];
            let start = cols[0], prev = cols[0];
            for (let i = 1; i < cols.length; i++) {
                if (cols[i] !== prev + 1) { runs.push([start, prev]); start = cols[i]; }
                prev = cols[i];
            }
            runs.push([start, prev]);
            return runs;
        };

        const makeBox = (cs: number, rs: number, ce: number, re: number) =>
            new THREE.Box3(
                new THREE.Vector3(cs,     0, rs),
                new THREE.Vector3(ce + 1, 1, re + 1),
            );

        const activeStrips = new Map<string, number>(); // key → rowStart
        const result: THREE.Box3[] = [];
        let prevRow = -Infinity;

        for (const row of sortedRows) {
            const currentRuns = getRuns(row);
            const currentKeys = new Set(currentRuns.map(([s, e]) => `${s},${e}`));

            if (row !== prevRow + 1) {
                for (const [key, rowStart] of activeStrips) {
                    const [cs, ce] = key.split(',').map(Number);
                    result.push(makeBox(cs, rowStart, ce, prevRow));
                }
                activeStrips.clear();
            } else {
                for (const [key, rowStart] of [...activeStrips.entries()]) {
                    if (!currentKeys.has(key)) {
                        const [cs, ce] = key.split(',').map(Number);
                        result.push(makeBox(cs, rowStart, ce, prevRow));
                        activeStrips.delete(key);
                    }
                }
            }

            for (const [cs, ce] of currentRuns) {
                const key = `${cs},${ce}`;
                if (!activeStrips.has(key)) activeStrips.set(key, row);
            }

            prevRow = row;
        }

        for (const [key, rowStart] of activeStrips) {
            const [cs, ce] = key.split(',').map(Number);
            result.push(makeBox(cs, rowStart, ce, prevRow));
        }

        return result;
    }
}
