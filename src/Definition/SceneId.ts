export const SceneId = {
    InitialLoading: 1,
    Title: 2,
    StageLoading: 3,
    Battle: 4,
    TryCountUp: 5,
    Result: 6,
    MissionComplete: 7,
    Profile: 8,
    Room: 9
} as const;

export type SceneId = typeof SceneId[keyof typeof SceneId];