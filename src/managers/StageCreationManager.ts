import { GameModeManager } from './GameModeManager';
import { GAMEMODE_INFO } from '../Definition/GameMode';

/** 敵の情報 */
export interface Enemy {
    id: string;     // 敵ごとのユニークID
    type: string;   // 敵の種別（例: 'enemy_01'〜'enemy_05'）
}

/** バトルの勝敗 */
export type BattleResult = 'win' | 'lose';

export class StageCreationManager {
    private static _instance: StageCreationManager;

    private _stageNumber: number = 1;
    private _previousStageNumber: number = 0;
    private _remainingEnemies: Enemy[] = [];
    private _tryCount: number = 5;
    private _previousTryCount: number = 5;
    private _lastResult: BattleResult | null = null;

    /** select モード時にユーザーが選択したステージ番号 */
    private _selectedStageNumber: number = 1;
    /** select モード時にユーザーが選択した挑戦回数 */
    private _selectedTryCount: number = 1;

    /** 51〜99のランダムマップ選出: 現在のセクションID（Math.floor(stageNumber/5)） */
    private _randomMapSectionId: number = -1;
    /** 51〜99のランダムマップ選出: 現セクション内で使用済みのマップ番号 */
    private _usedMapNumbers: Set<number> = new Set();
    /** 51〜99のランダムマップ選出: 直前に選ばれたマップ番号（連続防止用） */
    private _lastRandomMap: number = -1;

    /** 現在のステージで実際に使用するマップ番号（BaseGridReader がセットする） */
    private _resolvedMapNumber: number = 1;

    private constructor() {}

    static get instance(): StageCreationManager {
        if (!this._instance) this._instance = new StageCreationManager();
        return this._instance;
    }

    // ─── 他クラスへ渡すもの ───────────────────────────────────

    /** 現在のステージ数 */
    get stageNumber(): number {
        return this._stageNumber;
    }

    /** 直前のステージ数（アニメーション開始値用） */
    get previousStageNumber(): number {
        return this._previousStageNumber;
    }

    /** 前ステージから引き継ぐ残敵の配列（コピーを返す） */
    get remainingEnemies(): Enemy[] {
        return [...this._remainingEnemies];
    }

    /** 現在の挑戦回数 */
    get tryCount(): number {
        return this._tryCount;
    }

    /** 直前の挑戦回数（アニメーション開始値用） */
    get previousTryCount(): number {
        return this._previousTryCount;
    }

    /** 直前のバトル結果（初回は null） */
    get lastResult(): BattleResult | null {
        return this._lastResult;
    }

    /** 現在のステージで実際に使用しているマップ番号（1〜50） */
    get resolvedMapNumber(): number {
        return this._resolvedMapNumber;
    }

    /** BaseGridReader がステージキー解決後に呼ぶ */
    setResolvedMapNumber(n: number): void {
        this._resolvedMapNumber = n;
    }

    // ─── 他クラスから受け取るもの ─────────────────────────────

    /**
     * select モード用: プレイするステージ番号をセット
     * reset() より前に呼ぶこと
     */
    setSelectedStageNumber(n: number): void {
        this._selectedStageNumber = n;
    }

    /**
     * select モード用: 挑戦回数をセット
     * reset() より前に呼ぶこと
     */
    setSelectedTryCount(n: number): void {
        this._selectedTryCount = n;
    }

    /**
     * バトル終了時に勝敗と残敵を受け取る
     * @param result   勝利 or 敗北
     * @param survivors バトル終了時点で残った敵の配列
     */
    receiveResult(result: BattleResult, survivors: Enemy[]): void {
        this._remainingEnemies = [...survivors];
        this._previousStageNumber = this._stageNumber;
        this._previousTryCount = this._tryCount;
        this._lastResult = result;

        if (result === 'win') {
            const info = GAMEMODE_INFO[GameModeManager.instance.currentMode];
            // select モードはステージ固定（プレイヤーが選んだステージを繰り返す）
            if (typeof info.stageNumber === 'number' && this._stageNumber < info.stageNumber) {
                this._stageNumber++;
            }
        } else {
            this._tryCount--;
        }
    }

    /** TryCountUpシーンからの呼び出しで挑戦回数を+1 */
    receiveTryCount(): void {
        this._previousTryCount = this._tryCount;
        this._tryCount++;
    }

    // ─── ユーティリティ ───────────────────────────────────────

    /**
     * ステージ51〜99の非5の倍数ステージ用: 1〜50からランダムにマップ番号を返す。
     * - 同一セクション内（直近の5の倍数ステージをまたぐまで）は重複しない
     * - セクションをまたいでも直前と同じ番号は選ばない
     */
    resolveRandomMapNumber(stageNumber: number): number {
        const sectionId = Math.floor(stageNumber / 5);

        if (sectionId !== this._randomMapSectionId) {
            // 新しいセクションに入ったら使用済みをリセット
            this._usedMapNumbers = new Set();
            this._randomMapSectionId = sectionId;
        }

        // 候補: 1〜50 のうち使用済みでなく、かつ直前と異なる
        let pool: number[] = [];
        for (let i = 1; i <= 50; i++) {
            if (!this._usedMapNumbers.has(i) && i !== this._lastRandomMap) {
                pool.push(i);
            }
        }

        // フォールバック: lastRandomMap の制約のみ外す（理論上到達しないが安全のため）
        if (pool.length === 0) {
            pool = Array.from({ length: 50 }, (_, i) => i + 1)
                .filter(i => !this._usedMapNumbers.has(i));
        }

        const picked = pool[Math.floor(Math.random() * pool.length)];
        this._usedMapNumbers.add(picked);
        this._lastRandomMap = picked;
        return picked;
    }

    /** DEBUG: ステージ番号を直接書き換える（デバッグボタン専用）。previousStageNumber は n-1 にセットしてカウントアップ演出が機能するようにする */
    debugSetStageNumber(n: number): void {
        this._previousStageNumber = n - 1;
        this._stageNumber = n;
    }

    /** ゲームを最初から始める際にリセット */
    reset(): void {
        const info = GAMEMODE_INFO[GameModeManager.instance.currentMode];
        const initStage = info.stageNumber === 'select' ? this._selectedStageNumber : 1;
        const initTry   = typeof info.TryCount === 'number' ? info.TryCount : this._selectedTryCount;

        this._stageNumber = initStage;
        this._previousStageNumber = 0;
        this._remainingEnemies = [];
        this._tryCount = initTry;
        this._previousTryCount = initTry;
        this._lastResult = null;
        this._randomMapSectionId = -1;
        this._usedMapNumbers = new Set();
        this._lastRandomMap = -1;
    }
}
