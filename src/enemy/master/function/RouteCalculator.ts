// ルート計算
/** もらう：タンクの位置、性格
 *  わたす：ルート（セル）
 */

import * as THREE from 'three';
import type { BattleFieldConfig } from '../../../scene/battle/BattleField';
import type { ResolvedCharacter, DistancePref } from './DecideCharacter';
import { StageObjectManager } from '../../../managers/StageObjectManager';
import { ObservationEquipment } from './ObservationEquipment';
import { type Cell, buildPassableGrid, inBounds, isPointNearMine } from './RouteGridUtils';

export type { Cell } from './RouteGridUtils';

/** A* 内部ノード */
interface ANode {
    col: number;
    row: number;
    g: number;
    f: number;
    parent: ANode | null;
}

/** 壁隣接セルへ加算するコスト（狭い通路は除外） */
const WALL_PENALTY = 5;

/** A* open リスト用 最小ヒープ */
class MinHeap {
    private readonly _data: ANode[] = [];
    get size(): number { return this._data.length; }

    push(node: ANode): void {
        this._data.push(node);
        this._up(this._data.length - 1);
    }

    pop(): ANode {
        const top = this._data[0];
        const last = this._data.pop()!;
        if (this._data.length > 0) { this._data[0] = last; this._down(0); }
        return top;
    }

    private _up(i: number): void {
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this._data[i].f < this._data[p].f) {
                [this._data[i], this._data[p]] = [this._data[p], this._data[i]];
                i = p;
            } else break;
        }
    }

    private _down(i: number): void {
        const n = this._data.length;
        while (true) {
            let s = i;
            const l = 2 * i + 1, r = l + 1;
            if (l < n && this._data[l].f < this._data[s].f) s = l;
            if (r < n && this._data[r].f < this._data[s].f) s = r;
            if (s === i) break;
            [this._data[i], this._data[s]] = [this._data[s], this._data[i]];
            i = s;
        }
    }
}

/** 追加生成できるウェイポイントの最大数 */
const EXTRA_POINT_MAX = 3;
/** 後退時にプレイヤー近傍セルへ加算するコスト */
const PLAYER_PENALTY = 15;
/** 後退時のプレイヤー近傍ペナルティ半径（セル数、マンハッタン距離） */
const PLAYER_PENALTY_RADIUS = 3;

export class RouteCalculator {
    /** ステージ開始時に生成した固定ウェイポイント（最大9個） */
    private _stagePoints: Cell[] = [];
    /** 全ポイントが地雷圏内のとき追加生成するポイント（最大3個） */
    private _extraPoints: Cell[] = [];
    /** タンクIDごとの前回選択ゴール（同じポイントを連続選択しないために使用） */
    private _lastGoal: Map<string, Cell> = new Map();
    /** 壁のみの通行可否グリッドキャッシュ（壁変更時に null でリセット） */
    private _passableCache: boolean[][] | null = null;

    // ─── ステージ初期化 ────────────────────────────────────────

    /**
     * ステージ切り替わり時に呼ぶ。
     * ステージ内に STAGE_POINT_COUNT 個のウェイポイントを生成する。
     * 条件：セル自身が通行可能、かつ周囲8マスに壁が存在しない。
     */
    initPoints(config: BattleFieldConfig): void {
        const { rows, cols, cellSize } = config;
        this._passableCache = null;
        const passable = this._getBaseGrid(rows, cols, cellSize);
        this._stagePoints = this._generateGridPoints(passable, rows, cols, []);
        this._extraPoints = [];
        this._lastGoal.clear();
    }

    /** 壁変更時にグリッドキャッシュを無効化する（EnemyMaster から呼ぶ） */
    invalidateGrid(): void {
        this._passableCache = null;
    }

    // ─── メイン計算 ──────────────────────────────────────────

