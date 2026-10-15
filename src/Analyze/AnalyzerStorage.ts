// Analyzer 系データを gzip 圧縮して localStorage へ保存・復元するユーティリティ
import { EnemyAnalyzer } from './EnemyAnalyzer';
import type { EnemyAnalyzerState } from './EnemyAnalyzer';
import { PlayerAnalyzer } from './PlayerAnalyzer';
import type { PlayerAnalyzerState } from './PlayerAnalyzer';
import { StageAnalyzer } from './StageAnalyzer';
import type { StageAnalyzerState } from './StageAnalyzer';
import { StageCreationManager } from '../managers/StageCreationManager';
import { ProfileManager } from '../managers/ProfileManager';

const STORAGE_KEY = 'tankpath_analyzers';

type SavedState = {
    enemy:           EnemyAnalyzerState;
    player:          PlayerAnalyzerState;
    stage:           StageAnalyzerState;
    maxReachedStage: number;
};

// ─── 圧縮・展開ヘルパー ────────────────────────────────────────

async function compress(data: unknown): Promise<string> {
    const bytes  = new TextEncoder().encode(JSON.stringify(data));
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const buffer = await new Response(stream.readable).arrayBuffer();
    const u8     = new Uint8Array(buffer);
    let binary   = '';
    for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
    return btoa(binary);
}

async function decompress(base64: string): Promise<unknown> {
    const binary = atob(base64);
    const u8     = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i);
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    writer.write(u8);
    writer.close();
    const json = await new Response(stream.readable).text();
    return JSON.parse(json);
}

// ─── データ破損時のロードヘルパー ──────────────────────────────

/**
 * localStorage から SavedState を読み込む。
 * データが存在しない・壊れている場合は null を返しキーを削除する。
 */
async function loadSavedState(): Promise<SavedState | null> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
        const state = await decompress(raw) as SavedState;
        if (!state?.enemy || !state?.player || !state?.stage) {
            throw new Error('invalid shape');
        }
        return state;
    } catch (e) {
        console.warn('[AnalyzerStorage] 保存データが壊れているためクリアします:', e);
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }
}

// ─── マージヘルパー ────────────────────────────────────────────

/** 文字列キーの compressed Map をマージする (EnemyAnalyzer 用) */
function mergeStringCompressed(
    existing: [string, { sum: number; count: number }][],
    current:  [string, { sum: number; count: number }][],
): [string, { sum: number; count: number }][] {
    const map = new Map<string, { sum: number; count: number }>(
        existing.map(([k, v]) => [k, { ...v }]),
    );
    for (const [key, val] of current) {
        const e = map.get(key) ?? { sum: 0, count: 0 };
        map.set(key, { sum: e.sum + val.sum, count: e.count + val.count });
    }
    return [...map.entries()];
}

/** 数値キーの compressed Map をマージする (StageAnalyzer 用) */
function mergeNumberCompressed(
    existing: [number, { sum: number; count: number }][],
    current:  [number, { sum: number; count: number }][],
): [number, { sum: number; count: number }][] {
    const map = new Map<number, { sum: number; count: number }>(
        existing.map(([k, v]) => [k, { ...v }]),
    );
    for (const [key, val] of current) {
        const e = map.get(key) ?? { sum: 0, count: 0 };
        map.set(key, { sum: e.sum + val.sum, count: e.count + val.count });
    }
    return [...map.entries()];
}

/**
 * PlayerAnalyzer の windows をプレイヤーごとにマージする。
 * 既存エントリ + 今セッションのエントリを加重平均1件に圧縮して結合する。
 */
function mergePlayerWindows(
    existing: PlayerAnalyzerState['windows'],
    current:  PlayerAnalyzerState['windows'],
): PlayerAnalyzerState['windows'] {
    const result = new Map(current);
    for (const [playerId, existingEntries] of existing) {
        const currentEntries = result.get(playerId) ?? [];
        const combined       = [...existingEntries, ...currentEntries];
        const totalWeight    = combined.reduce((s, e) => s + e.weight, 0);
        const weightedSum    = combined.reduce((s, e) => s + e.score * e.weight, 0);
        result.set(playerId, [{ score: weightedSum / totalWeight, weight: totalWeight }]);
    }
    return [...result.entries()];
}

// ─── 公開 API ─────────────────────────────────────────────────

/**
 * EnemyAnalyzer / PlayerAnalyzer / StageAnalyzer の現在状態を
 * 既存の保存データへ累積してから gzip 圧縮して localStorage へ保存する。
 */
export async function saveAnalyzers(): Promise<void> {
    const existing = await loadSavedState();

    const currentStage = StageCreationManager.instance.stageNumber;

    const current: SavedState = {
        enemy:           EnemyAnalyzer.instance.getState(),
        player:          PlayerAnalyzer.instance.getState(),
        stage:           StageAnalyzer.instance.getState(),
        maxReachedStage: currentStage,
    };

    // getState() でウィンドウは compressed へ畳み込み済みなので、compressed のみマージする
    const merged: SavedState = existing ? {
        enemy: {
            window:     [],
            compressed: mergeStringCompressed(existing.enemy.compressed, current.enemy.compressed),
            scores:     current.enemy.scores,
        },
        player: {
            windows: mergePlayerWindows(existing.player.windows, current.player.windows),
            scores:  current.player.scores,
        },
        stage: {
            window:     [],
            compressed: mergeNumberCompressed(existing.stage.compressed, current.stage.compressed),
            scores:     current.stage.scores,
        },
        maxReachedStage: Math.max(existing.maxReachedStage ?? 0, currentStage),
    } : current;

    localStorage.setItem(STORAGE_KEY, await compress(merged));
    ProfileManager.instance.setClearedStages(merged.maxReachedStage);
}

/**
 * localStorage から Analyzer の状態を復元する。
 * データが存在しない・壊れている場合は何もしない。
 */
export async function loadAnalyzers(): Promise<void> {
    const state = await loadSavedState();
    if (!state) return;
    try {
        EnemyAnalyzer.instance.setState(state.enemy);
        PlayerAnalyzer.instance.setState(state.player);
        StageAnalyzer.instance.setState(state.stage);
    } catch (e) {
        console.warn('[AnalyzerStorage] 状態の復元に失敗しました:', e);
        localStorage.removeItem(STORAGE_KEY);
    }
}
