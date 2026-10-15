import * as THREE from 'three';

// ─── エフェクト設定 ─────────────────────────────────────────────
const EFFECT_DURATION = 0.8;    // 秒（ジャミングの持続時間）
const NUM_PARTICLES   = 200;    // ノイズ粒子数
const PARTICLE_SIZE   = 0.06;   // 粒子サイズ
const SCRAMBLE_RATE   = 0.7;    // 1秒あたり何割の粒子が位置を再ランダム化するか
const FLICKER_HZ      = 30;     // 点滅周波数（Hz）
const DRIFT_SPEED     = 0.5;    // 粒子の緩やかなドリフト速度

/**
 * break_wall 破壊時のジャミングエフェクト。
 * MineEffect を小型化し、1 セル分のキューブに合わせたサイズにしたもの。
 */
export class CubeEffect {
    private readonly points:    THREE.Points;
    private readonly positions: Float32Array;
    private readonly colors:    Float32Array;
    private readonly velX:      Float32Array;
    private readonly velY:      Float32Array;
    private readonly velZ:      Float32Array;

    private readonly center: THREE.Vector3;
    private readonly baseR:  number;
    private readonly baseG:  number;
    private readonly baseB:  number;

    private elapsed     = 0;
    private _isComplete = false;

    constructor(center: THREE.Vector3, parent: THREE.Object3D) {
        this.center = center.clone();

        // break_wall 破壊エフェクト用の固定色（アンバーオレンジ）
        const hex    = 0xC46030;
        this.baseR   = ((hex >> 16) & 0xff) / 255;
        this.baseG   = ((hex >>  8) & 0xff) / 255;
        this.baseB   = ( hex        & 0xff) / 255;

        this.positions = new Float32Array(NUM_PARTICLES * 3);
        this.colors    = new Float32Array(NUM_PARTICLES * 3);
        this.velX      = new Float32Array(NUM_PARTICLES);
        this.velY      = new Float32Array(NUM_PARTICLES);
        this.velZ      = new Float32Array(NUM_PARTICLES);

        for (let i = 0; i < NUM_PARTICLES; i++) {
            this.randomizeParticle(i);
            this.velX[i] = (Math.random() - 0.5) * 2 * DRIFT_SPEED;
            this.velY[i] =  Math.random()         * DRIFT_SPEED * 1.2;
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

        const progress      = this.elapsed / EFFECT_DURATION;
        const fade          = 1 - progress;
        const t             = this.elapsed;
        const flicker       = Math.abs(Math.sin(t * Math.PI * FLICKER_HZ));
        const noise         = Math.abs(Math.sin(t * Math.PI * FLICKER_HZ * 2.3 + 1.1));
        const baseIntensity = (flicker * 0.7 + noise * 0.3) * fade;

        // ジャミングのスクランブル感：一部の粒子を毎フレーム再ランダム化
        const scrambleCount = Math.floor(SCRAMBLE_RATE * NUM_PARTICLES * delta);
        for (let n = 0; n < scrambleCount; n++) {
            const i = Math.floor(Math.random() * NUM_PARTICLES);
            this.randomizeParticle(i);
        }

        for (let i = 0; i < NUM_PARTICLES; i++) {
            const idx = i * 3;

            this.positions[idx]     += this.velX[i] * delta;
            this.positions[idx + 1] += this.velY[i] * delta;
            this.positions[idx + 2] += this.velZ[i] * delta;

            // 色：ベースカラー・ホワイトノイズ・ダークノイズを混在させてジャミング感を出す
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
                // ベースカラー（主信号）
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

    /** 粒子をキューブ内のランダムな位置に配置する（1x1x1 セル想定） */
    private randomizeParticle(i: number): void {
        this.positions[i * 3]     = this.center.x + (Math.random() - 0.5) * 0.9;
        this.positions[i * 3 + 1] = this.center.y + (Math.random() - 0.5) * 0.9;
        this.positions[i * 3 + 2] = this.center.z + (Math.random() - 0.5) * 0.9;
    }

    private dispose(): void {
        this.points.removeFromParent();
        (this.points.geometry as THREE.BufferGeometry).dispose();
    }
}