    /**
     * 地雷の爆発範囲を加味したルート計算。
     * キャラクターの distancePref に応じた目標ポイントを選択し、A* で経路を返す。
     */
    calculate(
        tankId: string,
        from: THREE.Vector3,
        character: ResolvedCharacter,
        config: BattleFieldConfig,
        mineDetection: boolean,
        exitedOwnMines: Set<string>,
        _debugScene?: THREE.Scene,
    ): Cell[] {
        const { rows, cols, cellSize } = config;

        // 1. 通行可否グリッド取得（地雷壁を適用する場合はコピーして変更）
        const baseGrid = this._getBaseGrid(rows, cols, cellSize);
        const passable = mineDetection ? baseGrid.map(row => row.slice()) : baseGrid;
        if (mineDetection) this._applyMineWalls(passable, rows, cols, cellSize, tankId, exitedOwnMines);

        // 2. 開始セル
        const startCol = Math.floor(from.x / cellSize);
        const startRow = Math.floor(from.z / cellSize);
        if (!inBounds(startCol, startRow, rows, cols)) return [];

        // 3. 生存プレイヤーのうち最も近いタンクの位置を取得
        const alivePlayers = ObservationEquipment.instance.playerTanks.filter(t => t.isAlive);
        if (alivePlayers.length === 0) return [];
        const nearest = alivePlayers.reduce((a, b) =>
            from.distanceToSquared(a.movement.position) <= from.distanceToSquared(b.movement.position) ? a : b
        );
        const playerCol = Math.floor(nearest.movement.position.x / cellSize);
        const playerRow = Math.floor(nearest.movement.position.z / cellSize);

        // 4. 目標ポイントを distancePref に応じて選択
        const goal = this._resolveGoal(
            tankId,
            passable, rows, cols, cellSize,
            startCol, startRow,
            playerCol, playerRow,
            character.distancePref,
            mineDetection,
        );
        if (!goal) return [];

        // 5. コストマップ構築（壁ペナルティのみ）
        const costMap = this._buildCostMap(passable, rows, cols);

        // 6. A* で start → goal の最短ルートを返す
        return this._astar(passable, costMap, rows, cols, startCol, startRow, goal.col, goal.row);
    }

    /**
     * 特殊条件付きルート計算。
     * - isCharge=true : target へ向かうルートを計算（突撃）
     * - isCharge=false: プレイヤーに遭遇しないルートを計算（回避・後退）
     * - isZigzag=true : 求めたルートにジグザグ移動を追加
     * 地雷の爆発範囲を加味したコストマップを使用する。
     */
    specialCalculate(
        tankId: string,
        from: THREE.Vector3,
        _character: ResolvedCharacter,
        config: BattleFieldConfig,
        mineDetection: boolean,
        exitedOwnMines: Set<string>,
        isCharge: boolean,
        isZigzag: boolean,
        target: THREE.Vector3,
        _debugScene?: THREE.Scene,
    ): Cell[] {
        const { rows, cols, cellSize } = config;

        // 1. 通行可否グリッド取得（地雷壁を適用する場合はコピーして変更）
        const baseGrid = this._getBaseGrid(rows, cols, cellSize);
        const passable = mineDetection ? baseGrid.map(row => row.slice()) : baseGrid;
        if (mineDetection) this._applyMineWalls(passable, rows, cols, cellSize, tankId, exitedOwnMines);

        // 2. 開始セル
        const startCol = Math.floor(from.x / cellSize);
        const startRow = Math.floor(from.z / cellSize);
        if (!inBounds(startCol, startRow, rows, cols)) return [];

        // 3. 生存プレイヤーのうち最も近いタンクの位置を取得
        const alivePlayers = ObservationEquipment.instance.playerTanks.filter(t => t.isAlive);
        if (alivePlayers.length === 0) return [];
        const nearest = alivePlayers.reduce((a, b) =>
            from.distanceToSquared(a.movement.position) <= from.distanceToSquared(b.movement.position) ? a : b
        );
        const playerCol = Math.floor(nearest.movement.position.x / cellSize);
        const playerRow = Math.floor(nearest.movement.position.z / cellSize);

        let goalCol: number;
        let goalRow: number;
        let usePlayerPenalty = false;

        if (isCharge) {
            // target セルをゴールとして突撃ルートを計算
            goalCol = Math.floor(target.x / cellSize);
            goalRow = Math.floor(target.z / cellSize);
            if (!inBounds(goalCol, goalRow, rows, cols)) return [];
            if (!passable[goalRow]?.[goalCol]) return [];
        } else {
            // プレイヤーを避けてプレイヤーから最も遠いポイントへ向かうルートを計算
            const goal = this._resolveGoal(
                tankId,
                passable, rows, cols, cellSize,
                startCol, startRow,
                playerCol, playerRow,
                'far',
                mineDetection,
            );
            if (!goal) return [];
            goalCol = goal.col;
            goalRow = goal.row;
            usePlayerPenalty = true;
        }

        // 4. コストマップ構築（isCharge=false 時はプレイヤーペナルティも加算）
        const costMap = this._buildCostMap(
            passable, rows, cols,
            usePlayerPenalty ? playerCol : null,
            usePlayerPenalty ? playerRow : null,
        );

        // 5. A* 探索
        const path = this._astar(passable, costMap, rows, cols, startCol, startRow, goalCol, goalRow);

        // 6. ジグザグ変換
        if (isZigzag && path.length > 2) {
            return this._applyZigzag(path, passable, rows, cols);
        }

        return path;
    }

