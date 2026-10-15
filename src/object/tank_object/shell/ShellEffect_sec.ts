import * as THREE from 'three';

// ─── エフェクト設定 ─────────────────────────────────────────────
const DURATION        = 0.5;   // 秒
const MAX_RADIUS      = 0.45;  // 波紋の最大半径（ワールド単位）
const RING_TUBE_R     = 0.012; // トーラスのチューブ半径
const RING_SEGS       = 32;    // トーラスの分割数
const BLOOM_INTENSITY = 2.5;   // 発光強度
const NUM_SPARKS      = 20;    // スパーク粒子数
const SPARK_SPEED     = 0.9;   // スパークの広がり速度（units/sec）
const SPARK_SIZE      = 0.06;  // スパーク粒子サイズ

/**
 * 弾の破壊時エフェクト。
 * 進行方向と垂直な面に波紋（2 つのトーラス）が広がり、
 * 同面上にスパーク粒子が放射状に飛ぶ。
 * StageObjectManager._shellDestructionEffects で管理し、
 * isComplete が true になったら配列から除外する。
 */
export class ShellDestructionEffect {
    private readonly meshes:     THREE.Mesh[];
    private readonly sparkPoints: THREE.Points;
    private readonly sparkPos:   Float32Array;
    private readonly sparkVelX:  Float32Array;
    private readonly sparkVelY:  Float32Array;
    private readonly sparkVelZ:  Float32Array;
    private readonly baseR: number;
    private readonly baseG: number;
    private readonly baseB: number;

    private elapsed     = 0;
    private _isComplete = false;

