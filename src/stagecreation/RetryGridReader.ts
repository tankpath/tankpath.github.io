// ここでは敗北時の読み取り
// 敵のタンクだけ上書き（StageCreationManagerから取得)
import type { IGridReader } from './IGridReader';
import type { GridData } from '../Definition/StageDefinition';
import type { EnemyType } from '../Definition/EnemyDefinition';
import { BaseGridReader } from './BaseGridReader';
import { StageCreationManager } from '../managers/StageCreationManager';

export class RetryGridReader implements IGridReader {
    read(): GridData {
        const base = new BaseGridReader().read();
        const remaining = StageCreationManager.instance.remainingEnemies;
        const survivorCount = remaining.length;
        const forcedEnemyTypes = remaining.map(e => e.type as EnemyType);

        // 敵セルを先頭からsurvivorCount個だけ残し、超えた分はemptyにする
        let enemiesPlaced = 0;
        const cells = base.cells.map(row =>
            row.map(cell => {
                if (cell !== 'enemy') return cell;
                enemiesPlaced++;
                return enemiesPlaced <= survivorCount ? 'enemy' : 'empty';
            })
        );

        return { ...base, cells, forcedEnemyTypes };
    }
}
