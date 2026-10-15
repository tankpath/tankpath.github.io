import * as THREE from 'three';
import type { CubeInformation } from './CubeInfomation';
import type { OnHit } from '../OnHit';

/** 壁オブジェクトの共通インターフェース */
export interface ICube {
    readonly object: THREE.Object3D;
    readonly info: CubeInformation;
    readonly onHit: OnHit;
    getBoundingBox(target?: THREE.Box3): THREE.Box3;
    /** 壁ヒット波紋エフェクト用のシーン参照。エフェクト不要な場合は null */
    getScene(): THREE.Object3D | null;
}
