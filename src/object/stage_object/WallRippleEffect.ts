import * as THREE from 'three';

// ─── エフェクト設定 ─────────────────────────────────────────────
const EFFECT_DURATION  = 0.4;   // 秒（波紋の持続時間）
const MAX_RADIUS       = 0.45;  // 最大リング半径（壁面 1×1 の半分弱）
const RING_SEGMENTS    = 48;    // リングの分割数
const Z_OFFSET         = 0.015; // Zファイティング防止オフセット

/**
 * 弾が壁面に衝突したとき、当たった面に波紋を描くエフェクト。
 * break_wall 破壊時・penetrate_wall を除く全壁タイプで使用する。
 */
export class WallRippleEffect {
    private readonly ring:     THREE.Mesh;
    private readonly material: THREE.MeshBasicMaterial;
    private elapsed     = 0;
    private _isComplete = false;

    constructor(
        hitPoint: THREE.Vector3,
        normal:   THREE.Vector3,
        parent:   THREE.Object3D,
    ) {
        // 壁ヒット波紋の固定色（ゲームテーマのブライトブルー）
        const color = new THREE.Color(0x5BBCE8);

        // リングは正規化サイズ（外径 1.0, 内径 0.7）で作成 → scale で拡縮
        const geometry = new THREE.RingGeometry(0.7, 1.0, RING_SEGMENTS);

        this.material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity:     0.9,
            side:        THREE.DoubleSide,
            depthWrite:  false,
            blending:    THREE.AdditiveBlending,
        });

        this.ring = new THREE.Mesh(geometry, this.material);

        // RingGeometry のデフォルト法線は +Z → hitNormal 方向に向ける
        const defaultNormal = new THREE.Vector3(0, 0, 1);
        if (normal.dot(defaultNormal) < -0.9999) {
            // 真逆の場合は X 軸まわりに 180° 回転
            this.ring.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
        } else {
            this.ring.quaternion.setFromUnitVectors(defaultNormal, normal);
        }

        // Zファイティング防止のため法線方向へ微小オフセット
        this.ring.position.copy(hitPoint).addScaledVector(normal, Z_OFFSET);

        // 初期スケールをほぼゼロにして不可視スタート
        this.ring.scale.setScalar(0.001);

        parent.add(this.ring);
    }

    get isComplete(): boolean { return this._isComplete; }

    update(delta: number): void {
        if (this._isComplete) return;

        this.elapsed += delta;
        if (this.elapsed >= EFFECT_DURATION) {
            this._isComplete = true;
            this.dispose();
            return;
        }

        const t = this.elapsed / EFFECT_DURATION;
        // イーズアウト：拡大は速め、フェードは二乗で滑らかに
        this.ring.scale.setScalar(MAX_RADIUS * t);
        this.material.opacity = (1 - t) * (1 - t) * 0.9;
    }

    private dispose(): void {
        this.ring.removeFromParent();
        this.ring.geometry.dispose();
        this.material.dispose();
    }
}