    // ─── グリッド構築 ─────────────────────────────────────────

    /** キャッシュ済みグリッドを返す。未構築の場合は構築してキャッシュする */
    private _getBaseGrid(rows: number, cols: number, cellSize: number): boolean[][] {
        if (!this._passableCache) {
            this._passableCache = buildPassableGrid(rows, cols, cellSize);
        }
        return this._passableCache;
    }

    // ─── ウェイポイント生成 ────────────────────────────────────

    /**
     * ステージを 3×3 の区画に分割し、各区画からランダムに1点選んで最大9点返す。
     * 有効なセルがない区画はスキップする。
     * @param existing 既存ポイントと重複しないよう除外するセル一覧
     */
    private _generateGridPoints(
        passable: boolean[][],
        rows: number, cols: number,
        existing: Cell[],
    ): Cell[] {
        const GRID = 3;
        const points: Cell[] = [];

        for (let gr = 0; gr < GRID; gr++) {
            const rStart = Math.floor(gr * rows / GRID);
            const rEnd   = Math.floor((gr + 1) * rows / GRID);

            for (let gc = 0; gc < GRID; gc++) {
                const cStart = Math.floor(gc * cols / GRID);
                const cEnd   = Math.floor((gc + 1) * cols / GRID);

                // この区画内の有効なセルを収集
                const candidates: Cell[] = [];
                for (let r = rStart; r < rEnd; r++) {
                    for (let c = cStart; c < cEnd; c++) {
                        if (!passable[r][c]) continue;
                        if (!this._hasClearSurroundings(passable, rows, cols, c, r)) continue;
                        if (existing.some(p => p.col === c && p.row === r)) continue;
                        candidates.push({ col: c, row: r });
                    }
                }

                if (candidates.length === 0) continue;
                points.push(candidates[Math.floor(Math.random() * candidates.length)]);
            }
        }

        return points;
    }

