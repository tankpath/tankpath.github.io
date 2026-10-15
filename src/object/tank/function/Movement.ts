// タンクの移動
import * as THREE from 'three';
import { SPEED_GEAR } from '../../../Definition/TankDefinition';
import type { GearLevel } from '../../../Definition/TankDefinition';

/** GLB モデル内の車体ルートノード名 */
const BODY_ROOT_NODE_NAME = 'Tank_Root';

/** SPEED_GEAR 1.0 あたりの移動速度（セル/秒） */
const BASE_SPEED = 4;

export class Movement {
    /** ワールド位置の管理に使う gltf.scene ルート */
    private readonly _sceneRoot: THREE.Object3D;
    /**
     * 車体の向き（Y 回転）を管理するノード。
     * GLB に Tank_Root があればそれを使い、なければ gltf.scene にフォールバックする。
     * Tank_Root を回転させると Tank_Body_Down / Tank_Body_Up も連動して回転するが、
     * TurretBehavior が毎フレームローカル角を再計算するため砲塔の照準は維持される。
     */
    private readonly _bodyRoot: THREE.Object3D;
    /** 実速度（セル/秒） */
    readonly speed: number;
    private _movedThisFrame = false;

    constructor(object: THREE.Object3D, gear: GearLevel) {
        this._sceneRoot = object;
        this._bodyRoot  = object.getObjectByName(BODY_ROOT_NODE_NAME) ?? object;
        this.speed      = BASE_SPEED * SPEED_GEAR[gear];
    }

    /** 指定方向に delta 秒分だけ移動する（位置は gltf.scene で管理） */
    move(direction: THREE.Vector3, delta: number): void {
        this._movedThisFrame = true;
        this._sceneRoot.position.addScaledVector(direction.normalize(), this.speed * delta);
    }

    /** このフレームに移動したかを返し、フラグをリセットする */
    consumeMovedFlag(): boolean {
        const v = this._movedThisFrame;
        this._movedThisFrame = false;
        return v;
    }

    /** 車体の Y 軸回転を設定する（ラジアン）。Tank_Root を回転させる */
    setRotation(radians: number): void {
        this._bodyRoot.rotation.y = radians;
    }

    get position(): THREE.Vector3 { return this._sceneRoot.position; }
    get rotationY(): number       { return this._bodyRoot.rotation.y; }
}
