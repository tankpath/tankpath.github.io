export type MineType = 'none' | 'wide' | 'select';

/** 地雷設置パターン */
export type MinePlacementPattern = 'negative' | 'positive' | 'passage';

export interface MineStats {
    /** 爆発範囲（半径セル）。タンク侵入トリガーとも兼用。 */
    explosionRange: number;
    /** 爆発時の色 */
    effectColor: number;
    bodyColor: number;
    /** 爆発までの時間 */
    explosionTime: number;
}

export const MINE_STATS: Record<MineType, MineStats> = {
    none: {
        explosionRange: 0,
        effectColor: 0,
        bodyColor: 0,
        explosionTime: 0,
    },
    wide: {
        explosionRange: 2.5,
        effectColor: 0x22FF22,
        bodyColor: 0xFF2222,
        explosionTime: 15,
    },
    select: {
        explosionRange: 1.5,
        effectColor: 0xFFD700,
        bodyColor: 0xFF2222,
        explosionTime: 20,
    },
}

