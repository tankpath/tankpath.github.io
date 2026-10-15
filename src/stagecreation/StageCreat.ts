// ここで最終的にそれぞれの地形読み取りから配置までを実行する
import { BaseGridReader } from './BaseGridReader';
import { RetryGridReader } from './RetryGridReader';
import { Factory } from './Factory';
import { BattleField } from '../scene/battle/BattleField';
import type { BattleResult } from '../managers/StageCreationManager';
import type { Tank } from '../object/tank/Tank';
import { StageObjectManager } from '../managers/StageObjectManager';
import { EnemyMaster } from '../enemy/master/EnemyMaster';
import { ObservationEquipment } from '../enemy/master/function/ObservationEquipment';

export class StageCreat {
    private battleField: BattleField;

    private _playerTank: Tank | null = null;
    private _enemyTanks: Tank[] = [];

    constructor(battleField: BattleField) {
        this.battleField = battleField;
    }

    build(lastResult: BattleResult | null): void {
        // 前ステージのオブジェクトをクリア
        StageObjectManager.instance.reset();
        EnemyMaster.instance.reset();
        ObservationEquipment.instance.reset();

        const reader = lastResult === 'lose' ? new RetryGridReader() : new BaseGridReader();
        const gridData = reader.read();
        const factory = new Factory(this.battleField.getScene());
        const { player, enemies } = factory.placeObjects(gridData);
        this._playerTank = player;
        this._enemyTanks = enemies;

        // reset() で消えた外壁の当たり判定を再登録
        this.battleField.registerOuterWallCubes();

        // GameMaster が参照できるよう StageObjectManager に登録
        if (player) StageObjectManager.instance.registerTank(player);
        for (const enemy of enemies) StageObjectManager.instance.registerTank(enemy);

        // 敵 AI のセットアップ（EnemyMaster.setup・registerEnemy・Enemy 生成）は
        // Battle.startEnemyAI() で行う。ここでは Tank の登録のみ。
    }

    /** プレイヤーの Tank（未配置の場合は null） */
    get playerTank(): Tank | null { return this._playerTank; }

    /** 敵 Tank の一覧 */
    get enemyTanks(): readonly Tank[] { return this._enemyTanks; }

    /** 生存している敵 Tank の一覧 */
    get aliveEnemies(): Tank[] {
        return this._enemyTanks.filter(t => t.isAlive);
    }
}
