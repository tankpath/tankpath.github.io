import * as THREE from 'three';
import type { MineStats } from '../../../Definition/MineDefinition';

// ─── エフェクト設定 ─────────────────────────────────────────────
const EFFECT_DURATION     = 1.5;   // 秒（ジャミングの持続時間）
const NUM_PARTICLES       = 600;   // ノイズ粒子数
const PARTICLE_SIZE       = 0.07;  // 粒子サイズ
const SCRAMBLE_RATE       = 0.6;   // 1秒あたり何割の粒子が位置を再ランダム化するか
const FLICKER_HZ          = 25;    // 点滅周波数（Hz）
const DRIFT_SPEED         = 0.4;   // 粒子の緩やかなドリフト速度
const SHOCKWAVE_DURATION  = 0.45;  // 衝撃波リングが最大半径に達するまでの時間（秒）

export class MineEffect {
    private readonly points:     THREE.Points;
    private readonly positions:  Float32Array;
    private readonly colors:     Float32Array;
    private readonly velX:       Float32Array;
    private readonly velY:       Float32Array;
    private readonly velZ:       Float32Array;

    // 爆発範囲可視化：中心から広がる衝撃波リング
    private readonly shockwaveMesh: THREE.Mesh;
    private readonly shockwaveMat:  THREE.MeshBasicMaterial;

    private readonly center: THREE.Vector3;
    private readonly radius: number;

    private readonly baseR: number;
    private readonly baseG: number;
    private readonly baseB: number;

    private elapsed    = 0;
    private _isComplete = false;

