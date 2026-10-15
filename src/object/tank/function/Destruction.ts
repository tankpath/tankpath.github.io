// 戦車の破壊動作
import * as THREE from 'three';
import { SoundManager } from '../../../managers/SoundManager';
import { SE } from '../../../Definition/SoundList';

export class Destruction {
    private object: THREE.Object3D;
    private _isDestroyed = false;
    private onDestroyedCallback: (() => void) | null = null;

    /**
     * 破壊時に呼ばれるエフェクト起動関数。
     * onRemove を引数として受け取り、エフェクト完了後に onRemove() を呼んで
     * 3D オブジェクトをシーンから除去する責務を担う。
     * 未設定の場合は即座に除去する。
     */
    private effectStarter: ((onRemove: () => void) => void) | null = null;

    constructor(object: THREE.Object3D) {
        this.object = object;
    }

    get isDestroyed(): boolean { return this._isDestroyed; }

    /** 破壊完了時に呼ばれるコールバックを登録する */
    onDestroyed(callback: () => void): void {
        this.onDestroyedCallback = callback;
    }

    /**
     * 破壊エフェクトの起動関数を登録する。
     * destroy() 時にゲームロジックのコールバック（onDestroyedCallback）は即座に発火するが、
     * 3D オブジェクトのシーン除去はエフェクト完了後に onRemove() 経由で行われる。
     */
    setEffectStarter(fn: (onRemove: () => void) => void): void {
        this.effectStarter = fn;
    }

    /** タンクを破壊済みにする。ゲームロジックは即時処理し、3D除去はエフェクト後に行う。 */
    destroy(): void {
        if (this._isDestroyed) return;
        this._isDestroyed = true;

        SoundManager.instance.playSE(SE.DESTROY_TANK);

        // ゲームロジック（勝敗判定・タンク登録解除）を即座に発火
        this.onDestroyedCallback?.();

        const doRemove = () => this.object.removeFromParent();

        if (this.effectStarter) {
            // エフェクト完了後に 3D オブジェクトを除去
            this.effectStarter(doRemove);
        } else {
            doRemove();
        }
    }
}
