import type * as THREE from 'three';

/** 毎フレーム参照する入力状態 */
export interface InputState {
    dx: number;                      // 横方向: -1(左) | 0 | 1(右)
    dz: number;                      // 縦方向: -1(上) | 0 | 1(下)
    aimTarget: THREE.Vector3 | null; // 砲塔が狙うワールド座標
}

/** 入力ソースの共通インターフェース（キーボード・タッチなど） */
export interface InputSource {
    /** 現フレームの入力状態を返す */
    getState(): InputState;
    /** 地雷設置（単発）コールバックを登録する */
    setMineCallback(cb: () => void): void;
    /** 発砲（単発）コールバックを登録する */
    setShootCallback(cb: () => void): void;
    /** イベントリスナーなどを解除する */
    dispose(): void;
}

/** スクリーン座標 → ワールド座標変換関数の型 */
export type ScreenToWorld = (clientX: number, clientY: number) => THREE.Vector3 | null;
