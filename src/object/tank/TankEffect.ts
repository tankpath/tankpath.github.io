import * as THREE from 'three';
import { TRANSPAREN_TANK } from '../../Definition/EnemyDefinition';

// ─── 共通インターフェース ─────────────────────────────────────

export interface ITankEffect {
    update(delta: number): void;
    readonly isComplete: boolean;
}

// ─── 判定ヘルパー ──────────────────────────────────────────────

/** タンクタイプが透明車体対象かどうかを返す */
export function isTransparentTankType(type: string): boolean {
    return (TRANSPAREN_TANK as readonly string[]).includes(type);
}

// ─── カモフラージュエフェクト設定 ────────────────────────────

const CAMOUFLAGE_DURATION = 2.5;   // 秒
const NUM_LINES           = 160;   // 線分数
const LINE_LENGTH         = 0.9;   // 線の最大長
const FLICKER_HZ          = 28;    // 点滅周波数（Hz）
const TANK_HALF_W         = 0.75;  // タンク周囲の分布幅（X/Z）
const TANK_HALF_H         = 0.55;  // タンク周囲の分布高さ（Y）
const FADEOUT_START       = 0.65;  // この進行率からフェードアウト開始

/**
 * 透明化カモフラージュエフェクト。
 * ゲームスタート前にタンク周囲を黒い線がバグのように覆い、
 * エフェクト終了後にタンク車体を透明にする。
 */
export class CamouflageEffect implements ITankEffect {
    private readonly lines:      THREE.LineSegments;
    private readonly positions:  Float32Array;
    private readonly center:     THREE.Vector3;
    private readonly tankObject: THREE.Object3D;

    private elapsed     = 0;
    private _isComplete = false;

    constructor(tankObject: THREE.Object3D, scene: THREE.Object3D, tankType?: string) {
        this.tankObject = tankObject;

        this.center = new THREE.Vector3();
        tankObject.getWorldPosition(this.center);
        this.center.y = TANK_HALF_H;

        this.positions = new Float32Array(NUM_LINES * 6);
        this.randomizeAllLines();

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

        const lineColor = tankType === 'camouflage' ? 0xbd0f7d : 0x040404;

        const material = new THREE.LineBasicMaterial({
            color:      lineColor,
            transparent: true,
            opacity:    1,
            depthWrite: false,
        });

        this.lines = new THREE.LineSegments(geometry, material);
        scene.add(this.lines);
    }

    get isComplete(): boolean { return this._isComplete; }

