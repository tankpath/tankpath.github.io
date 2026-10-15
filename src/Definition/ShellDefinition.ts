export type ShellType = 'ShockPulse' | 'ShockPulse_HV' | 'CoreBreaker' | 'CoreBreaker_Spread' | 'CoreBreaker_Spread_Child' | 'ClusterBolt' | 'ClusterBolt_Child';

export const SPEED_RULE = {
    0: 0.9,
    1: 1,
    2: 1.2,
    3: 1.5,
    4: 1.75,
} as const;

export type SpeedRule = keyof typeof SPEED_RULE;

export type ShellEffectType = 'Pulse' | 'Wave'

export interface ShellStats {
    /** 耐久値（回数） */
    breakCount: number;

    /** 速度（ギア） */
    speed: SpeedRule;

    /** 中心の色 */
    coreColor: number;
    /** 周りの色 */
    aroundColor: number;

    /** エフェクト */
    effect: ShellEffectType;

    /** 弾の半径（ワールド単位）。障害物チェック時の当たり判定拡張に使用 */
    radius: number;
}

export const SHELL_STATS: Record<ShellType, ShellStats> = {
    ShockPulse: {
        breakCount: 1,
        speed: 1,
        coreColor: 0xFFD4D4,
        aroundColor: 0xFF2222,
        effect: 'Pulse',
        radius: 0.127,
    },
    ShockPulse_HV: {
        breakCount: 1,
        speed: 3,
        coreColor: 0xD4FFD4,
        aroundColor: 0x22FF22,
        effect: 'Pulse',
        radius: 0.127,
    },
    CoreBreaker: {
        breakCount: 4,
        speed: 4,
        coreColor: 0xD4FFFF,
        aroundColor: 0x00E5FF,
        effect: 'Pulse',
        radius: 0.127,
    },
    CoreBreaker_Spread: {
        breakCount: 4,
        speed: 4,
        coreColor: 0xD4D4FF,
        aroundColor: 0x2222FF,
        effect: 'Wave',
        radius: 0.127,
    },
    CoreBreaker_Spread_Child: {
        breakCount: 4,
        speed: 4,
        coreColor: 0xD4D4FF,
        aroundColor: 0x2222FF,
        effect: 'Pulse',
        radius: 0.127,
    },
    ClusterBolt: {
        breakCount: 2,
        speed: 0,
        coreColor: 0xFFFFAD,
        aroundColor: 0xFFD700,
        effect: 'Wave',
        radius: 0.092,
    },
    ClusterBolt_Child: {
        breakCount: 1,
        speed: 0,
        coreColor: 0xFFFFAD,
        aroundColor: 0xFFD700,
        effect: 'Pulse',
        radius: 0.092,
    },
}