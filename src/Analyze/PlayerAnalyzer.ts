// プレイヤーの撃破パフォーマンスを数値化する
// 単独・複数プレイヤーそれぞれの撃破数と撃破時間を評価し、-1〜+1 のスコアを算出する
import { AnalyzeManager } from '../managers/AnalyzeManager';

// ─── 外部公開型 ───────────────────────────────────────────────

export interface PlayerBattleResult {
    kind: 'win' | 'lose';
    /** このプレイヤーが撃破した敵の数 */
    defeatedCount: number;
    /** バトル開始時点の総敵数 */
    totalEnemies: number;
    /** バトル経過時間 (ms) */
    elapsedMs: number;
}

// ─── 定数 ─────────────────────────────────────────────────────

/** 直近何バトル分を評価対象とするか */
const WINDOW_SIZE = 50;

/**
 * 勝利時の基準時間 (ms)。
 * この時間ちょうどで勝利すると timeScore = 0。
 * 速いほど +1、遅いほど -1 に近づく。
 */
const REF_WIN_MS = 30_000; // 30s

/**
 * 敗北時の基準生存時間 (ms)。
 * この時間まで生き延びると timeScore の罰則が半減する。
 */
const REF_SURVIVE_MS = 20_000; // 20s

/**
 * 全敵撃破時に与えられる撃破ボーナスの最大値。
 * 撃破率 (defeatedCount / totalEnemies) に比例して 0〜KILL_BONUS_MAX が加算される。
 */
const KILL_BONUS_MAX = 0.5;

// ─── 内部ストレージ型 ──────────────────────────────────────────

/**
 * ウィンドウ内の1エントリ。
 * 生の1バトルは weight=1、圧縮済みは weight=圧縮前の件数。
 */
export type ScoreEntry = { score: number; weight: number };

// ─── 永続化用の状態型 ──────────────────────────────────────────

export interface PlayerAnalyzerState {
    windows: [number, ScoreEntry[]][];
    scores:  [number, number][];
}

// ─── スコア計算ヘルパー ────────────────────────────────────────

/**
 * 時間スコア [-1, 1]。
 *   勝利: 速いほど +1 / REF_WIN_MS で 0 / 遅いほど -1
 *   敗北: 即死で -1 / REF_SURVIVE_MS 生存で -0.5 / 長期生存で 0 に漸近
 */
function calcTimeScore(kind: 'win' | 'lose', elapsedMs: number): number {
    if (kind === 'win') {
        return 2 / (1 + elapsedMs / REF_WIN_MS) - 1;
    } else {
        return -1 + elapsedMs / (elapsedMs + REF_SURVIVE_MS);
    }
}

/**
 * 撃破ボーナス [0, KILL_BONUS_MAX]。
 * 撃破率に比例して加算される。
 */
function calcKillBonus(defeatedCount: number, totalEnemies: number): number {
    if (totalEnemies === 0) return 0;
    return Math.min(defeatedCount / totalEnemies, 1) * KILL_BONUS_MAX;
}

/** バトル結果を [-1, +1] の battleScore に変換する */
function calcBattleScore(result: PlayerBattleResult): number {
    const timeScore = calcTimeScore(result.kind, result.elapsedMs);
    const killBonus = calcKillBonus(result.defeatedCount, result.totalEnemies);
    return Math.max(-1, Math.min(1, timeScore + killBonus));
}

// ─── PlayerAnalyzer ───────────────────────────────────────────

export class PlayerAnalyzer {
    private static _instance: PlayerAnalyzer;

    /** プレイヤーID → バトルスコアウィンドウ (圧縮済みエントリを含む) */
    private _windows: Map<number, ScoreEntry[]> = new Map();

    /** プレイヤーID → 評価スコア (-1〜+1) */
    private _scores: Map<number, number> = new Map();

    /** AnalyzeManager の処理済みインデックス（単独プレイ用 notify 向け） */
    private _processedWins  = 0;
    private _processedLoses = 0;

    private constructor() {}

    static get instance(): PlayerAnalyzer {
        if (!this._instance) this._instance = new PlayerAnalyzer();
        return this._instance;
    }

    // ─── 外部インタフェース ────────────────────────────────────

