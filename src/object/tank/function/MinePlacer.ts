// 地雷設置
import * as THREE from 'three';
import type { MineType } from '../../../Definition/MineDefinition';
import { SoundManager } from '../../../managers/SoundManager';
import { SE } from '../../../Definition/SoundList';

export class MinePlacer {
    readonly mineType:  MineType;
    readonly maxMines:  number;
    readonly canDetect: boolean;  // 他タンクの地雷を探知できるか

    private readonly factory: ((type: MineType, pos: THREE.Vector3) => void) | null;

    private placedCount = 0;

    constructor(
        mineType:  MineType,
        maxMines:  number,
        canDetect: boolean,
        factory:   ((type: MineType, pos: THREE.Vector3) => void) | null = null,
    ) {
        this.mineType  = mineType;
        this.maxMines  = maxMines;
        this.canDetect = canDetect;
        this.factory   = factory;
    }

    canPlace(): boolean {
        return this.mineType !== 'none' && this.placedCount < this.maxMines;
    }

    /** まだ設置できる残地雷数 */
    get remainingMines(): number { return this.maxMines - this.placedCount; }

    /**
     * 地雷を設置する。設置できない場合は false を返す。
     * factory が注入されていれば Mine オブジェクトを生成して StageObjectManager に登録する。
     */
    place(position: THREE.Vector3): boolean {
        if (!this.canPlace() || !this.factory) return false;
        this.placedCount++;
        this.factory(this.mineType, position.clone());
        SoundManager.instance.playSE(SE.PLACE_MINE);
        return true;
    }

    /** 地雷が除去（爆発）されたときに StageObjectManager 経由で呼ばれる */
    onMineDestroyed(): void {
        if (this.placedCount > 0) this.placedCount--;
    }
}
