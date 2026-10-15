// 敵タンクの評価をデータ化する
// 不得意・得意な敵タイプを抽選確率に反映する
import { AnalyzeManager } from '../managers/AnalyzeManager';
import type { EnemyType } from '../Definition/EnemyDefinition';

// ─── 内部ウィンドウ用レコード ──────────────────────────────────

export type BattleEntry = {
    kind: 'win' | 'lose';
    defeatedTypes: string[];  // バトル中にプレイヤーが撃破した敵タイプ
    survivingTypes: string[]; // バトル終了時に残存していた敵タイプ（勝利時は空）
    elapsedMs: number;        // バトル経過時間
};

// ─── 定数 ─────────────────────────────────────────────────────

/** 直近何バトル分を評価対象とするか */
const WINDOW_SIZE = 50;

/** 不得意・得意タイプに付与する重み (通常 = 1) */
const BOOST_WEIGHT = 3;

/**
 * 勝利スコアの基準時間(ms)。
 * この時間で勝利すると +0.5、速いほど +1 に近づく。
 */
const REF_WIN_MS = 30_000; // 30s

// ─── スコア計算ヘルパー ────────────────────────────────────────

/**
 * 勝利1件あたりの撃破スコア (0, 1]。
 * 速いほど +1 に近く、遅いほど 0 に近づく（0 にはならない）。
 */
function calcWinScore(elapsedMs: number): number {
    return 1 / (1 + elapsedMs / REF_WIN_MS);
}

// ─── 永続化用の状態型 ──────────────────────────────────────────

export interface EnemyAnalyzerState {
    window:     BattleEntry[];
    compressed: [string, { sum: number; count: number }][];
    scores:     [string, number][];
}

// ─── EnemyAnalyzer ────────────────────────────────────────────

export class EnemyAnalyzer {
    private static _instance: EnemyAnalyzer;

    private _window: BattleEntry[] = [];
    private _processedWins  = 0;
    private _processedLoses = 0;

    /**
     * 圧縮済みの敵タイプごとの貢献合計。
     * 50件到達時にウィンドウをここへ畳み込み、ウィンドウをクリアする。
     */
    private _compressed: Map<string, { sum: number; count: number }> = new Map();

    /**
     * 敵タイプ → スコア (-1 〜 1)
     *  +1: 毎回素早く撃破できる (得意)
     *  0 : 時間をかけて撃破 / データなし
     *  -1: 毎回残存する     (不得意)
     */
    private _scores: Map<string, number> = new Map();

    private constructor() {}

    static get instance(): EnemyAnalyzer {
        if (!this._instance) this._instance = new EnemyAnalyzer();
        return this._instance;
    }

    // ─── 外部インタフェース ────────────────────────────────────

    /**
     * バトル終了後に呼ぶ。
     * AnalyzeManager の最新記録をウィンドウに取り込み、スコアを再評価する。
     */
    notify(): void {
        const am = AnalyzeManager.instance;

        const wins = am.winRecords;
        for (let i = this._processedWins; i < wins.length; i++) {
            const { defeatedEnemies, elapsedMs } = wins[i];
            this._addToWindow({
                kind: 'win',
                defeatedTypes:  defeatedEnemies.map(e => e.type),
                survivingTypes: [],
                elapsedMs,
            });
        }
        this._processedWins = wins.length;

        const loses = am.loseRecords;
        for (let i = this._processedLoses; i < loses.length; i++) {
            const { survivors, defeatedEnemies, elapsedMs } = loses[i];
            this._addToWindow({
                kind: 'lose',
                defeatedTypes:  defeatedEnemies.map(e => e.type),
                survivingTypes: survivors.map(e => e.type),
                elapsedMs,
            });
        }
        this._processedLoses = loses.length;

        this._evaluate();
    }

    /**
     * プール内の敵タイプをスコアに応じた重み付き抽選で返す。
     * 不得意上位3・得意上位3 は出現確率が BOOST_WEIGHT 倍になるが、
     * プール内の全タイプに選出の可能性を残す。
     */
    selectEnemy(pool: readonly EnemyType[]): EnemyType {
        const weakSet   = new Set(this.weakEnemies);
        const strongSet = new Set(this.strongEnemies);

        const weights = pool.map(type =>
            (weakSet.has(type) || strongSet.has(type)) ? BOOST_WEIGHT : 1
        );

        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;

        for (let i = 0; i < pool.length; i++) {
            r -= weights[i];
            if (r <= 0) return pool[i];
        }
        return pool[pool.length - 1]; // フォールバック
    }

