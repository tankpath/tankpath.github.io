export const GameMode = {
    Solo:   'Solo',
    Team:   'Team',
    Race:   'Race',
    Battle: 'Battle',
} as const;

export type GameMode = typeof GameMode[keyof typeof GameMode];

export interface GameModeInfo {
    /** ステージロード画面 */
    SL_onDisplay?: ('StageNum' | 'TryCount' | 'DefeatTankCount' | 'WinCount') [];
    /** バトル画面 */
    BT_onDisplay?: ('my_Shell' | 'my_Mine' | 'EnemyCount' | 'RemaingPlayer') [];
    /** リザルト画面 */
    RL_onDisplay?: ('StageNum' | 'Time' | 'DefeatEnemy' | 'Enemy_Sort' | 'Player_DefeatEnemy' | 'MVP' | 'Winner' | 'Player_DefeatPlayer') [];
    /** ルール */
    TryCount?: (number | 'select');
    isTryUp: boolean;
    stageNumber?: (number | 'select');
    victryTerm?: ('DefeatEnemy' | 'Most_DefeatEnemy' | 'DefeatPlayer');
    useTank?: ('Defalt' | 'Free');
}

export const GAMEMODE_INFO: Record<GameMode, GameModeInfo> = {
    Solo: {
        SL_onDisplay: ['StageNum', 'TryCount'],
        BT_onDisplay: ['my_Shell', 'my_Mine', 'EnemyCount'],
        RL_onDisplay: ['StageNum', 'Time' , 'DefeatEnemy', 'Enemy_Sort'],
        TryCount: 5,
        isTryUp: true,
        stageNumber: 100,
        victryTerm: 'DefeatEnemy',
        useTank: 'Defalt',
    },
    Team: {
        SL_onDisplay: ['StageNum', 'TryCount'],
        BT_onDisplay: ['my_Shell', 'my_Mine', 'EnemyCount'],
        RL_onDisplay: ['StageNum', 'Time' , 'MVP', 'Player_DefeatEnemy'],
        TryCount: 5,
        isTryUp: true,
        stageNumber: 100,
        victryTerm: 'DefeatEnemy',
        useTank: 'Defalt',
    },
    Race: {
        SL_onDisplay: ['DefeatTankCount'],
        BT_onDisplay: ['my_Shell', 'my_Mine', 'EnemyCount'],
        RL_onDisplay: ['Winner', 'Player_DefeatEnemy'],
        TryCount: 'select',
        isTryUp: false,
        stageNumber: 'select',
        victryTerm: 'Most_DefeatEnemy',
        useTank: 'Free',
    },
    Battle: {
        SL_onDisplay: ['WinCount'],
        BT_onDisplay: ['my_Shell', 'my_Mine', 'RemaingPlayer'],
        RL_onDisplay: ['Winner', 'Player_DefeatPlayer'],
        TryCount: 'select',
        isTryUp: false,
        stageNumber: 'select',
        victryTerm: 'DefeatPlayer',
        useTank: 'Free',
    },
}