    constructor(center: THREE.Vector3, stats: MineStats, parent: THREE.Object3D) {
        this.center = center.clone();
        this.radius = stats.explosionRange;

        const hex    = stats.effectColor;
        this.baseR   = ((hex >> 16) & 0xff) / 255;
        this.baseG   = ((hex >>  8) & 0xff) / 255;
        this.baseB   = ( hex        & 0xff) / 255;

        this.positions = new Float32Array(NUM_PARTICLES * 3);
        this.colors    = new Float32Array(NUM_PARTICLES * 3);
        this.velX      = new Float32Array(NUM_PARTICLES);
        this.velY      = new Float32Array(NUM_PARTICLES);
        this.velZ      = new Float32Array(NUM_PARTICLES);

        // 球体内に一様ランダム初期配置
        for (let i = 0; i < NUM_PARTICLES; i++) {
            this.randomizeParticle(i);
            // 各粒子に緩やかなドリフト速度を与える
            this.velX[i] = (Math.random() - 0.5) * 2 * DRIFT_SPEED;
            this.velY[i] = (Math.random() - 0.5) * 2 * DRIFT_SPEED * 0.3;
            this.velZ[i] = (Math.random() - 0.5) * 2 * DRIFT_SPEED;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        geometry.setAttribute('color',    new THREE.BufferAttribute(this.colors,    3));

        const material = new THREE.PointsMaterial({
            size:         PARTICLE_SIZE,
            vertexColors: true,
            transparent:  true,
            depthWrite:   false,
            blending:     THREE.AdditiveBlending,
        });

        this.points = new THREE.Points(geometry, material);
        this.points.frustumCulled = false;
        parent.add(this.points);

        // ─── 衝撃波リング：爆発範囲を示す拡張リング ───────────────────
        // 半径 1 の単位リングをスケールで拡大する
        this.shockwaveMat = new THREE.MeshBasicMaterial({
            color:       hex,
            transparent: true,
            opacity:     0.9,
            side:        THREE.DoubleSide,
            depthWrite:  false,
        });
        this.shockwaveMesh = new THREE.Mesh(
            new THREE.RingGeometry(0.88, 1.0, 64),
            this.shockwaveMat,
        );
        this.shockwaveMesh.rotation.x = -Math.PI / 2;
        this.shockwaveMesh.position.set(center.x, 0.03, center.z);
        this.shockwaveMesh.scale.setScalar(0);  // 初期スケール 0 → 爆発と同時に広がる
        parent.add(this.shockwaveMesh);
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

        const progress = this.elapsed / EFFECT_DURATION;
        const fade     = 1 - progress;

        // ── 衝撃波リング：SHOCKWAVE_DURATION 秒かけて explosionRange まで拡大し消える ──
        if (this.elapsed <= SHOCKWAVE_DURATION) {
            const sw = this.elapsed / SHOCKWAVE_DURATION;           // 0 → 1
            this.shockwaveMesh.scale.setScalar(this.radius * sw);
            this.shockwaveMat.opacity = 0.9 * (1 - sw);
        } else {
            this.shockwaveMesh.visible = false;
        }

        // 点滅：時間に対するsin波でジャミングらしいフリッカーを作る
        const t       = this.elapsed;
        const flicker = Math.abs(Math.sin(t * Math.PI * FLICKER_HZ));
        // 高周波ノイズを重ねてさらに不規則に
        const noise   = Math.abs(Math.sin(t * Math.PI * FLICKER_HZ * 2.3 + 1.1));
        const baseIntensity = (flicker * 0.7 + noise * 0.3) * fade;

        // 粒子の再ランダム化（ジャミングのスクランブル感）
        const scrambleCount = Math.floor(SCRAMBLE_RATE * NUM_PARTICLES * delta);
        for (let n = 0; n < scrambleCount; n++) {
            const i = Math.floor(Math.random() * NUM_PARTICLES);
            this.randomizeParticle(i);
        }

        for (let i = 0; i < NUM_PARTICLES; i++) {
            const idx = i * 3;

            // 緩やかなドリフト移動
            this.positions[idx]     += this.velX[i] * delta;
            this.positions[idx + 1] += this.velY[i] * delta;
            this.positions[idx + 2] += this.velZ[i] * delta;

            // 色：エフェクトカラー・ホワイトノイズ・暗部ノイズを混在させてジャミング感を出す
            const rnd = Math.random();
            let r: number, g: number, b: number;
            if (rnd < 0.15) {
                // ホワイトノイズ（TV静電気）
                const v = Math.random();
                r = v; g = v; b = v;
            } else if (rnd < 0.22) {
                // ダークノイズ（信号の欠落）
                r = 0; g = 0; b = 0;
            } else if (rnd < 0.28) {
                // 補色ノイズ（信号干渉）
                r = 1 - this.baseR * 0.5;
                g = 1 - this.baseG * 0.5;
                b = 1 - this.baseB * 0.5;
            } else {
                // エフェクトカラー（主信号）
                r = this.baseR;
                g = this.baseG;
                b = this.baseB;
            }

            this.colors[idx]     = r * baseIntensity;
            this.colors[idx + 1] = g * baseIntensity;
            this.colors[idx + 2] = b * baseIntensity;
        }

        const geom = this.points.geometry as THREE.BufferGeometry;
        (geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        (geom.attributes.color    as THREE.BufferAttribute).needsUpdate = true;
    }

    // 粒子を爆発範囲内のランダムな位置に再配置する
    private randomizeParticle(i: number): void {
        const phi   = Math.random() * Math.PI * 2;
        const cosT  = Math.random() * 2 - 1;
        const sinT  = Math.sqrt(1 - cosT * cosT);
        const r     = this.radius * Math.cbrt(Math.random());

        this.positions[i * 3]     = this.center.x + r * sinT * Math.cos(phi);
        this.positions[i * 3 + 1] = this.center.y + 0.5 + r * 0.25;  // 地面付近を中心に平たく分布
        this.positions[i * 3 + 2] = this.center.z + r * sinT * Math.sin(phi);
    }

    private dispose(): void {
        this.points.removeFromParent();
        (this.points.geometry as THREE.BufferGeometry).dispose();

        this.shockwaveMesh.removeFromParent();
        (this.shockwaveMesh.geometry as THREE.BufferGeometry).dispose();
        this.shockwaveMat.dispose();
    }
}
