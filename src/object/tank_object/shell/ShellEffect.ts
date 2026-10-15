import * as THREE from 'three';
import type { ShellType } from '../../../Definition/ShellDefinition';
import { SHELL_STATS } from '../../../Definition/ShellDefinition';

// ─── パーティクル設定 ─────────────────────────────────────────
const MAX_PARTICLES      = 300;
const EMIT_DISTANCE      = 0.03;  // この距離ごとに放出（短くして高密度）
const PARTICLES_PER_EMIT = 3;     // 1放出点あたりの個数（正面からも密に見える）
const PARTICLE_LIFETIME  = 0.4;   // 秒
const BACK_DRIFT         = 0.5;   // 後方へのドリフト速度（units/sec）
const UP_DRIFT           = 0.08;  // 煙の上昇速度（球状拡散に合わせて小さめ）
const SPREAD             = 0.12;  // XYZ 均等拡散（球状にして角度依存をなくす）
const PARTICLE_SIZE_MULT = 1.5;   // パーティクルサイズ倍率（球径に対する倍数）

// ─── Bloom 設定 ───────────────────────────────────────────────
const BLOOM_CORE_INTENSITY     = 0.25;  // Shell_Core emissiveIntensity（強く光る）
const BLOOM_RING_INTENSITY     = 2.5;  // Energy_Ring emissiveIntensity
const BLOOM_PARTICLE_SCALE     = 0.8;  // パーティクルカラー HDR 倍率（>1 で Bloom に乗る）

// ─── リム（外殻）設定 ─────────────────────────────────────────
const RIM_SCALE   = 1.3;   // コアに対する拡大倍率（大きいほど太い輪郭）
const RIM_OPACITY = 0.75;  // 外殻の不透明度

// ─── Wave エフェクト設定 ───────────────────────────────────────
const WAVE_ORBIT_SPEED = Math.PI * 4;  // 軌道角速度（rad/秒）= 2 回転/秒

export class ShellEffect {
    private readonly object:       THREE.Object3D;
    private readonly smokeEmitter: THREE.Object3D | null;

    // パーティクルバッファ
    private readonly points:    THREE.Points;
    private readonly positions: Float32Array;
    private readonly colors:    Float32Array;
    private readonly velX:      Float32Array;
    private readonly velY:      Float32Array;
    private readonly velZ:      Float32Array;
    private readonly lifetimes: Float32Array;

    private readonly prevPos: THREE.Vector3;
    private emitAccum = 0;
    private readonly _curPosCache:    THREE.Vector3 = new THREE.Vector3();
    private readonly _localOffsetCache: THREE.Vector3 = new THREE.Vector3();

    private readonly baseR: number;
    private readonly baseG: number;
    private readonly baseB: number;

    private rimMaterial: THREE.MeshStandardMaterial | null = null;

    // Wave エフェクト用（当たり判定に影響しないようシーン直下に配置）
    private readonly waveOrbiters:    THREE.Mesh[] | null = null;
    private readonly waveOrbitR:      number = 0;
    private _orbitAngle = 0;
    private readonly orbiterPrevPos:  THREE.Vector3[] = [];
    private readonly orbiterEmitAccum: number[] = [];