    /**
     * バトル終了後に呼ぶ（単独プレイ用）。
     * AnalyzeManager の最新記録をプレイヤー 0 として自動取り込みし、スコアを再評価する。
     *
     * 複数プレイヤーの場合は代わりに {@link record} を使う。
     */
    notify(): void {
        const am = AnalyzeManager.instance;

        const wins = am.winRecords;
        for (let i = this._processedWins; i < wins.length; i++) {
            const { defeatedEnemies, elapsedMs } = wins[i];
            this._record(0, {
                kind: 'win',
                defeatedCount: defeatedEnemies.length,
                totalEnemies:  defeatedEnemies.length, // 全員撃破 = 勝利
                elapsedMs,
            });
        }
        this._processedWins = wins.length;

        const loses = am.loseRecords;
        for (let i = this._processedLoses; i < loses.length; i++) {
            const { survivors, defeatedEnemies, elapsedMs } = loses[i];
            this._record(0, {
                kind: 'lose',
                defeatedCount: defeatedEnemies.length,
                totalEnemies:  defeatedEnemies.length + survivors.length,
                elapsedMs,
            });
        }
        this._processedLoses = loses.length;
    }

    /**
     * 指定プレイヤーのバトル結果を直接登録する（複数プレイヤー用）。
     * 登録後にそのプレイヤーのスコアを即時再評価する。
     *
     * @param playerId - プレイヤーを識別する任意の整数 (0, 1, 2, …)
     * @param result   - バトル結果
     */
    record(playerId: number, result: PlayerBattleResult): void {
        this._record(playerId, result);
    }

    /**
     * 指定プレイヤーの現在の評価スコアを返す。
     * @returns -1(最低) 〜 0(データなし/中立) 〜 +1(最高)
     */
    getScore(playerId: number): number {
        return this._scores.get(playerId) ?? 0;
    }

    /**
     * 全プレイヤーの評価スコアをスコア降順で返す。
     */
    get rankedScores(): { playerId: number; score: number }[] {
        return [...this._scores.entries()]
            .map(([playerId, score]) => ({ playerId, score }))
            .sort((a, b) => b.score - a.score);
    }

    /** ゲーム開始時にリセット */
    reset(): void {
        this._windows        = new Map();
        this._scores         = new Map();
        this._processedWins  = 0;
        this._processedLoses = 0;
    }

    /**
     * localStorage 保存用の状態を返す。
     * プレイヤーごとのウィンドウを加重平均1件に圧縮した状態で返す（内部状態は変更しない）。
     */
    getState(): PlayerAnalyzerState {
        const compressedWindows: [number, ScoreEntry[]][] = [];
        for (const [playerId, entries] of this._windows) {
            if (entries.length === 0) continue;
            const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
            const weightedSum = entries.reduce((s, e) => s + e.score * e.weight, 0);
            compressedWindows.push([playerId, [{ score: weightedSum / totalWeight, weight: totalWeight }]]);
        }
        return {
            windows: compressedWindows,
            scores:  [...this._scores.entries()],
        };
    }

    /** localStorage から復元した状態をセットする */
    setState(state: PlayerAnalyzerState): void {
        this._windows        = new Map(state.windows);
        this._scores         = new Map(state.scores);
        this._processedWins  = 0;
        this._processedLoses = 0;
    }

    // ─── 内部処理 ──────────────────────────────────────────────

    private _record(playerId: number, result: PlayerBattleResult): void {
        if (!this._windows.has(playerId)) this._windows.set(playerId, []);
        const window = this._windows.get(playerId)!;

        // 50件に達したら全エントリを加重平均1件に圧縮してから新規追加
        if (window.length >= WINDOW_SIZE) {
            const totalWeight = window.reduce((s, e) => s + e.weight, 0);
            const weightedSum = window.reduce((s, e) => s + e.score * e.weight, 0);
            window.length = 0;
            window.push({ score: weightedSum / totalWeight, weight: totalWeight });
        }

        window.push({ score: calcBattleScore(result), weight: 1 });
        this._evaluatePlayer(playerId);
    }

    /**
     * ウィンドウ内の全エントリからプレイヤーの評価スコアを再計算する。
     *
     * スコア計算ルール (バトル1件ごと):
     *   battleScore = clamp(timeScore + killBonus, -1, +1)
     *
     * 最終スコア = ウィンドウ内の battleScore の加重平均, clamp[-1, +1]
     * ※ 圧縮エントリは weight=圧縮前件数 として加重される
     */
    private _evaluatePlayer(playerId: number): void {
        const window = this._windows.get(playerId);
        if (!window || window.length === 0) {
            this._scores.set(playerId, 0);
            return;
        }

        const totalWeight = window.reduce((s, e) => s + e.weight, 0);
        const weightedSum = window.reduce((s, e) => s + e.score * e.weight, 0);
        this._scores.set(playerId, Math.max(-1, Math.min(1, weightedSum / totalWeight)));
    }
}
