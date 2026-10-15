// sin カーブに沿った曲線運動
import * as THREE from 'three';
import { SPEED_RULE } from '../../../../Definition/ShellDefinition';
import type { SpeedRule } from '../../../../Definition/ShellDefinition';

const SPEED_MULTIPLIER = 5;

/**
 * 弾を sin カーブで飛ばす運動クラス。
 *
 * 軌跡:
 *   前進方向に d、横方向に maxLateral * sin(π * d / convergeDist) だけずれながら進む。
 *   d = convergeDist に到達すると横変位は 0 に戻り（収束）、
 *   それ以降はその時点の接線方向に等速直線で飛び続ける。
 */
export class CurvedMotion {
    private readonly object:       THREE.Object3D;
    private readonly forward:      THREE.Vector3;  // 前進方向（単位ベクトル）
    private readonly lateral:      THREE.Vector3;  // XZ 平面内の横方向（単位ベクトル）
    private readonly origin:       THREE.Vector3;  // スポーン位置
    private readonly speedValue:   number;         // ワールド単位 / 秒
    private readonly maxLateral:   number;         // ピーク横変位（ワールド単位）
    private readonly convergeDist: number;         // 収束距離（ワールド単位）

    private distTraveled = 0;

    // 収束点通過後に使う情報
    private pastConvergence = false;
    private readonly postConvPos = new THREE.Vector3();
    private readonly postConvDir = new THREE.Vector3();

    /**
     * @param object        弾の 3D オブジェクト
     * @param forward       発射方向（単位ベクトル）
     * @param maxLateral    ピーク時の横変位（正: 右、負: 左）
     * @param convergeDist  収束するまでの前進距離（ワールド単位）
     * @param speed         速度ギア（SpeedRule）
     */
    constructor(
        object:       THREE.Object3D,
        forward:      THREE.Vector3,
        maxLateral:   number,
        convergeDist: number,
        speed:        SpeedRule,
    ) {
        this.object       = object;
        this.origin       = object.position.clone();
        this.forward      = forward.clone().normalize();
        this.speedValue   = SPEED_RULE[speed] * SPEED_MULTIPLIER;
        this.maxLateral   = maxLateral;
        this.convergeDist = convergeDist;

        // XZ 平面内で forward と 90° 直交するベクトル
        this.lateral = new THREE.Vector3(-this.forward.z, 0, this.forward.x).normalize();

        // 初期向きをセット
        this._applyOrientation(forward.clone().normalize());
    }

    update(delta: number): void {
        this.distTraveled += this.speedValue * delta;

        // 収束点通過後：記録した直線方向に飛ぶ
        if (this.pastConvergence) {
            this.object.position.copy(
                this.postConvPos.clone()
                    .addScaledVector(this.postConvDir, this.distTraveled - this.convergeDist),
            );
            return;
        }

        const d = this.distTraveled;

        // 収束点到達：接線方向を記録して以降は直線飛行へ切り替え
        if (d >= this.convergeDist) {
            this.pastConvergence = true;

            // 収束点の座標（sin(π) = 0 なので前進軸上）
            this.postConvPos.copy(
                this.origin.clone().addScaledVector(this.forward, this.convergeDist),
            );

            // 収束点での接線横成分：d/dd[maxLateral*sin(π*d/L)] at d=L → -maxLateral*π/L
            const tLat = -this.maxLateral * Math.PI / this.convergeDist;
            this.postConvDir.copy(
                this.forward.clone().addScaledVector(this.lateral, tLat).normalize(),
            );

            this.object.position.copy(this.postConvPos);
            this._applyOrientation(this.postConvDir);
            return;
        }

        // sin カーブ上の位置を計算
        const lateralOffset = this.maxLateral * Math.sin(Math.PI * d / this.convergeDist);
        this.object.position.copy(
            this.origin.clone()
                .addScaledVector(this.forward, d)
                .addScaledVector(this.lateral, lateralOffset),
        );

        // 接線方向（速度方向）を向く
        const tLat = this.maxLateral * Math.PI / this.convergeDist
                   * Math.cos(Math.PI * d / this.convergeDist);
        const dir = this.forward.clone().addScaledVector(this.lateral, tLat);
        if (dir.lengthSq() > 0.0001) {
            this._applyOrientation(dir.normalize());
        }
    }

    private _applyOrientation(dir: THREE.Vector3): void {
        this.object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }
}
