export const ChangeSceneEffect = {
    Fade: 0,
    Scan: 1,
    Immediately: 2,
    Fracture: 3
} as const;

export type ChangeSceneEffect = typeof ChangeSceneEffect[keyof typeof ChangeSceneEffect];