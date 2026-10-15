// ここでは通常時のステージの読み取り
import type { IGridReader } from './IGridReader';
import type { GridData, Celltype } from '../Definition/StageDefinition';
import { STAGE_ENEMY_TYPES, STAGE_ENEMY_POOLS, getUnlockedEnemyTypes, STAGE_FIXED_ENEMIES } from '../Definition/StageDefinition';
import type { EnemyType } from '../Definition/EnemyDefinition';
import { AssetManager } from '../managers/AssetManager';
import { StageCreationManager } from '../managers/StageCreationManager';
import { GameModeManager } from '../managers/GameModeManager';
import { GameMode } from '../Definition/GameMode';
import { StageAnalyzer } from '../Analyze/StageAnalyzer';

export class BaseGridReader implements IGridReader {
    read(): GridData {
        const stageNumber = StageCreationManager.instance.stageNumber;
        const mode = GameModeManager.instance.currentMode;

        const stageKey = this.buildStageKey(stageNumber, mode);
        const allStages = AssetManager.instance.getJson('stage_data');
        const rawGrid: number[][] = allStages[stageKey];

        const cells: Celltype[][] = rawGrid.map(row =>
            row.map(value => this.toCell(value))
        );

        // ステージ60と70は敵1体のみ生成
        if (stageNumber === 60 || stageNumber === 70) {
            let enemyCount = 0;
            for (let r = 0; r < cells.length; r++) {
                for (let c = 0; c < cells[r].length; c++) {
                    if (cells[r][c] === 'enemy') {
                        if (enemyCount >= 1) cells[r][c] = 'empty';
                        else enemyCount++;
                    }
                }
            }
        }

        const enemyPool = this.resolveEnemyPool(stageNumber, stageKey);
        return { cells, enemyPool };
    }

    // ─── ステージキー構築 ──────────────────────────────────────

    private buildStageKey(stageNumber: number, mode: string): string {
        if (mode === GameMode.Battle) {
            return `${stageNumber}_Battle`;
        }

        // ステージ100は専用マップ（100_Level1_*）を使用
        if (stageNumber === 100) {
            return `100_Level1_${mode}`;
        }

        if (mode === GameMode.Solo || mode === GameMode.Team) {
            const level = this.getLevel(stageNumber);
            const mapNumber = this.resolveMapNumber(stageNumber);
            return `${mapNumber}_Level${level}_${mode}`;
        }

        // Race: Level なし、ステージ固定
        return `${stageNumber}_Level1_${mode}`;
    }

    /**
     * Solo / Team のレベル階層。
     * 1〜50: Level1 / 51〜70: Level2 / 71〜80: Level3 / 81〜100: Level4
     */
    private getLevel(stageNumber: number): number {
        if (stageNumber <= 50) return 1;
        if (stageNumber <= 70) return 2;
        if (stageNumber <= 80) return 3;
        return 4; // 81〜100
    }

    /**
     * マップとして使用するステージ番号を決定する。
     * - ステージ 1〜50: 常に stageNumber そのまま（順番通り保証）
     * - 51〜99 の 5 の倍数ステージ: StageAnalyzer の weakStages[0] を採用
     * - 51〜99 の非5の倍数ステージ: 1〜50 からランダム選出（連続・セクション内重複なし）
     */
    private resolveMapNumber(stageNumber: number): number {
        // 敗北リトライ時は前回選ばれたマップをそのまま使う
        if (StageCreationManager.instance.lastResult === 'lose') {
            return StageCreationManager.instance.resolvedMapNumber;
        }

        let mapNumber = stageNumber;
        if (stageNumber > 50 && stageNumber % 5 === 0) {
            const weak = StageAnalyzer.instance.weakStages;
            if (weak.length > 0) mapNumber = weak[0];
            else mapNumber = StageCreationManager.instance.resolveRandomMapNumber(stageNumber);
        } else if (stageNumber > 50 && stageNumber % 5 !== 0) {
            mapNumber = StageCreationManager.instance.resolveRandomMapNumber(stageNumber);
        }
        StageCreationManager.instance.setResolvedMapNumber(mapNumber);
        return mapNumber;
    }

    // ─── 敵プール解決 ─────────────────────────────────────────

    private resolveEnemyPool(stageNumber: number, stageKey: string): readonly EnemyType[] {
        // レベル問わず固定タイプのステージ（60・70・100）
        const fixedByStage = STAGE_FIXED_ENEMIES.get(stageNumber);
        if (fixedByStage) return [fixedByStage];

        // 固定ステージ（初登場など）は1種のみのプールとして扱う
        const fixedType = STAGE_ENEMY_TYPES[stageKey];
        if (fixedType) return [fixedType];

        // 範囲指定プールがあればそれを使う
        const rangeEntry = STAGE_ENEMY_POOLS.find(({ from, to }) => stageNumber >= from && stageNumber <= to);
        if (rangeEntry) return rangeEntry.pool;

        // それ以外は解禁済みタイプ全体から選出
        // ここは後でランダムから統計的な確率に変更して、プレイヤーたちにあった戦車を選出するようにする
        const unlocked = getUnlockedEnemyTypes(stageNumber);
        return unlocked.length > 0 ? unlocked : ['typeA'];
    }

    private toCell(value: number): Celltype {
        switch (value) {
            case 1: return 'break_wall';
            case 2: return 'wall';
            case 3: return 'penetrate_wall';
            case 5: return 'player';
            case 9: return 'enemy';
            default: return 'empty';
        }
    }
}
