import * as THREE from 'three';
import type { Cell } from '../../../master/function/RouteCalculator';

export class Navigator {
    private _route: Cell[] = [];
    private _index = 0;
    private _reached = true;
    private _target = new THREE.Vector3();

    private readonly _cellSize: number;
    /** セル中心への到達判定距離（セルサイズの30%） */
    private readonly _threshold: number;

    constructor(cellSize: number) {
        this._cellSize  = cellSize;
        this._threshold = cellSize * 0.3;
    }

    /** ルートをセットする。毎回インデックスをリセットする */
    setRoute(route: Cell[]): void {
        this._route   = route;
        this._index   = 0;
        this._reached = route.length === 0;
    }

    /** 最終セルに到達済みか */
    get hasReachedGoal(): boolean { return this._reached; }
    get hasRoute(): boolean { return this._route.length > 0; }

    /** デバッグ用：現在のルート全体 */
    get route(): readonly Cell[] { return this._route; }
    /** デバッグ用：現在のウェイポイントインデックス */
    get currentIndex(): number { return this._index; }

    /** MoveBehavior が向かうべき次のセル中心（ワールド座標）。到達済みなら null */
    get currentTarget(): THREE.Vector3 | null {
        if (this._reached || this._index >= this._route.length) return null;
        const c = this._route[this._index];
        this._target.set(
            c.col * this._cellSize + this._cellSize / 2,
            0,
            c.row * this._cellSize + this._cellSize / 2,
        );
        return this._target;
    }

    /** 毎フレーム呼ぶ。到達チェックしてインデックスを進める */
    update(tankPos: THREE.Vector3): void {
        if (this._reached) return;

        const target = this.currentTarget;
        if (!target) { this._reached = true; return; }

        const dx = target.x - tankPos.x;
        const dz = target.z - tankPos.z;
        if (dx * dx + dz * dz <= this._threshold * this._threshold) {
            this._index++;
            if (this._index >= this._route.length) {
                this._reached = true;
            }
        }
    }
}
