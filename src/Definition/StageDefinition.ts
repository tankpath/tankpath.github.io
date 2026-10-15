import type { EnemyType } from './EnemyDefinition';

export type Celltype = 'empty' | 'break_wall' | 'wall' | 'penetrate_wall' | 'player' | 'enemy';

export interface GridData {
    cells: Celltype[][];
    /** スロットごとにランダム選出する候補プール。1要素なら全スロット固定 */
    enemyPool: readonly EnemyType[];
    /** 敗北リトライ時に使用する固定タイプ配列。指定がある場合は enemyPool より優先 */
    forcedEnemyTypes?: readonly EnemyType[];
}

/**
 * 各ステージの初登場エネミータイプ定義。
 * Level1 の Solo / Team / Race にのみ適用。
 * 未定義ステージはランダム選出を想定。
 */
export const LEVEL1_FIRST_APPEARANCE: ReadonlyArray<{ stage: number; type: EnemyType }> = [
    { stage: 1,   type: 'detect'     },
    { stage: 2,   type: 'typeA'      },
    { stage: 5,   type: 'missile'    },
    { stage: 8,   type: 'multimine'  },
    { stage: 10,  type: 'typeB'      },
    { stage: 13,  type: 'triangle'   },
    { stage: 15,  type: 'typeC'      },
    { stage: 20,  type: 'camouflage' },
    { stage: 21,  type: 'split'      },
    { stage: 22,  type: 'pentagon'   },
    { stage: 25,  type: 'apmodel'    },
    { stage: 28,  type: 'selectmine' },
    { stage: 35,  type: 'curve'      },
    { stage: 41,  type: 'command'    },
    { stage: 50,  type: 'highspeed'  },
];

/**
 * レベルに関わらず固定の敵タイプを出現させる特定ステージの定義。
 * ステージ60・70・100はどのレベル・モードでもこのタイプのみ出現する。
 */
export const STAGE_FIXED_ENEMIES: ReadonlyMap<number, EnemyType> = new Map<number, EnemyType>([
    [60,  'destroy'  ],
    [70,  'squadron' ],
    [100, 'godofall' ],
]);

/**
 * ステージ範囲ごとのランダム選出候補プール。
 * STAGE_ENEMY_TYPES で固定されていないステージはここから抽選する。
 */
export const STAGE_ENEMY_POOLS: ReadonlyArray<{
    from: number;
    to: number;
    pool: readonly EnemyType[];
}> = [
    {
        from: 42, to: 49,
        pool: ['typeC', 'split', 'pentagon', 'apmodel', 'selectmine', 'curve', 'command'],
    },
];

/** 指定ステージ番号までに初登場済みの敵タイプ一覧 */
export function getUnlockedEnemyTypes(stageNumber: number): EnemyType[] {
    return LEVEL1_FIRST_APPEARANCE
        .filter(({ stage }) => stage <= stageNumber)
        .map(({ type }) => type);
}

/** ステージキー → 敵タイプ（Level1 の Solo / Team / Race のみ） */
export const STAGE_ENEMY_TYPES: Record<string, EnemyType> = (() => {
    const map: Record<string, EnemyType> = {};
    const modes = ['Solo', 'Team', 'Race'] as const;
    for (const { stage, type } of LEVEL1_FIRST_APPEARANCE) {
        for (const mode of modes) {
            map[`${stage}_Level1_${mode}`] = type;
        }
    }
    return map;
})();
