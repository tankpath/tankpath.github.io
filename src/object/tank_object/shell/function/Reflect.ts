// 壁反射
import * as THREE from 'three';

export class Reflect {
    private _remaining: number;

    constructor(reflectCount: number) {
        this._remaining = reflectCount;
    }

    get remaining(): number  { return this._remaining; }
    get canReflect(): boolean { return this._remaining > 0; }

    /**
     * 壁法線に基づいて新しい進行方向を返し、反射回数を1消費する。
     * 呼び出し側は戻り値を motion.direction に代入すること。
     * R = D - 2(D・N)N
     */
    reflect(direction: THREE.Vector3, wallNormal: THREE.Vector3): THREE.Vector3 {
        this._remaining--;
        const n = wallNormal.clone().normalize();
        return direction.clone().sub(n.multiplyScalar(2 * direction.dot(n)));
    }
}
