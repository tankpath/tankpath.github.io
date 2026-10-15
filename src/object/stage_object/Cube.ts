import * as THREE from "three";
import type { ICube } from "./ICube";
import type { CubeInformation } from "./CubeInfomation";
import { OnHit } from "../OnHit";

export class Cube implements ICube {
    readonly object: THREE.Object3D;
    readonly info:   CubeInformation;
    readonly onHit:  OnHit;
    private readonly _fixedBox: THREE.Box3 | null;

    constructor(
        object: THREE.Object3D,
        info:   CubeInformation,
        onDestroy: () => void,
        /** グリッド座標から計算した固定 Box3。指定するとメッシュ由来の計算を使わない */
        fixedBox?: THREE.Box3,
    ) {
        this.object    = object;
        this.info      = info;
        this._fixedBox = fixedBox ?? null;
        this.onHit  = new OnHit(() => {
            this.object.removeFromParent();
            onDestroy();
        });
    }

    getBoundingBox(target = new THREE.Box3()): THREE.Box3 {
        if (this._fixedBox) return target.copy(this._fixedBox);
        return target.setFromObject(this.object);
    }

    getScene(): THREE.Object3D | null {
        return this.object.parent;
    }
}
