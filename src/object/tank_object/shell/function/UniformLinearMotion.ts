// 等速直線運動
import * as THREE from 'three';
import { SPEED_RULE } from '../../../../Definition/ShellDefinition';
import type { SpeedRule } from '../../../../Definition/ShellDefinition';

/** SPEED_RULE の基準値に掛ける倍率。大きくするほど弾が速くなる */
const SPEED_MULTIPLIER = 7;

export class UniformLinearMotion {
    /** 進行方向（反射によって外部から書き換えられる） */
    direction: THREE.Vector3;

    private readonly object: THREE.Object3D;
    private readonly speed:  number;

    constructor(object: THREE.Object3D, direction: THREE.Vector3, speedGear: SpeedRule) {
        this.object    = object;
        this.direction = direction.clone().normalize();
        this.speed     = SPEED_RULE[speedGear] * SPEED_MULTIPLIER;

        // モデルの +Y 軸を進行方向に合わせて寝かせる
        object.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            this.direction,
        );
    }

    /** 反射などで direction を変えた後に呼んで向きを同期する */
    alignToDirection(): void {
        this.object.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            this.direction,
        );
    }

    update(delta: number): void {
        this.object.position.addScaledVector(this.direction, this.speed * delta);
    }
}
