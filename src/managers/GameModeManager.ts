//　タイトル画面およびゲームモード選択時に設定すること
import { GameMode } from '../Definition/GameMode';
import type { GameMode as GameModeType } from '../Definition/GameMode';

/**
 * 現在のゲームモードを保持するシングルトン。
 * タイトル / モード選択画面で setMode() を呼んでセットし、
 * 各シーン・システムから currentMode を参照する。
 */
export class GameModeManager {
    private static _instance: GameModeManager;
    private _currentMode: GameModeType = GameMode.Solo;

    private constructor() {}

    static get instance(): GameModeManager {
        if (!this._instance) this._instance = new GameModeManager();
        return this._instance;
    }

    /** 現在のゲームモード */
    get currentMode(): GameModeType { return this._currentMode; }

    /** ゲームモードを設定する */
    setMode(mode: GameModeType): void {
        this._currentMode = mode;
    }

    // ─── 判定ヘルパー ──────────────────────────────────────────

    get isSolo():   boolean { return this._currentMode === GameMode.Solo; }
    get isTeam():   boolean { return this._currentMode === GameMode.Team; }
    get isRace():   boolean { return this._currentMode === GameMode.Race; }
    get isBattle(): boolean { return this._currentMode === GameMode.Battle; }
}
