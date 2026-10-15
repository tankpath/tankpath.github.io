// 当たった時

export class OnHit {
    private onDestroyCallback: () => void;
    private _destroyed = false;

    constructor(onDestroy: () => void) {
        this.onDestroyCallback = onDestroy;
    }

    /** 被弾時に呼ぶ（1ヒット即破壊）。2回目以降の呼び出しは無視する。 */
    hit(): void {
        if (this._destroyed) return;
        this._destroyed = true;
        this.onDestroyCallback();
    }
}
