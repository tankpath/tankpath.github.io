import type { EnemyType } from "./EnemyDefinition";

export type Ratio = number;// 0~1

export type Aiming =
 | 'rapid'
 | 'fan'
 | 'counter'
 | 'sniper';

export interface Nature {
    // 射撃方法（確率重み）
    shootingType: [number, number, number, number],
    // 撃ち方（直撃:0,反射:1）
    shootingMethod: Ratio,
    // プレイヤーとの距離（近:-1,中:0,遠:1）
    fromPlayer: [number, number, number],
}

export const ENEMY_CHARACTERS: Record<EnemyType, Nature> = {
    highspeed: {
        shootingType:[3,2,1,1],
        shootingMethod: 0.5,
        fromPlayer:[1,2,1],
    },
    typeA: {
        shootingType:[1,1,1,1],
        shootingMethod: 0.5,
        fromPlayer:[2,1,1],
    },
    typeB: {
        shootingType:[1,2,1,3],
        shootingMethod: 0.75,
        fromPlayer:[2,1,1],
    },
    typeC: {
        shootingType:[2,2,1,2],
        shootingMethod: 0.75,
        fromPlayer:[1,2,1],
    },
    detect: {
        shootingType:[1,1,3,4],
        shootingMethod: 0.75,
        fromPlayer:[0,0,0],
    },
    command: {
        shootingType:[4,1,1,1],
        shootingMethod:0.5,
        fromPlayer:[0,0,0],
    },
    split: {
        shootingType:[1,2,3,1],
        shootingMethod: 1,
        fromPlayer:[0,1,2],
    },
    triangle: {
        shootingType:[0,0,0,1],
        shootingMethod: 1,
        fromPlayer:[0,0,0],
    },
    pentagon: {
        shootingType:[0,0,0,1],
        shootingMethod: 1,
        fromPlayer:[0,0,0],
    },
    missile: {
        shootingType:[4,1,1,1],
        shootingMethod: 0,
        fromPlayer:[1,2,2],
    },
    curve: {
        shootingType:[2,1,2,2],
        shootingMethod: 0.25,
        fromPlayer:[0,2,0],
    },
    camouflage: {
        shootingType:[1,3,2,3],
        shootingMethod: 0.75,
        fromPlayer:[1,3,0],
    },
    multimine: {
        shootingType:[3,0,2,0],
        shootingMethod: 0,
        fromPlayer:[3,1,0],
    },
    selectmine: {
        shootingType:[1,3,3,3],
        shootingMethod: 1,
        fromPlayer:[0,1,0],
    },
    apmodel: {
        shootingType:[1,0,0,1],
        shootingMethod: 0,
        fromPlayer:[0,2,1],
    },
    destroy: {
        shootingType:[1,0,1,2],
        shootingMethod: 0,
        fromPlayer:[1,3,0],
    },
    squadron: {
        shootingType:[1,0,1,1],
        shootingMethod: 0,
        fromPlayer:[1,5,0]
    },
    godofall: {
        shootingType:[1,1,1,1],
        shootingMethod: 0.5,
        fromPlayer:[1,1,1],
    },
}