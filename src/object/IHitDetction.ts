import * as THREE from 'three';

/** 当たり判定を持つオブジェクトが実装するインターフェース */
export interface IHitDetection {
    getBoundingBox(): THREE.Box3;
}
