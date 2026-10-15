export const AI_LEVEL = {
    Level_1: 1,
    Level_2: 2,
    Level_3: 3,
    Level_4: 4,
    Level_5: 5,
} as const;

export type AI_LEVEL = typeof AI_LEVEL[keyof typeof AI_LEVEL];

export const SHOT_RESERVE_BY_LEVEL: Record<AI_LEVEL, number> = {
    1: 3,
    2: 2,
    3: 1,
    4: 0,
    5: 0,
};

/** 車体旋回速度（rad/s）。レベルが高いほど速い */
export const BODY_ROTATION_SPEED_BY_LEVEL: Record<AI_LEVEL, number> = {
    1: Math.PI * 2 / 0.600,   // 1回転 0.6 秒
    2: Math.PI * 2 / 0.475,   // 1回転 0.475 秒
    3: Math.PI * 2 / 0.350,   // 1回転 0.35 秒
    4: Math.PI * 2 / 0.225,   // 1回転 0.225 秒
    5: Math.PI * 2 / 0.100,   // 1回転 0.1 秒
};

/** 移動速度倍率（ペナルティ発動時の値）。レベルが低いほど遅い */
export const MOVE_SPEED_MULTIPLIER_BY_LEVEL: Record<AI_LEVEL, number> = {
    1: 0.60,
    2: 0.70,
    3: 0.85,
    4: 1.00,
    5: 1.00,
};


/** 危険弾への回避行動が発動する確率。レベルが低いほど低い */
export const DODGE_CHANCE_BY_LEVEL: Record<AI_LEVEL, number> = {
    1: 0.10,
    2: 0.35,
    3: 0.65,
    4: 0.90,
    5: 1.00,
};

/** 照準ジャミングの最大偏角（rad）。レベルが低いほど大きい */
export const AIM_JITTER_BY_LEVEL: Record<AI_LEVEL, number> = {
    1: 0.35,   // ~20°
    2: 0.22,   // ~12.5°
    3: 0.10,   // ~6°
    4: 0.03,   // ~1.7°
    5: 0.00,   // ジャミングなし
};


/** 照準リロード時間の倍率（ペナルティ発動時の値）。レベルが低いほど長くなる */
export const TARGETING_RELOAD_MULTIPLIER_BY_LEVEL: Record<AI_LEVEL, number> = {
    1: 2.0,
    2: 1.6,
    3: 1.2,
    4: 1.0,
    5: 1.0,
};


/** Fan パターンが使用できる確率。レベルが低いほど低い */
export const FAN_CHANCE_BY_LEVEL: Record<AI_LEVEL, number> = {
    1: 0.00,
    2: 0.05,
    3: 0.60,
    4: 0.85,
    5: 1.00,
};