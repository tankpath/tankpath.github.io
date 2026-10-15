import type { Enemy } from '../../managers/StageCreationManager';
import { StageObjectManager } from '../../managers/StageObjectManager';

/**
 * バトルの勝敗を管理するクラス。
 * StageObjectManager に登録された各タンクの Destruction コールバックを監視し、
 * 敵全滅 → onWin、プレイヤー撃破 → onLose を呼ぶ。
 * ！！勝敗の条件をモードごとに分ける！！
 */
export class GameMaster {
    private resolved = false;
    private readonly onWin:  ()                    => void;
    private readonly onLose: (survivors: Enemy[]) => void;

    constructor(
        onWin:  ()                    => void,
        onLose: (survivors: Enemy[]) => void,
    ) {
        this.onWin  = onWin;
        this.onLose = onLose;
    }

    /** 全タンクに破壊コールバックを登録して監視を開始する */
    start(): void {
        const mgr = StageObjectManager.instance;

        const player = mgr.playerTank;
        if (player) {
            player.destruction.onDestroyed(() => {
                mgr.removeTank(player.info.id);
                this.handlePlayerDestroyed();
            });
        }

        for (const enemy of mgr.enemyTanks) {
            enemy.destruction.onDestroyed(() => {
                mgr.removeTank(enemy.info.id);
                this.handleEnemyDestroyed();
            });
        }
    }

    /** Battle 離脱時に呼ぶ。未解決のまま unmount されたときにコールバック発火を防ぐ */
    dispose(): void {
        this.resolved = true;
    }

    private handlePlayerDestroyed(): void {
        if (this.resolved) return;
        this.resolved = true;

        const survivors: Enemy[] = StageObjectManager.instance.enemyTanks
            .filter(t => t.isAlive)
            .map(t => ({ id: t.info.id, type: t.info.type }));

        this.onLose(survivors);
    }

    private handleEnemyDestroyed(): void {
        if (this.resolved) return;

        const aliveEnemies = StageObjectManager.instance.enemyTanks.filter(t => t.isAlive);
        if (aliveEnemies.length > 0) return; // まだ残敵あり

        this.resolved = true;
        this.onWin();
    }
}
