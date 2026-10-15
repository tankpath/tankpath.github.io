// AILevelを決定する

import { AI_LEVEL, type AI_LEVEL as AILevelType } from '../Definition/AILevel';
import { StageCreationManager } from './StageCreationManager';

export class AIManager {
    private static _instance: AIManager;

    /** ステージ70以降に残機>10を一度でも満たしたら true になり、以降 Lv.5 から下がらない */
    private _level5Locked = false;

    private constructor() {}

    static get instance(): AIManager {
        if (!this._instance) this._instance = new AIManager();
        return this._instance;
    }

    /**
     * 現在のステージ数と残機数からAIレベルを決定する。
     *
     * | ステージ  | 残機 > 10 | 残機 ≤ 10 |
     * |-----------|-----------|-----------|
     * | ～20      | Lv.1      | Lv.1      |
     * | 21～50    | Lv.3      | Lv.2      |
     * | 51～69    | Lv.4      | Lv.3      |
     * | 70～      | Lv.5      | Lv.4※    |
     *
     * ※ ステージ70以降に残機>10を一度でも満たした場合は以降 Lv.5 固定
     */
    decideAILevel(): AILevelType {
        const stage = StageCreationManager.instance.stageNumber;
        const lives = StageCreationManager.instance.tryCount;

        if (stage <= 20) return AI_LEVEL.Level_1;
        if (stage <= 50) return lives > 10 ? AI_LEVEL.Level_3 : AI_LEVEL.Level_2;
        if (stage <= 69) return lives > 10 ? AI_LEVEL.Level_4 : AI_LEVEL.Level_3;

        // stage >= 70：残機>10で Lv.5 にロック（一度ロックされると下がらない）
        if (lives > 10) this._level5Locked = true;
        return this._level5Locked ? AI_LEVEL.Level_5 : AI_LEVEL.Level_4;
    }
}