    /**
     * @param position  破壊位置（ワールド座標）
     * @param direction 弾の進行方向ベクトル（正規化不要）
     * @param color     波紋・スパークの色（0xRRGGBB）
     * @param scene     メッシュを追加する親 Object3D（通常シーン）
     */
    constructor(
        position:  THREE.Vector3,
        direction: THREE.Vector3,
        color:     number,
        scene:     THREE.Object3D,
    ) {
        this.baseR = ((color >> 16) & 0xff) / 255;
        this.baseG = ((color >>  8) & 0xff) / 255;
        this.baseB = ( color        & 0xff) / 255;

        const dir  = direction.clone().normalize();

        // TorusGeometry は XY 平面に作られる（法線 = Z 軸）。
        // Z 軸を弾の進行方向に合わせる回転クォータニオンを計算する。
        const zAxis = new THREE.Vector3(0, 0, 1);
        const quat  = new THREE.Quaternion().setFromUnitVectors(zAxis, dir);

        // ── 波紋トーラス（2 枚） ────────────────────────────────
        // radius=1 + scale で膨張を表現。tube 比率を保って正しいサイズになる。
        const tubeR = RING_TUBE_R / MAX_RADIUS;
        this.meshes = [];
        for (let i = 0; i < 2; i++) {
            const geo = new THREE.TorusGeometry(1, tubeR, 6, RING_SEGS);
            const mat = new THREE.MeshStandardMaterial({
                color:             new THREE.Color(color),
                emissive:          new THREE.Color(color),
                emissiveIntensity: BLOOM_INTENSITY,
                transparent:       true,
                opacity:           1,
                depthWrite:        false,
                blending:          THREE.AdditiveBlending,
                side:              THREE.DoubleSide,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(position);
            mesh.quaternion.copy(quat);
            mesh.scale.setScalar(0.001); // 初期は極小（origin 出現を防ぐ）
            scene.add(mesh);
            this.meshes.push(mesh);
        }

        // ── スパーク粒子 ────────────────────────────────────────
        const N = NUM_SPARKS;
        this.sparkPos  = new Float32Array(N * 3);
        this.sparkVelX = new Float32Array(N);
        this.sparkVelY = new Float32Array(N);
        this.sparkVelZ = new Float32Array(N);

        // direction と直交する 2 つの基底ベクトルを計算
        const worldUp = Math.abs(dir.y) < 0.9
            ? new THREE.Vector3(0, 1, 0)
            : new THREE.Vector3(1, 0, 0);
        const t1 = new THREE.Vector3().crossVectors(dir, worldUp).normalize();
        const t2 = new THREE.Vector3().crossVectors(dir, t1).normalize();

        const sparkColors = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
            const angle = (i / N) * Math.PI * 2;
            const speed = SPARK_SPEED * (0.6 + Math.random() * 0.8);
            const ca = Math.cos(angle), sa = Math.sin(angle);

            this.sparkPos[i * 3]     = position.x;
            this.sparkPos[i * 3 + 1] = position.y;
            this.sparkPos[i * 3 + 2] = position.z;

            // 進行方向と直交する面内で均等放射
            this.sparkVelX[i] = (ca * t1.x + sa * t2.x) * speed;
            this.sparkVelY[i] = (ca * t1.y + sa * t2.y) * speed;
            this.sparkVelZ[i] = (ca * t1.z + sa * t2.z) * speed;

            sparkColors[i * 3]     = this.baseR * BLOOM_INTENSITY;
            sparkColors[i * 3 + 1] = this.baseG * BLOOM_INTENSITY;
            sparkColors[i * 3 + 2] = this.baseB * BLOOM_INTENSITY;
        }

        const sparkGeo = new THREE.BufferGeometry();
        sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3));
        sparkGeo.setAttribute('color',    new THREE.BufferAttribute(sparkColors,   3));
        const sparkMat = new THREE.PointsMaterial({
            size:         SPARK_SIZE,
            vertexColors: true,
            transparent:  true,
            depthWrite:   false,
            blending:     THREE.AdditiveBlending,
        });
        this.sparkPoints = new THREE.Points(sparkGeo, sparkMat);
        this.sparkPoints.frustumCulled = false;
        scene.add(this.sparkPoints);
    }

    get isComplete(): boolean { return this._isComplete; }

    update(delta: number): void {
        if (this._isComplete) return;

        this.elapsed += delta;
        if (this.elapsed >= DURATION) {
            this._isComplete = true;
            this.dispose();
            return;
        }

        const t    = this.elapsed / DURATION;
        const fade = 1 - t;

        // 波紋 0：全期間で膨張
        const s0 = t * MAX_RADIUS;
        this.meshes[0].scale.setScalar(s0);
        (this.meshes[0].material as THREE.MeshStandardMaterial).opacity = fade;

        // 波紋 1：少し遅れて膨張（t=0.15 以降）
        const t1Start = 0.15;
        if (t > t1Start) {
            const t1 = (t - t1Start) / (1 - t1Start);
            this.meshes[1].scale.setScalar(t1 * MAX_RADIUS);
            (this.meshes[1].material as THREE.MeshStandardMaterial).opacity = 1 - t1;
        }

        // スパーク位置更新
        const N = NUM_SPARKS;
        for (let i = 0; i < N; i++) {
            this.sparkPos[i * 3]     += this.sparkVelX[i] * delta;
            this.sparkPos[i * 3 + 1] += this.sparkVelY[i] * delta;
            this.sparkPos[i * 3 + 2] += this.sparkVelZ[i] * delta;
        }

        // スパーク輝度をフェード
        const sparkGeo = this.sparkPoints.geometry as THREE.BufferGeometry;
        const colors   = (sparkGeo.attributes.color as THREE.BufferAttribute).array as Float32Array;
        const intensity = Math.max(0, fade * BLOOM_INTENSITY);
        for (let i = 0; i < N; i++) {
            colors[i * 3]     = this.baseR * intensity;
            colors[i * 3 + 1] = this.baseG * intensity;
            colors[i * 3 + 2] = this.baseB * intensity;
        }
        (sparkGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        (sparkGeo.attributes.color    as THREE.BufferAttribute).needsUpdate = true;
    }

    private dispose(): void {
        for (const mesh of this.meshes) {
            mesh.removeFromParent();
            (mesh.geometry as THREE.BufferGeometry).dispose();
            (mesh.material as THREE.Material).dispose();
        }
        this.sparkPoints.removeFromParent();
        (this.sparkPoints.geometry as THREE.BufferGeometry).dispose();
    }
}