    update(delta: number): void {
        if (this._isComplete) return;

        this.elapsed += delta;
        if (this.elapsed >= CAMOUFLAGE_DURATION) {
            this._isComplete = true;
            this.applyTransparency();
            this.dispose();
            return;
        }

        const progress = this.elapsed / CAMOUFLAGE_DURATION;

        this.tankObject.getWorldPosition(this.center);
        this.center.y = TANK_HALF_H;

        const scrambleCount = Math.floor(NUM_LINES * 0.7);
        for (let i = 0; i < scrambleCount; i++) {
            this.randomizeLine(Math.floor(Math.random() * NUM_LINES));
        }

        this.lines.visible = Math.sin(this.elapsed * Math.PI * FLICKER_HZ) > 0;

        if (progress > FADEOUT_START) {
            const mat = this.lines.material as THREE.LineBasicMaterial;
            mat.opacity = 1 - (progress - FADEOUT_START) / (1 - FADEOUT_START);
        }

        (this.lines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    private randomizeAllLines(): void {
        for (let i = 0; i < NUM_LINES; i++) this.randomizeLine(i);
    }

    private randomizeLine(i: number): void {
        const idx    = i * 6;
        const px     = this.center.x + (Math.random() - 0.5) * TANK_HALF_W * 2;
        const py     = this.center.y + (Math.random() - 0.5) * TANK_HALF_H * 2;
        const pz     = this.center.z + (Math.random() - 0.5) * TANK_HALF_W * 2;
        const len    = Math.random() * LINE_LENGTH;
        const azimuth = Math.random() * Math.PI * 2;
        const elev    = (Math.random() - 0.5) * Math.PI;
        const cosElev = Math.cos(elev);

        this.positions[idx]     = px;
        this.positions[idx + 1] = py;
        this.positions[idx + 2] = pz;
        this.positions[idx + 3] = px + len * cosElev * Math.cos(azimuth);
        this.positions[idx + 4] = py + len * Math.sin(elev);
        this.positions[idx + 5] = pz + len * cosElev * Math.sin(azimuth);
    }

    private applyTransparency(): void {
        this.tankObject.traverse(child => {
            if (!(child instanceof THREE.Mesh)) return;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            for (const mat of mats) {
                mat.transparent = true;
                mat.opacity     = 0;
            }
        });
    }

    private dispose(): void {
        this.lines.removeFromParent();
        this.lines.geometry.dispose();
        (this.lines.material as THREE.LineBasicMaterial).dispose();
    }
}

// ─── 破壊エフェクト設定 ──────────────────────────────────────

const DESTRUCTION_DURATION = 1.5;   // 秒
const NUM_PARTICLES        = 110;   // パーティクル数（CPU負荷軽減のため削減）
const PARTICLE_SIZE        = 0.09;  // パーティクルサイズ
const BURST_SPEED          = 3.0;   // 放出速度
const GRAVITY              = 2.5;   // 重力加速度

// ゲームのデジタル系カラーパレット（BattleField の PALETTE に合わせる）
const D_PALETTE: [number, number, number][] = [
    [0x76 / 255, 0xc8 / 255, 0xde / 255], // CYAN_MED
    [0x5B / 255, 0xBC / 255, 0xE8 / 255], // BRIGHT_BLUE
    [0xd8 / 255, 0xf5 / 255, 0xfb / 255], // GLOW_WHITE
    [0x38 / 255, 0x7B / 255, 0x94 / 255], // STEEL_BLUE
    [0x51 / 255, 0x6f / 255, 0x6f / 255], // DEEP_AQUA
];

/**
 * 破壊エフェクト。
 * タンクが破壊されたときにデジタルチックなフェードアウト演出を行う。
 * パーティクルが弾け飛び、タンク本体がデジタル溶解した後にシーンから除去する。
 * エフェクト完了後に onRemove を呼んで 3D オブジェクトをシーンから除去する。
 */
export class DestructionEffect implements ITankEffect {
    private readonly points:      THREE.Points;
    private readonly positions:   Float32Array;
    private readonly velocities:  Float32Array;
    private readonly onRemove:    () => void;
    /** traverse を毎フレーム呼ばないようにコンストラクタで一度だけ収集 */
    private readonly _meshes:     THREE.Mesh[];

    private elapsed        = 0;
    private _isComplete    = false;
    private _dissolveFrame = 0; // 溶解更新を間引くフレームカウンタ

    constructor(tankObject: THREE.Object3D, scene: THREE.Object3D, onRemove: () => void) {
        this.onRemove   = onRemove;

        // メッシュ一覧をキャッシュ（update() での traverse を排除）
        this._meshes = [];
        tankObject.traverse(child => {
            if (child instanceof THREE.Mesh) this._meshes.push(child);
        });

        const center = new THREE.Vector3();
        tankObject.getWorldPosition(center);
        center.y = 0.5;

        this.positions  = new Float32Array(NUM_PARTICLES * 3);
        this.velocities = new Float32Array(NUM_PARTICLES * 3);
        const colors    = new Float32Array(NUM_PARTICLES * 3);

        for (let i = 0; i < NUM_PARTICLES; i++) {
            const i3 = i * 3;

            // 発生位置：タンク内部の微小ランダム
            this.positions[i3]     = center.x + (Math.random() - 0.5) * 0.4;
            this.positions[i3 + 1] = center.y + (Math.random() - 0.5) * 0.4;
            this.positions[i3 + 2] = center.z + (Math.random() - 0.5) * 0.4;

            // 放出速度：球状に拡散（垂直成分を抑えてデータ散布感）
            const theta   = Math.random() * Math.PI * 2;
            const phi     = Math.acos(2 * Math.random() - 1);
            const speed   = BURST_SPEED * (0.4 + Math.random() * 0.6);
            this.velocities[i3]     = speed * Math.sin(phi) * Math.cos(theta);
            this.velocities[i3 + 1] = speed * Math.cos(phi) * 0.4;
            this.velocities[i3 + 2] = speed * Math.sin(phi) * Math.sin(theta);

            // カラー：デジタル系パレットからランダム選択
            const c = D_PALETTE[Math.floor(Math.random() * D_PALETTE.length)];
            colors[i3]     = c[0];
            colors[i3 + 1] = c[1];
            colors[i3 + 2] = c[2];
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        geometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size:         PARTICLE_SIZE,
            vertexColors: true,
            transparent:  true,
            opacity:      1,
            depthWrite:   false,
            blending:     THREE.AdditiveBlending,
        });

        this.points = new THREE.Points(geometry, material);
        this.points.frustumCulled = false;
        scene.add(this.points);
    }

    get isComplete(): boolean { return this._isComplete; }

    update(delta: number): void {
        if (this._isComplete) return;

        this.elapsed += delta;
        if (this.elapsed >= DESTRUCTION_DURATION) {
            this._isComplete = true;
            this.dispose();
            return;
        }

        const progress = this.elapsed / DESTRUCTION_DURATION;

        // パーティクル移動 + 重力
        for (let i = 0; i < NUM_PARTICLES; i++) {
            const i3 = i * 3;
            this.positions[i3]     += this.velocities[i3]     * delta;
            this.positions[i3 + 1] += this.velocities[i3 + 1] * delta;
            this.positions[i3 + 2] += this.velocities[i3 + 2] * delta;
            this.velocities[i3 + 1] -= GRAVITY * delta;
        }

        // パーティクルをフェードアウト
        const mat = this.points.material as THREE.PointsMaterial;
        mat.opacity = 1 - progress;

        // タンク本体をデジタル溶解（フリッカーしながら透明化）
        // 視覚的に問題ないため 2 フレームに 1 回だけ更新して CPU 負荷を抑制
        this._dissolveFrame++;
        if (this._dissolveFrame % 2 === 0) {
            this.updateTankDissolve(progress);
        }

        (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    /**
     * デジタル溶解：progress に応じてランダムフリッカーを混ぜながら opacity を下げる。
     * 終盤は完全に不可視にして 3D オブジェクト除去の準備をする。
     */
    private updateTankDissolve(progress: number): void {
        if (progress >= 0.95) {
            for (const mesh of this._meshes) mesh.visible = false;
            return;
        }

        // デジタルノイズ：高周波点滅 + 滑らかなフェードを合成
        const flicker = Math.abs(Math.sin(this.elapsed * Math.PI * 22)) > 0.4 * progress;
        for (const mesh of this._meshes) {
            mesh.visible = flicker || Math.random() > progress;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const mat of mats) {
                mat.transparent = true;
                mat.opacity     = Math.max(0, (1 - progress) * (Math.random() > 0.2 ? 1 : 0.15));
            }
        }
    }

    private dispose(): void {
        for (const mesh of this._meshes) mesh.visible = false;
        this.onRemove();

        this.points.removeFromParent();
        this.points.geometry.dispose();
        (this.points.material as THREE.PointsMaterial).dispose();
    }
}

// ─── 死亡マーク ────────────────────────────────────────────────

const DEATH_MARK_COLOR  = 0xa8b7b7;  // フィールド色(#516f6f)を白(#ffffff)と50%混合
const DEATH_MARK_LENGTH = 1.0;
const DEATH_MARK_WIDTH  = 0.12;
const DEATH_MARK_Y      = 0.01;      // 地面のわずか上に浮かせてZファイティングを回避

/**
 * タンクが破壊された場所にバツ印を地面へ残す。
 * アニメーションなし・永続表示。
 */
export class DeathMark {
    constructor(position: THREE.Vector3, scene: THREE.Object3D) {
        const geo = new THREE.BoxGeometry(DEATH_MARK_WIDTH, 0.02, DEATH_MARK_LENGTH);
        const mat = new THREE.MeshBasicMaterial({ color: DEATH_MARK_COLOR });

        const arm1 = new THREE.Mesh(geo, mat);
        arm1.rotation.y = Math.PI / 4;

        const arm2 = new THREE.Mesh(geo, mat);
        arm2.rotation.y = -Math.PI / 4;

        const group = new THREE.Group();
        group.add(arm1, arm2);
        group.position.set(position.x, DEATH_MARK_Y, position.z);
        scene.add(group);
    }
}

// ─── 虹色発光エフェクト ────────────────────────────────────────

const RAINBOW_CYCLE_SEC = 3.0; // 1周にかかる秒数

/**
 * タンクのマテリアルを虹色に循環発光させる永続エフェクト。
 * godofall 専用。isComplete は常に false。
 */
export class RainbowEffect implements ITankEffect {
    private readonly meshes: THREE.Mesh[] = [];
    private elapsed = 0;

    constructor(tankObject: THREE.Object3D) {
        tankObject.traverse(child => {
            if (child instanceof THREE.Mesh) this.meshes.push(child);
        });
    }

    get isComplete(): boolean { return false; }

    update(delta: number): void {
        this.elapsed += delta;
        const hue = (this.elapsed / RAINBOW_CYCLE_SEC) % 1;
        const color = new THREE.Color().setHSL(hue, 1.0, 0.5);

        for (const mesh of this.meshes) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const mat of mats) {
                if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
                mat.emissive.copy(color);
                mat.emissiveIntensity = 1.2;
            }
        }
    }
}
