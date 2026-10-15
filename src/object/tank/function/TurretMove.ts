// タンクのタレットの挙動　砲塔回転
import * as THREE from 'three';

/** GLB モデル内の砲塔ノード名（アセット側の名前に合わせて調整すること） */
const TURRET_NODE_NAME = 'Tank_Body_Up';
/** GLB モデル内の砲口マーカーノード名。このノードを砲塔の子に配置することで弾の発射位置が正確になる */
const MUZZLE_NODE_NAME = 'MuzzlePoint';

export class TurretMove {
    private turret:  THREE.Object3D | null;
    private _muzzle: THREE.Object3D | null; // MuzzlePoint ノードキャッシュ
    private _targetAngle = 0;
    private _isRotating  = false;
    private readonly rotationSpeed: number;
    private readonly _angleOffset:  number;

    // getWorldPosition の戻り値を再利用するキャッシュ
    private readonly _worldPosCache:  THREE.Vector3 = new THREE.Vector3();
    private readonly _muzzlePosCache: THREE.Vector3 = new THREE.Vector3();

    constructor(model: THREE.Object3D, rotationSpeed: number, angleOffset = Math.PI / 2) {
        this.turret        = model.getObjectByName(TURRET_NODE_NAME) ?? null;
        this._muzzle       = this.turret?.getObjectByName(MUZZLE_NODE_NAME) ?? null;
        this.rotationSpeed = rotationSpeed;
        this._angleOffset  = angleOffset;
    }

    /** 砲塔の目標角度を設定する（ラジアン、ワールド Y 軸基準） */
    rotateTo(radians: number): void {
        if (!this.turret) return;
        this.turret.rotation.order = 'YXZ';
        this._targetAngle = radians + this._angleOffset;
    }

    /** 毎フレーム呼び出し：目標角度へ向けて一定速度で回転させる */
    update(delta: number): void {
        if (!this.turret) return;
        const current = this.turret.rotation.y;
        // [-π, π] に正規化した差分（JS の % は負値を返すため +3π してから再度 % をとる）
        const raw  = this._targetAngle - current;
        let diff = ((raw % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        if (Math.abs(diff) <= 1e-4) {
            this._isRotating = false;
            return;
        }
        const maxStep = this.rotationSpeed * delta;
        this.turret.rotation.y = Math.abs(diff) <= maxStep
            ? this._targetAngle
            : current + Math.sign(diff) * maxStep;
        this._isRotating = true;
    }

    /** 砲塔が目標角度へ向かって回転中か */
    get isRotating(): boolean {
        return this._isRotating;
    }

    get angle(): number {
        return this.turret?.rotation.y ?? 0;
    }

    /** モデルごとの砲塔角度オフセット（rotateTo で加算される値） */
    get angleOffset(): number {
        return this._angleOffset;
    }

    /** 砲塔ノードのワールド座標（キャッシュを再利用） */
    get worldPosition(): THREE.Vector3 {
        this.turret?.getWorldPosition(this._worldPosCache);
        return this._worldPosCache;
    }

    /**
     * 砲口のワールド座標（キャッシュを再利用）。
     * GLB モデルに MuzzlePoint ノードがあればその位置を返す。
     * ノードが存在しない場合は砲塔中心座標にフォールバックする。
     */
    get muzzleWorldPosition(): THREE.Vector3 {
        if (this._muzzle) {
            this._muzzle.getWorldPosition(this._muzzlePosCache);
            return this._muzzlePosCache;
        }
        return this.worldPosition;
    }
}
