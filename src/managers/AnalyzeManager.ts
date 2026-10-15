
import type { Enemy } from '../managers/StageCreationManager';

export interface LoseRecord {
    stageNumber: number;
    mapNumber: number;
    survivors: Enemy[];
    defeatedEnemies: Enemy[];
    elapsedMs: number;
}

export interface WinRecord {
    stageNumber: number;
    mapNumber: number;
    defeatedEnemies: Enemy[];
    elapsedMs: number;
}

export class AnalyzeManager {
    private static _instance: AnalyzeManager;

    private _loseRecords: LoseRecord[] = [];
    private _winRecords: WinRecord[] = [];

    private constructor() {}

    static get instance(): AnalyzeManager {
        if (!this._instance) this._instance = new AnalyzeManager();
        return this._instance;
    }

    // ─── 記録 ─────────────────────────────────────────────────────

    /** 敗北時: ステージ番号・マップ番号・残存敵・撃破敵・経過時間を記録 */
    recordLose(stageNumber: number, mapNumber: number, survivors: Enemy[], defeatedEnemies: Enemy[], elapsedMs: number): void {
        this._loseRecords.push({ stageNumber, mapNumber, survivors: [...survivors], defeatedEnemies: [...defeatedEnemies], elapsedMs });
    }

    /** 勝利時: ステージ番号・マップ番号・撃破敵・経過時間を記録 */
    recordWin(stageNumber: number, mapNumber: number, defeatedEnemies: Enemy[], elapsedMs: number): void {
        this._winRecords.push({ stageNumber, mapNumber, defeatedEnemies: [...defeatedEnemies], elapsedMs });
    }

    // ─── 参照 ─────────────────────────────────────────────────────

    get loseRecords(): readonly LoseRecord[] { return this._loseRecords; }
    get winRecords():  readonly WinRecord[]  { return this._winRecords; }

    /** ゲーム開始時にリセット */
    reset(): void {
        this._loseRecords = [];
        this._winRecords  = [];
    }
}
