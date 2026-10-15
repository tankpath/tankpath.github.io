// 地雷設置の制御

import type { Tank } from '../../../../object/tank/Tank';

export class MineBehavior {
    /** 設置可能であれば現在位置に地雷を設置する */
    tryPlace(tank: Tank): void {
        if (!tank.minePlacer.canPlace()) return;
        tank.placeMine();
    }
}