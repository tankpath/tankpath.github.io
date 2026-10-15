// 戦車の弾や弾数などの情報を持つ
import type { TankStats, TankType } from '../../Definition/TankDefinition';
import { isPlayerType } from '../../Definition/TankDefinition';
import { ENEMY_STATS } from '../../Definition/EnemyDefinition';

/** プレイヤーのデフォルトステータス（専用定義が決まるまでの仮設定） */
const PLAYER_DEFAULT_STATS: TankStats = {
    bulletType:    'ShockPulse',
    bulletCount:   5,
    reflectCount:  1,
    reloadTime:    0,
    mineType:      'wide',
    mineCount:     3,
    mineDetection: true,
    speed:                4,
    turretRotationSpeed:  Math.PI * 4,
};

/** タンク1体分の識別情報とステータスをまとめたデータクラス */
export class TankInformation {
    readonly id: string;
    readonly type: TankType;
    readonly isPlayer: boolean;
    readonly stats: TankStats;

    constructor(id: string, type: TankType) {
        this.id       = id;
        this.type     = type;
        this.isPlayer = isPlayerType(type);
        this.stats    = isPlayerType(type) ? PLAYER_DEFAULT_STATS : ENEMY_STATS[type];
    }
}
