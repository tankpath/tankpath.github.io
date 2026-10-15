// プレイヤーの不得意なステージをデータ化する
// また、不得意なステージを選出したステージ配列を送る
import { AnalyzeManager } from '../managers/AnalyzeManager';

// ─── 内部ウィンドウ用レコード ──────────────────────────────────

export type WinEntry  = { kind: 'win';  stageNumber: number; mapNumber: number; elapsedMs: number };
export type LoseEntry = { kind: 'lose'; stageNumber: number; mapNumber: number; survivorCount: number; elapsedMs: number };
export type StageEntry = WinEntry | LoseEntry;

// ─── 永続化用の状態型 ──────────────────────────────────────────

export interface StageAnalyzerState {
    window:     StageEntry[];
    compressed: [number, { sum: number; count: number }][];
    scores:     [number, number][];
}

// ─── 定数 ─────────────────────────────────────────────────────

/** 直近何ステージ分を評価対象とするか */
const WINDOW_SIZE = 50;

/**
 * 勝利スコアの基準時間(ms)。
 * この時間を超えると win のスコアが下がる(速いほど高評価)。
 */
const REF_WIN_MS = 30_000; // 30秒

// ─── スコア計算ヘルパー ────────────────────────────────────────

/** 勝利1件のスコア [0, 1] — 速いほど +1 に近い */
function calcWinScore(elapsedMs: number): number {
    return 1 / (1 + elapsedMs / REF_WIN_MS);
}

/** 敗北1件のスコア [-1, -0.5] — 残存敵が多いほど -1 に近い */
function calcLoseScore(survivorCount: number): number {
    return -(0.5 + Math.min(survivorCount, 5) * 0.1);
}

// ─── StageAnalyzer ────────────────────────────────────────────

export class StageAnalyzer {
    private static _instance: StageAnalyzer;

    private _window: StageEntry[] = [];

    /**
     * 圧縮済みのマップ番号ごとの貢献合計。
     * 50件到達時にウィンドウをここへ畳み込み、ウィンドウをクリアする。
     */
    private _compressed: Map<number, { sum: number; count: number }> = new Map();

    /** AnalyzeManager の各配列について処理済みインデックス */
    private _processedWins  = 0;
    private _processedLoses = 0;

    /** マップ番号 → 評価スコア (-1 〜 1、未評価は 0) */
    private _scores: Map<number, number> = new Map();

    private constructor() {}

    static get instance(): StageAnalyzer {
        if (!this._instance) this._instance = new StageAnalyzer();
        return this._instance;
    }

    // ─── 外部インタフェース ────────────────────────────────────

    /**
     * バトル終了後に呼ぶ。
     * AnalyzeManager の最新記録をウィンドウに取り込み、スコアを再評価する。
     */
    notify(): void {
        const am = AnalyzeManager.instance;

        // 新しい勝利記録を取り込む
        const wins = am.winRecords;
        for (let i = this._processedWins; i < wins.length; i++) {
            const { stageNumber, mapNumber, elapsedMs } = wins[i];
            this._addToWindow({ kind: 'win', stageNumber, mapNumber, elapsedMs });
        }
        this._processedWins = wins.length;

        // 新しい敗北記録を取り込む
        const loses = am.loseRecords;
        for (let i = this._processedLoses; i < loses.length; i++) {
            const { stageNumber, mapNumber, survivors, elapsedMs } = loses[i];
            this._addToWindow({ kind: 'lose', stageNumber, mapNumber, survivorCount: survivors.length, elapsedMs });
        }
        this._processedLoses = loses.length;

        this._evaluate();
    }

    /**
     * 指定ステージの評価スコアを返す。
     * @returns -1(最不得意) 〜 0(デフォルト/データなし) 〜 +1(最得意)
     */
    getScore(stageNumber: number): number {
        return this._scores.get(stageNumber) ?? 0;
    }

