import type { BattleField } from '../scene/battle/BattleField';

/**
 * BattleFieldを管理するシングルトンクラス
 * StageLoadingで生成したフィールドをBattleへ渡すために使用
 */
export class BattleFieldManager {
    private static instance: BattleFieldManager | null = null;
    private battleField: BattleField | null = null;

    private constructor() {
        // private constructor でインスタンス化を防ぐ
    }

    public static getInstance(): BattleFieldManager {
        if (!BattleFieldManager.instance) {
            BattleFieldManager.instance = new BattleFieldManager();
        }
        return BattleFieldManager.instance;
    }

    /**
     * BattleFieldを設定（StageLoadingから呼ばれる）
     */
    public setBattleField(battleField: BattleField): void {
        this.battleField = battleField;
    }

    /**
     * BattleFieldを取得（Battleから呼ばれる）
     */
    public getBattleField(): BattleField | null {
        return this.battleField;
    }

    /**
     * BattleFieldをクリア
     */
    public clearBattleField(): void {
        if (this.battleField) {
            this.battleField.dispose();
            this.battleField = null;
        }
    }
}
