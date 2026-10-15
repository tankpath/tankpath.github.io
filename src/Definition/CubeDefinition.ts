export type CubeType =
  | "wall"
  | "break_wall"
  | "penetrate_wall";

import type { ShellType } from "./ShellDefinition";

export interface CubeStats {
    tankBlocker: boolean;
    shellBlocker: boolean;
    breakBy?: (ShellType | "mine") [];
}

export const CUBE_STATS: Record<CubeType, CubeStats> = {
    break_wall: {
        tankBlocker: true,
        shellBlocker: true,
        breakBy: ['CoreBreaker', 'CoreBreaker_Spread', 'CoreBreaker_Spread_Child', 'mine'],
    },
    wall: {
        tankBlocker: true,
        shellBlocker: true,
        breakBy: [],
    },
    penetrate_wall: {
        tankBlocker: true,
        shellBlocker: false,
        breakBy: [],
    },
}