    /**
     * 不得意な敵タイプ上位3 (スコア昇順 = 残存率が高い順)。
     * スコアが負のタイプのみ対象。
     */
    get weakEnemies(): string[] {
        return [...this._scores.entries()]
            .filter(([, score]) => score < 0)
            .sort(([, a], [, b]) => a - b)
            .slice(0, 3)
            .map(([type]) => type);
    }

    /**
     * 得意な敵タイプ上位3 (スコア降順 = 素早い撃破率が高い順)。
     * スコアが正のタイプのみ対象。
     */
    get strongEnemies(): string[] {
        return [...this._scores.entries()]
            .filter(([, score]) => score > 0)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([type]) => type);
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
    getState(): EnemyAnalyzerState {
        const folded = new Map<string, { sum: number; count: number }>();
        for (const [k, v] of this._compressed) folded.set(k, { ...v });
        for (const [type, value] of this._buildContributions(this._window)) {
            const e = folded.get(type) ?? { sum: 0, count: 0 };
            folded.set(type, { sum: e.sum + value.sum, count: e.count + value.count });
        }
        return {
            window:     [],
            compressed: [...folded.entries()],
            scores:     [...this._scores.entries()],
        };
    }

    /** localStorage から復元した状態をセットする */
    setState(state: EnemyAnalyzerState): void {
        this._window         = state.window;
        this._compressed     = new Map(state.compressed);
        this._scores         = new Map(state.scores);
        this._processedWins  = 0;
        this._processedLoses = 0;
    }

    // ─── 内部処理 ──────────────────────────────────────────────

    private _addToWindow(entry: BattleEntry): void {
        // 50件に達したらウィンドウを圧縮してからクリア
        if (this._window.length >= WINDOW_SIZE) {
            this._compress();
        }
        this._window.push(entry);
    }

    /**
     * 現在のウィンドウ内の貢献値を敵タイプごとに集計し、
     * _compressed へ加算してウィンドウをクリアする。
     */
    private _compress(): void {
        for (const [type, value] of this._buildContributions(this._window)) {
            const existing = this._compressed.get(type) ?? { sum: 0, count: 0 };
            existing.sum   += value.sum;
            existing.count += value.count;
            this._compressed.set(type, existing);
        }
        this._window = [];
    }

    /**
     * エントリ配列から敵タイプごとの貢献合計・件数を返す。
     *
     * 貢献値ルール:
     *   勝利時 撃破:  +calcWinScore(elapsedMs)  … 速勝 → +1、遅勝 → 0 付近
     *   敗北時 撃破:  +0.5                       … 負けながらも倒した
     *   敗北時 残存:  -1                          … プレイヤーを倒した敵
     */
    private _buildContributions(entries: BattleEntry[]): Map<string, { sum: number; count: number }> {
        const result = new Map<string, { sum: number; count: number }>();

        const add = (type: string, value: number) => {
            const e = result.get(type) ?? { sum: 0, count: 0 };
            e.sum += value;
            e.count += 1;
            result.set(type, e);
        };

        for (const entry of entries) {
            if (entry.kind === 'win') {
                const s = calcWinScore(entry.elapsedMs);
                for (const type of entry.defeatedTypes) add(type, s);
            } else {
                for (const type of entry.defeatedTypes)  add(type,  0.5);
                for (const type of entry.survivingTypes) add(type, -1);
            }
        }
        return result;
    }

    /**
     * 圧縮済みデータ + 現在ウィンドウから敵タイプごとのスコアを再計算する。
     * 最終スコア = 全貢献値の平均, clamp[-1, 1]
     */
    private _evaluate(): void {
        const current = this._buildContributions(this._window);

        const allTypes = new Set([...this._compressed.keys(), ...current.keys()]);
        const newScores = new Map<string, number>();

        for (const type of allTypes) {
            const comp = this._compressed.get(type) ?? { sum: 0, count: 0 };
            const curr = current.get(type)            ?? { sum: 0, count: 0 };
            const totalSum   = comp.sum   + curr.sum;
            const totalCount = comp.count + curr.count;
            if (totalCount === 0) continue;
            newScores.set(type, Math.max(-1, Math.min(1, totalSum / totalCount)));
        }
        this._scores = newScores;
    }
}