    /**
     * 全域からランダムに count 個選ぶ（追加ポイント生成用）。
     * @param existing 既存ポイントと重複しないよう除外するセル一覧
     */
    private _generatePoints(
        passable: boolean[][],
        rows: number, cols: number,
        count: number,
        existing: Cell[],
    ): Cell[] {
        const candidates: Cell[] = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!passable[r][c]) continue;
                if (!this._hasClearSurroundings(passable, rows, cols, c, r)) continue;
                if (existing.some(p => p.col === c && p.row === r)) continue;
                candidates.push({ col: c, row: r });
            }
        }
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        return candidates.slice(0, count);
    }

    /** セルの周囲8マスがすべて通行可能かどうかを判定する */
    private _hasClearSurroundings(
        passable: boolean[][],
        rows: number, cols: number,
        col: number, row: number,
    ): boolean {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = row + dr;
                const nc = col + dc;
                if (!inBounds(nc, nr, rows, cols) || !passable[nr][nc]) return false;
            }
        }
        return true;
    }

    // ─── 目標セル決定 ─────────────────────────────────────────

    /**
     * ステージポイントから distancePref に応じた目標を選ぶ。
     * mineDetection 有効時、全ポイントが地雷圏内なら追加ポイントを生成（最大 EXTRA_POINT_MAX 個）。
     */
    private _resolveGoal(
        tankId: string,
        passable: boolean[][],
        rows: number, cols: number,
        cellSize: number,
        startCol: number, startRow: number,
        playerCol: number, playerRow: number,
        distancePref: DistancePref,
        mineDetection: boolean,
    ): Cell | null {
        if (distancePref === null) return null;

        const lastGoal = this._lastGoal.get(tankId) ?? null;

        let candidates = [...this._stagePoints, ...this._extraPoints];
        if (candidates.length === 0) return null;

        // 前回選択したポイントを除外（同じポイントの連続選択を防ぐ）
        if (lastGoal !== null && candidates.length > 1) {
            candidates = candidates.filter(p => !(p.col === lastGoal.col && p.row === lastGoal.row));
        }

        // mineDetection 有効時：爆発範囲内のポイントを除外
        if (mineDetection) {
            const mines = ObservationEquipment.instance.mineObservations;
            const safe = candidates.filter(p => !isPointNearMine(p, mines, cellSize));

            if (safe.length === 0 && this._extraPoints.length < EXTRA_POINT_MAX) {
                // 全ポイントが地雷圏内 → 追加ポイントを生成
                const needed = EXTRA_POINT_MAX - this._extraPoints.length;
                const all = [...this._stagePoints, ...this._extraPoints];
                const extra = this._generatePoints(passable, rows, cols, needed, all);
                this._extraPoints.push(...extra);

                candidates = [...this._stagePoints, ...this._extraPoints];
                const safeAfter = candidates.filter(p => !isPointNearMine(p, mines, cellSize));
                candidates = safeAfter.length > 0 ? safeAfter : candidates;
            } else {
                candidates = safe.length > 0 ? safe : candidates;
            }
        }

        // 通行不可のポイントを除外
        candidates = candidates.filter(p => passable[p.row]?.[p.col]);
        if (candidates.length === 0) return null;

        const goal = this._pickByDistancePref(
            candidates, rows, cols,
            startCol, startRow,
            playerCol, playerRow,
            distancePref,
        );
        if (goal !== null) this._lastGoal.set(tankId, goal);
        return goal;
    }

    /**
     * distancePref に応じた目標セルを候補から選ぶ。
     * - near: プレイヤーに最も近いポイント
     * - mid:  プレイヤーからマップ対角線の35%程度の距離のポイント
     * - far:  プレイヤーから最も遠いポイント
     */
    private _pickByDistancePref(
        candidates: Cell[],
        rows: number, cols: number,
        startCol: number, startRow: number,
        playerCol: number, playerRow: number,
        distancePref: DistancePref,
    ): Cell | null {
        const midTargetDist = Math.sqrt(rows ** 2 + cols ** 2) * 0.35;

        let best: Cell | null = null;
        let bestScore = Infinity;

        for (const p of candidates) {
            if (p.col === startCol && p.row === startRow) continue;
            const dist = Math.sqrt((p.col - playerCol) ** 2 + (p.row - playerRow) ** 2);
            const score =
                distancePref === 'far'  ? -dist :
                distancePref === 'near' ? dist  :
                Math.abs(dist - midTargetDist);

            if (score < bestScore) {
                bestScore = score;
                best = p;
            }
        }

        return best;
    }

    // ─── コストマップ ─────────────────────────────────────────

    /**
     * コストマップを構築する。
     * - 壁隣接セルに WALL_PENALTY を加算（狭い通路は除外）
     */
    private _buildCostMap(
        passable: boolean[][],
        rows: number, cols: number,
        playerCol: number | null = null,
        playerRow: number | null = null,
    ): number[][] {
        const costs: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

        // 壁から1マス離れるよう、壁隣接セルに WALL_PENALTY を加算
        // ただし通路幅が2マス以下の狭い通路は除外
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!passable[r][c]) continue;
                if (!this._isAdjacentToWall(passable, rows, cols, c, r)) continue;
                if (this._isNarrowCorridor(passable, rows, cols, c, r)) continue;
                costs[r][c] += WALL_PENALTY;
            }
        }

        if (playerCol !== null && playerRow !== null) {
            this._addPlayerCosts(costs, rows, cols, playerCol, playerRow);
        }

        return costs;
    }

    /**
     * 後退時にプレイヤー近傍セルへ PLAYER_PENALTY を加算する。
     * A* がプレイヤーを迂回するルートを選ぶようにする。
     */
    private _addPlayerCosts(
        costs: number[][],
        rows: number, cols: number,
        playerCol: number, playerRow: number,
    ): void {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const dist = Math.abs(c - playerCol) + Math.abs(r - playerRow);
                if (dist <= PLAYER_PENALTY_RADIUS) {
                    costs[r][c] += PLAYER_PENALTY;
                }
            }
        }
    }

    /**
     * mineDetection 有効時に地雷の爆発範囲内セルを通行不可にする。
     * A* が爆発範囲を絶対に通過しないよう、passable グリッドに直接書き込む。
     * 自タンクが設置した地雷は除外する（自地雷の範囲内から脱出できるようにするため）。
     */
    private _applyMineWalls(
        passable: boolean[][],
        rows: number, cols: number,
        cellSize: number,
        ownTankId: string,
        exitedOwnMines: Set<string>,
    ): void {
        for (const { id, ownerTankId, mine } of StageObjectManager.instance.allMines) {
            // 自分の地雷で、まだ範囲内にいる（未退出）ものはスキップ
            if (ownerTankId === ownTankId && !exitedOwnMines.has(id)) continue;
            const { explosionRange } = mine.info.stats;
            const pos = mine.object.position;
            const r2 = explosionRange * explosionRange;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const cx = c * cellSize + cellSize / 2;
                    const cz = r * cellSize + cellSize / 2;
                    const dx = cx - pos.x;
                    const dz = cz - pos.z;
                    if (dx * dx + dz * dz <= r2) {
                        passable[r][c] = false;
                    }
                }
            }
        }
    }

    /** 隣接4セルにブロックセルが含まれているか */
    private _isAdjacentToWall(
        passable: boolean[][],
        rows: number, cols: number,
        col: number, row: number,
    ): boolean {
        for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
            const nc = col + dc;
            const nr = row + dr;
            // グリッド外も壁として扱う
            if (!inBounds(nc, nr, rows, cols) || !passable[nr][nc]) return true;
        }
        return false;
    }

    /**
     * 通路幅が 2 マス以下かどうかを判定する。
     * 水平・垂直それぞれの連続通行可能マス数のうち、小さい方が 2 以下なら狭い通路。
     */
    private _isNarrowCorridor(
        passable: boolean[][],
        rows: number, cols: number,
        col: number, row: number,
    ): boolean {
        let h = 1;
        for (let c = col - 1; c >= 0 && passable[row][c]; c--) h++;
        for (let c = col + 1; c < cols && passable[row][c]; c++) h++;

        let v = 1;
        for (let r = row - 1; r >= 0 && passable[r][col]; r--) v++;
        for (let r = row + 1; r < rows && passable[r][col]; r++) v++;

        return Math.min(h, v) <= 2;
    }

    // ─── A* 探索 ──────────────────────────────────────────────

    /**
     * A* 経路探索。
     * スタートからゴールまでのセル列を返す（スタートセル自身は含まない）。
     * ゴールへの経路が存在しない場合は空配列を返す。
     */
    private _astar(
        passable: boolean[][],
        costs: number[][],
        rows: number, cols: number,
        startCol: number, startRow: number,
        goalCol: number, goalRow: number,
    ): Cell[] {
        if (startCol === goalCol && startRow === goalRow) return [];
        if (!passable[goalRow]?.[goalCol]) return [];

        const open = new MinHeap();
        const closed = new Set<number>();
        const gScore = new Map<number, number>();
        const idx = (c: number, r: number) => r * cols + c;
        const h   = (c: number, r: number) => Math.abs(c - goalCol) + Math.abs(r - goalRow);

        const startIdx = idx(startCol, startRow);
        gScore.set(startIdx, 0);
        open.push({ col: startCol, row: startRow, g: 0, f: h(startCol, startRow), parent: null });

        const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;

        while (open.size > 0) {
            const cur = open.pop();
            const curIdx = idx(cur.col, cur.row);
            if (closed.has(curIdx)) continue; // ヒープに残った古いエントリをスキップ
            closed.add(curIdx);

            if (cur.col === goalCol && cur.row === goalRow) {
                return this._reconstructPath(cur);
            }

            for (const [dc, dr] of DIRS) {
                const nc = cur.col + dc;
                const nr = cur.row + dr;
                if (!inBounds(nc, nr, rows, cols)) continue;
                if (!passable[nr][nc]) continue;
                const ni = idx(nc, nr);
                if (closed.has(ni)) continue;

                const ng = cur.g + 1 + costs[nr][nc];
                if (ng >= (gScore.get(ni) ?? Infinity)) continue; // 既知の最短より悪ければスキップ
                gScore.set(ni, ng);
                open.push({ col: nc, row: nr, g: ng, f: ng + h(nc, nr), parent: cur });
            }
        }

        return []; // ゴールへの経路なし
    }

    /** A* ノード連鎖から経路を再構築する（スタートセルは除く） */
    private _reconstructPath(goal: ANode): Cell[] {
        const path: Cell[] = [];
        let node: ANode | null = goal;
        while (node) {
            path.unshift({ col: node.col, row: node.row });
            node = node.parent;
        }
        path.shift(); // スタートセルは現在地なので除外
        return path;
    }

    // ─── ジグザグ変換 ─────────────────────────────────────────

    /**
     * A* で求めたパスにジグザグ移動を加える。
     * ZIGZAG_INTERVAL セルごとに、進行方向に対して垂直方向へ1マスずらした
     * 中間セルを挿入することでジグザグ軌跡を作る。
     * 挿入先が通行不可の場合はスキップする。
     */
    private _applyZigzag(path: Cell[], passable: boolean[][], rows: number, cols: number): Cell[] {
        const ZIGZAG_INTERVAL = 4;
        const result: Cell[] = [];
        let zigzagSign = 1;

        for (let i = 0; i < path.length; i++) {
            result.push(path[i]);

            if ((i + 1) % ZIGZAG_INTERVAL === 0 && i + 1 < path.length) {
                const cur  = path[i];
                const next = path[i + 1];
                const dc = next.col - cur.col;
                const dr = next.row - cur.row;

                // 進行方向 (dc, dr) に対して垂直方向 (-dr, dc)
                const perpCol = cur.col + (-dr) * zigzagSign;
                const perpRow = cur.row +   dc  * zigzagSign;

                if (inBounds(perpCol, perpRow, rows, cols) && passable[perpRow][perpCol]) {
                    result.push({ col: perpCol, row: perpRow });
                }

                zigzagSign *= -1;
            }
        }

        return result;
    }
}