    constructor(object: THREE.Object3D, shellType: ShellType) {
        this.object  = object;

        const stats  = SHELL_STATS[shellType];
        const isWave = stats.effect === 'Wave';

        // Wave エフェクト用：Shell_Core の半サイズ（デフォルト値）
        let waveCoreHalfSize = 0.045;

        // ─── メッシュへの着色 & Smoke-Emitter 探索 ────────────
        let smokeEmitter: THREE.Object3D | null = null;
        object.traverse((child) => {
            if (child.name === 'Smoke_Emitter') {
                smokeEmitter = child;
            }
            if (!(child instanceof THREE.Mesh)) return;

            if (child.name === 'Shell_Core') {
                if (isWave) {
                    // Wave: コアメッシュのローカルサイズを取得して非表示にする
                    const geom = child.geometry as THREE.BufferGeometry;
                    if (!geom.boundingBox) geom.computeBoundingBox();
                    if (geom.boundingBox) {
                        const sz = geom.boundingBox.getSize(new THREE.Vector3());
                        waveCoreHalfSize = Math.max(sz.x, sz.y, sz.z) * 0.5;
                    }
                    child.visible = false;
                } else {
                    child.material = ShellEffect.tintMaterial(
                        child.material, stats.coreColor, BLOOM_CORE_INTENSITY,
                    );
                    // aroundColor のリム（外殻）を BackSide で重ねて輪郭をはっきりさせる
                    const rimMat = new THREE.MeshStandardMaterial({
                        color:             new THREE.Color(stats.aroundColor),
                        emissive:          new THREE.Color(stats.aroundColor),
                        emissiveIntensity: BLOOM_RING_INTENSITY,
                        transparent:       true,
                        opacity:           RIM_OPACITY,
                        side:              THREE.BackSide,
                        depthWrite:        false,
                    });
                    const rimMesh = new THREE.Mesh(child.geometry, rimMat);
                    rimMesh.scale.setScalar(RIM_SCALE);
                    child.add(rimMesh);
                    this.rimMaterial = rimMat;
                }
            } else if (child.name === 'Energy_Ring') {
                child.material = ShellEffect.tintMaterial(
                    child.material, stats.aroundColor, BLOOM_RING_INTENSITY,
                );
            }
        });
        this.smokeEmitter = smokeEmitter as THREE.Object3D | null;

        // prevPos を Smoke-Emitter のワールド座標で初期化
        // （クロージャ代入後の型縮小を回避するため this.smokeEmitter 経由で参照）
        this.prevPos = this.smokeEmitter !== null
            ? this.smokeEmitter.getWorldPosition(new THREE.Vector3())
            : object.position.clone();

        // ─── Wave: 2 つの衛星メッシュをシーン直下に追加 ──────
        // 当たり判定（Shell.getBoundingBox → setFromObject）に影響しないよう、
        // シェル object の子ではなくシーン（object.parent）に直接追加する。
        if (isWave) {
            const r = waveCoreHalfSize;
            this.waveOrbitR = r;
            const scene = object.parent;
            const orbiters: THREE.Mesh[] = [];
            for (let i = 0; i < 2; i++) {
                const geo = new THREE.SphereGeometry(r, 8, 6);
                const mat = new THREE.MeshStandardMaterial({
                    color:             new THREE.Color(stats.coreColor),
                    emissive:          new THREE.Color(stats.coreColor),
                    emissiveIntensity: BLOOM_CORE_INTENSITY,
                });
                const mesh = new THREE.Mesh(geo, mat);
                // 輪郭リムを追加（ジオメトリを共有）
                const rimMat = new THREE.MeshStandardMaterial({
                    color:             new THREE.Color(stats.aroundColor),
                    emissive:          new THREE.Color(stats.aroundColor),
                    emissiveIntensity: BLOOM_RING_INTENSITY,
                    transparent:       true,
                    opacity:           RIM_OPACITY,
                    side:              THREE.BackSide,
                    depthWrite:        false,
                });
                const rimMesh = new THREE.Mesh(geo, rimMat);
                rimMesh.scale.setScalar(RIM_SCALE);
                mesh.add(rimMesh);
                // 初期位置を設定（update() が呼ばれる前に origin に出現しないよう）
                const initialAngle = i * Math.PI; // _orbitAngle の初期値は 0
                const initialOffset = new THREE.Vector3(
                    Math.cos(initialAngle) * r,
                    0,
                    Math.sin(initialAngle) * r,
                );
                initialOffset.applyQuaternion(object.quaternion);
                mesh.position.copy(object.position).add(initialOffset);
                scene?.add(mesh);
                orbiters.push(mesh);
            }
            this.waveOrbiters = orbiters;
            for (const orbiter of orbiters) {
                this.orbiterPrevPos.push(orbiter.position.clone());
                this.orbiterEmitAccum.push(0);
            }
        }

        // ─── パーティクルシステム構築 ──────────────────────────
        const hex  = stats.aroundColor;
        this.baseR = ((hex >> 16) & 0xff) / 255;
        this.baseG = ((hex >>  8) & 0xff) / 255;
        this.baseB = ( hex        & 0xff) / 255;

        this.positions = new Float32Array(MAX_PARTICLES * 3);
        this.colors    = new Float32Array(MAX_PARTICLES * 3); // 初期値 0 = 不可視
        this.velX      = new Float32Array(MAX_PARTICLES);
        this.velY      = new Float32Array(MAX_PARTICLES);
        this.velZ      = new Float32Array(MAX_PARTICLES);
        this.lifetimes = new Float32Array(MAX_PARTICLES);     // 初期値 0 = 非アクティブ

        // パーティクルサイズをジオメトリのローカル空間から計算する。
        // setFromObject（ワールド空間）は matrixWorld の更新タイミングに依存するため使わない。
        let particleSize = 0.1; // fallback
        if (object instanceof THREE.Mesh) {
            const geom = object.geometry as THREE.BufferGeometry;
            if (!geom.boundingBox) geom.computeBoundingBox();
            if (geom.boundingBox) {
                const localSize = geom.boundingBox.getSize(new THREE.Vector3());
                particleSize = Math.max(localSize.x, localSize.z) * PARTICLE_SIZE_MULT;
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        geometry.setAttribute('color',    new THREE.BufferAttribute(this.colors,    3));

        const material = new THREE.PointsMaterial({
            size:         particleSize,
            vertexColors: true,
            transparent:  true,
            depthWrite:   false,
            blending:     THREE.AdditiveBlending,
        });

        this.points = new THREE.Points(geometry, material);
        // boundingSphere はゼロ初期化で計算されキャッシュされたまま更新されないため、
        // フラスタムカリングを無効化して常に描画する
        this.points.frustumCulled = false;
        // シェルと同じシーン（ワールド空間）に追加
        object.parent?.add(this.points);
    }

    update(delta: number): void {
        // Wave エフェクト：衛星メッシュを弾の進行方向周りに公転させる
        if (this.waveOrbiters !== null) {
            this._orbitAngle += WAVE_ORBIT_SPEED * delta;
            const shellPos  = this.object.position;
            const shellQuat = this.object.quaternion;
            const r = this.waveOrbitR;

            for (let i = 0; i < this.waveOrbiters.length; i++) {
                const angle = this._orbitAngle + i * Math.PI;
                // シェルのローカル XZ 平面（進行方向と直交する面）上の軌道オフセット
                this._localOffsetCache.set(
                    Math.cos(angle) * r,
                    0,
                    Math.sin(angle) * r,
                );
                // シェルのワールド姿勢に合わせてワールド空間へ変換
                this._localOffsetCache.applyQuaternion(shellQuat);
                this.waveOrbiters[i].position.copy(shellPos).add(this._localOffsetCache);
            }
        }

        this.updateParticles(delta);
    }

    /** シェル消滅時に呼ぶ */
    dispose(): void {
        this.rimMaterial?.dispose();
        this.points.removeFromParent();
        (this.points.geometry as THREE.BufferGeometry).dispose();

        // Wave エフェクト衛星を削除・破棄
        if (this.waveOrbiters !== null) {
            for (const mesh of this.waveOrbiters) {
                mesh.removeFromParent();
                (mesh.geometry as THREE.BufferGeometry).dispose();
                (mesh.material as THREE.Material).dispose();
                // リムメッシュのマテリアルを破棄（ジオメトリは親と共有なので破棄しない）
                for (const child of mesh.children) {
                    if (child instanceof THREE.Mesh) {
                        (child.material as THREE.Material).dispose();
                    }
                }
            }
        }
    }

    // ─── パーティクル更新 ────────────────────────────────────────
    private updateParticles(delta: number): void {
        const cur = this.smokeEmitter !== null
            ? this.smokeEmitter.getWorldPosition(this._curPosCache)
            : this._curPosCache.copy(this.object.position);
        const dx   = cur.x - this.prevPos.x;
        const dy   = cur.y - this.prevPos.y;
        const dz   = cur.z - this.prevPos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // 移動距離ベースで放出（高速移動でも煙の密度が一定）
        if (dist > 0.0001) {
            this.emitAccum += dist;
            const numEmit = Math.floor(this.emitAccum / EMIT_DISTANCE);
            this.emitAccum %= EMIT_DISTANCE;

            const nx = dx / dist;
            const ny = dy / dist;
            const nz = dz / dist;

            for (let e = 0; e < numEmit; e++) {
                // 前フレームから現フレームの経路上に補間して放出
                const t  = (e + 0.5) / numEmit;
                const ex = this.prevPos.x + dx * t;
                const ey = this.prevPos.y + dy * t;
                const ez = this.prevPos.z + dz * t;
                // 同一点から複数個放出 → 正面・真横どちらからも密に見える
                for (let p = 0; p < PARTICLES_PER_EMIT; p++) {
                    this.emit(
                        ex, ey, ez,
                        -nx * BACK_DRIFT + this.rnd(),
                        -ny * BACK_DRIFT + UP_DRIFT + this.rnd(),
                        -nz * BACK_DRIFT + this.rnd(),
                    );
                }
            }
        }

        this.prevPos.copy(cur);

        // Wave エフェクト：各衛星からもパーティクルを放出
        if (this.waveOrbiters !== null) {
            for (let oi = 0; oi < this.waveOrbiters.length; oi++) {
                const oPos  = this.waveOrbiters[oi].position;
                const oPrev = this.orbiterPrevPos[oi];
                const odx   = oPos.x - oPrev.x;
                const ody   = oPos.y - oPrev.y;
                const odz   = oPos.z - oPrev.z;
                const odist = Math.sqrt(odx * odx + ody * ody + odz * odz);

                if (odist > 0.0001) {
                    this.orbiterEmitAccum[oi] += odist;
                    const numEmit = Math.floor(this.orbiterEmitAccum[oi] / EMIT_DISTANCE);
                    this.orbiterEmitAccum[oi] %= EMIT_DISTANCE;

                    const onx = odx / odist;
                    const ony = ody / odist;
                    const onz = odz / odist;

                    for (let e = 0; e < numEmit; e++) {
                        const t  = (e + 0.5) / numEmit;
                        const ex = oPrev.x + odx * t;
                        const ey = oPrev.y + ody * t;
                        const ez = oPrev.z + odz * t;
                        for (let p = 0; p < PARTICLES_PER_EMIT; p++) {
                            this.emit(
                                ex, ey, ez,
                                -onx * BACK_DRIFT + this.rnd(),
                                -ony * BACK_DRIFT + UP_DRIFT + this.rnd(),
                                -onz * BACK_DRIFT + this.rnd(),
                            );
                        }
                    }
                }

                oPrev.copy(oPos);
            }
        }

        // 各パーティクルの移動とフェード
        for (let i = 0; i < MAX_PARTICLES; i++) {
            const idx = i * 3;
            if (this.lifetimes[i] <= 0) {
                // 非アクティブ → 加算合成で不可視（黒 = 加算ゼロ）
                this.colors[idx] = this.colors[idx + 1] = this.colors[idx + 2] = 0;
                continue;
            }

            this.lifetimes[i] -= delta;

            this.positions[idx]     += this.velX[i] * delta;
            this.positions[idx + 1] += this.velY[i] * delta;
            this.positions[idx + 2] += this.velZ[i] * delta;

            // 寿命が尽きるほど暗くなる（加算合成なので見た目は透明に近づく）
            // BLOOM_PARTICLE_SCALE > 1 にするとパーティクルが Bloom の閾値を超えて光る
            const fade = Math.max(0, this.lifetimes[i] / PARTICLE_LIFETIME) * BLOOM_PARTICLE_SCALE;
            this.colors[idx]     = this.baseR * fade;
            this.colors[idx + 1] = this.baseG * fade;
            this.colors[idx + 2] = this.baseB * fade;
        }

        const geom = this.points.geometry as THREE.BufferGeometry;
        (geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        (geom.attributes.color    as THREE.BufferAttribute).needsUpdate = true;
    }

    private emit(
        ex: number, ey: number, ez: number,
        vx: number, vy: number, vz: number,
    ): void {
        // 空きスロットを探す
        for (let i = 0; i < MAX_PARTICLES; i++) {
            if (this.lifetimes[i] <= 0) {
                this.writeSlot(i, ex, ey, ez, vx, vy, vz);
                return;
            }
        }
        // プール満杯なら最も寿命が短いスロットを上書き
        let minIdx = 0;
        for (let i = 1; i < MAX_PARTICLES; i++) {
            if (this.lifetimes[i] < this.lifetimes[minIdx]) minIdx = i;
        }
        this.writeSlot(minIdx, ex, ey, ez, vx, vy, vz);
    }

    private writeSlot(
        i: number,
        ex: number, ey: number, ez: number,
        vx: number, vy: number, vz: number,
    ): void {
        const idx = i * 3;
        this.positions[idx]     = ex;
        this.positions[idx + 1] = ey;
        this.positions[idx + 2] = ez;
        this.velX[i]      = vx;
        this.velY[i]      = vy;
        this.velZ[i]      = vz;
        this.lifetimes[i] = PARTICLE_LIFETIME;
    }

    private rnd(): number {
        return (Math.random() - 0.5) * 2 * SPREAD;
    }

    // ─── マテリアル着色ヘルパー ───────────────────────────────────
    private static tintMaterial(
        material:         THREE.Material | THREE.Material[],
        hex:              number,
        emissiveIntensity: number,
    ): THREE.Material | THREE.Material[] {
        const apply = (mat: THREE.Material): THREE.Material => {
            if (!('color' in mat)) return mat;
            const cloned = mat.clone() as THREE.MeshStandardMaterial;
            cloned.color.setHex(hex);
            cloned.emissive.setHex(hex);
            cloned.emissiveIntensity = emissiveIntensity;
            cloned.side = THREE.DoubleSide;
            return cloned;
        };
        return Array.isArray(material) ? material.map(apply) : apply(material);
    }
}
