// src/effects/Immediately.ts
import type { IEffect } from './IEffect';

export class Immediately implements IEffect {
    /**
     * 即時実行：演出を待たずに即座に完了(resolve)を返します。
     */
    async play(changeAction: () => void): Promise<void> {
        console.log("Immediately: 演出なしで即時遷移します");
        // 何も待機せず、即座に Promise が完了した状態にする
        changeAction();
        return Promise.resolve();
    }
}