    /**
     * 不得意ステージ上位2のステージ番号配列 (スコア昇順)。
     * スコアが負のステージのみ対象。
     */
    get weakStages(): number[] {
        return [...this._scores.entries()]
            .filter(([, score]) => score < 0)
            .sort(([, a], [, b]) => a - b)
            .slice(0, 2)
            .map(([stage]) => stage);
    }

    /**
     * 得意ステージ上位3のステージ番号配列 (スコア降順)。
     * スコアが正のステージのみ対象。
     */
    get strongStages(): number[] {
        return [...this._scores.entries()]
            .filter(([, score]) => score > 0)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([stage]) => stage);
    }

    /** ゲーム開始時にリセット */
    reset(): void {
        this._window         = [];
        this._compressed     = new Map();
        this._processedWins  = 0;
        this._processedLoses = 0;
        this._scores         = new Map();
    }

    /**
     * localStorage 保存用の状態を返す。
     * 現在のウィンドウを compressed へ畳み込んだ状態で返す（内部状態は変更しない）。
     */
    getState(): StageAnalyzerState {
        const folded = new Map<number, { sum: number; count: number }>();
        for (const [k, v] of this._compressed) folded.set(k, { ...v });
        for (const [map, value] of this._buildContributions(this._window)) {
            const e = folded.get(map) ?? { sum: 0, count: 0 };
            folded.set(map, { sum: e.sum + value.sum, count: e.count + value.count });
        }
        return {
            window:     [],
            compressed: [...folded.entries()],
            scores:     [...this._scores.entries()],
        };
    }

    /** localStorage から復元した状態をセットする */
    setState(state: StageAnalyzerState): void {
        this._window         = state.window;
        this._compressed     = new Map(state.compressed);
        this._scores         = new Map(state.scores);
        this._processedWins  = 0;
        this._processedLoses = 0;
    }

    // ─── 内部処理 ──────────────────────────────────────────────

    private _addToWindow(entry: StageEntry): void {
        // 50件に達したらウィンドウを圧縮してからクリア
        if (this._window.length >= WINDOW_SIZE) {
            this._compress();
        }
        this._window.push(entry);
    }

    /**
     * 現在のウィンドウ内の貢献値をマップ番号ごとに集計し、
     * _compressed へ加算してウィンドウをクリアする。
     */
    private _compress(): void {
        for (const [map, value] of this._buildContributions(this._window)) {
            const existing = this._compressed.get(map) ?? { sum: 0, count: 0 };
            existing.sum   += value.sum;
            existing.count += value.count;
            this._compressed.set(map, existing);
        }
        this._window = [];
    }

    /**
     * エントリ配列からマップ番号ごとの貢献合計・件数を返す。
     */
    private _buildContributions(entries: StageEntry[]): Map<number, { sum: number; count: number }> {
        const result = new Map<number, { sum: number; count: number }>();
        for (const entry of entries) {
            const e = result.get(entry.mapNumber) ?? { sum: 0, count: 0 };
            e.sum += entry.kind === 'win'
                ? calcWinScore(entry.elapsedMs)
                : calcLoseScore(entry.survivorCount);
            e.count += 1;
            result.set(entry.mapNumber, e);
        }
        return result;
    }

    /**
     * 圧縮済みデータ + 現在ウィンドウからマップ番号ごとのスコアを再計算する。
     * 最終スコア = 全貢献値の平均, clamp[-1, 1]
     */
    private _evaluate(): void {
        const current = this._buildContributions(this._window);
        const allMaps = new Set([...this._compressed.keys(), ...current.keys()]);
        const newScores = new Map<number, number>();

        for (const map of allMaps) {
            const comp = this._compressed.get(map) ?? { sum: 0, count: 0 };
            const curr = current.get(map)           ?? { sum: 0, count: 0 };
            const totalSum   = comp.sum   + curr.sum;
            const totalCount = comp.count + curr.count;
            if (totalCount === 0) continue;
            newScores.set(map, Math.max(-1, Math.min(1, totalSum / totalCount)));
        }
        this._scores = newScores;
    }
}
