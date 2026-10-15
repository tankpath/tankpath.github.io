import * as THREE from 'three';
import type { Tank }  from '../object/tank/Tank';
import { Shell } from '../object/tank_object/shell/Shell';
import type { ICube } from '../object/stage_object/ICube';
import type { Mine }  from '../object/tank_object/mine/Mine';
import { CubeEffect } from '../object/stage_object/CubeEffect';
import { WallRippleEffect } from '../object/stage_object/WallRippleEffect';
import type { ITankEffect } from '../object/tank/TankEffect';
import { ShellDestructionEffect } from '../object/tank_object/shell/ShellEffect_sec';
import { ShellInformation } from '../object/tank_object/shell/ShellInfomation';
import type { ShellType } from '../Definition/ShellDefinition';
import { CurvedMotion } from '../object/tank_object/shell/function/CurvedMotion';

/** 全弾共通の飛行高さ（Shot.ts の SHELL_Y と同値に揃えること） */
const SHELL_Y = 0.5;

// ─── エントリ型 ────────────────────────────────────────────────

export interface BulletEntry {
    readonly id:          string;
    readonly ownerTankId: string;
    /** 分裂弾など弾数カウント対象外の弾の場合 true。removeBullet 時に onBulletDestroyed を呼ばない。 */
    readonly isSplit:     boolean;
    readonly shell:       Shell;
}

export interface MineEntry {
    readonly id:          string;
    readonly ownerTankId: string;
    readonly mine:        Mine;
}

export interface CubeEntry {
    readonly id:   string;
    readonly cube: ICube;
}

// ─── マネージャー本体 ──────────────────────────────────────────

/**
 * ステージ上に存在するオブジェクト（戦車・弾・地雷・壁）を一元管理するシングルトン。
 * 弾数・地雷数の制限チェックはここを経由して行う。
 */
export class StageObjectManager {
    private static _instance: StageObjectManager;

    private _tanks:   Map<string, Tank>        = new Map();
    private _bullets: Map<string, BulletEntry> = new Map();
    private _mines:   Map<string, MineEntry>   = new Map();
    private _cubes:   Map<string, CubeEntry>   = new Map();

    /** isSplit: false の弾のみをカウント（タンクIDごと） */
    private _bulletCounts: Map<string, number> = new Map();
    /** タンクIDごとの設置済み地雷数 */
    private _mineCounts:   Map<string, number> = new Map();

    private _cubeEffects:             CubeEffect[]             = [];
    private _wallRippleEffects:       WallRippleEffect[]       = [];
    private _tankEffects:             ITankEffect[]            = [];
    private _shellDestructionEffects: ShellDestructionEffect[] = [];
    private _cubeChangeCallbacks:     (() => void)[]           = [];

    private _shellFactory: ((type: ShellType) => THREE.Object3D) | null = null;

    private _bulletIdCounter = 0;
    private _mineIdCounter   = 0;
    private _cubeIdCounter   = 0;

    private constructor() {}

    static get instance(): StageObjectManager {
        if (!this._instance) this._instance = new StageObjectManager();
        return this._instance;
    }

    // ─── Shell ファクトリ登録 ──────────────────────────────────

    setShellFactory(factory: (type: ShellType) => THREE.Object3D): void {
        this._shellFactory = factory;
    }

    /**
     * 分裂弾など、タンクの Shot を経由しない弾を直接スポーンする。
     * 弾数カウントには含めない（isSplit: true）。
     * @param immunity    スポーン直後の相殺免疫時間（秒）。デフォルト 0.3。
     * @param ownerTankId 分裂元の弾を撃ったタンクの ID。デフォルト '__split__'。
     */
    spawnShell(type: ShellType, position: THREE.Vector3, direction: THREE.Vector3, immunity = 0.3, ownerTankId = '__split__'): void {
        if (!this._shellFactory) return;
        const id     = this.generateBulletId();
        const object = this._shellFactory(type);
        object.position.copy(position);
        object.position.y = SHELL_Y; // Y を固定
        const info  = new ShellInformation(id, type);
        const shell = new Shell(info, object, direction, 0, () => this.removeBullet(id));
        shell.setImmunity(immunity);  // スポーン直後の弾同士相殺を防ぐ
        this.registerBullet({ id, ownerTankId, isSplit: true, shell });
    }

    /**
     * 曲線軌道で飛ぶ分裂弾をスポーンする（CoreBreaker_Spread 分裂用）。
     * 弾数カウントには含めない（isSplit: true）。
     * @param type         弾種
     * @param position     スポーン位置
     * @param forward      前進方向（単位ベクトル）
     * @param maxLateral   ピーク横変位（ワールド単位。正: 右、負: 左）
     * @param convergeDist 収束までの前進距離（ワールド単位）
     * @param scale        3D オブジェクトのスケール倍率（デフォルト 1）
     * @param ownerTankId  分裂元の弾を撃ったタンクの ID。デフォルト '__split__'。
     */
    spawnCurvedShell(
        type:         ShellType,
        position:     THREE.Vector3,
        forward:      THREE.Vector3,
        maxLateral:   number,
        convergeDist: number,
        scale         = 1,
        immunity      = 0.3,
        ownerTankId   = '__split__',
    ): void {
        if (!this._shellFactory) return;
        const id     = this.generateBulletId();
        const object = this._shellFactory(type);
        object.position.copy(position);
        object.position.y = SHELL_Y; // Y を固定
        if (scale !== 1) object.scale.setScalar(scale);
        const info  = new ShellInformation(id, type);
        const shell = new Shell(info, object, forward, 0, () => this.removeBullet(id));
        shell.setCurvedMotion(new CurvedMotion(object, forward, maxLateral, convergeDist, info.stats.speed));
        shell.setImmunity(immunity);
        this.registerBullet({ id, ownerTankId, isSplit: true, shell });
    }

    // ─── 一意 ID 生成 ─────────────────────────────────────────

    generateBulletId(): string { return `bullet_${this._bulletIdCounter++}`; }
    generateMineId():   string { return `mine_${this._mineIdCounter++}`; }
    generateCubeId():   string { return `cube_${this._cubeIdCounter++}`; }

    // ─── 戦車 ─────────────────────────────────────────────────

    registerTank(tank: Tank): void {
        this._tanks.set(tank.info.id, tank);
    }

    removeTank(tankId: string): void {
        this._tanks.delete(tankId);
    }

    getTank(tankId: string): Tank | undefined {
        return this._tanks.get(tankId);
    }

    get allTanks(): Tank[] { return [...this._tanks.values()]; }

    get aliveTanks(): Tank[] { return this.allTanks.filter(t => t.isAlive); }

    get playerTank(): Tank | undefined {
        return this.allTanks.find(t => t.info.isPlayer);
    }

    get enemyTanks(): Tank[] {
        return this.allTanks.filter(t => !t.info.isPlayer);
    }

    // ─── 弾 ───────────────────────────────────────────────────

    registerBullet(entry: BulletEntry): void {
        this._bullets.set(entry.id, entry);
        if (!entry.isSplit) {
            this._bulletCounts.set(entry.ownerTankId, (this._bulletCounts.get(entry.ownerTankId) ?? 0) + 1);
        }
    }

    /**
     * 弾を除去する。
     * シーンから Object3D を削除し、オーナータンクの Shot.onBulletDestroyed() を呼んで在弾数を戻す。
     */
    removeBullet(bulletId: string): void {
        const entry = this._bullets.get(bulletId);
        if (!entry) return;

        // removeFromParent 前に生成（object.parent がシーンを指している間に呼ぶ）
        const destructionEffect = entry.shell.createDestructionEffect();
        if (destructionEffect) this._shellDestructionEffects.push(destructionEffect);

        entry.shell.object.removeFromParent();
        this._bullets.delete(bulletId);

        if (!entry.isSplit) {
            this._bulletCounts.set(entry.ownerTankId, Math.max(0, (this._bulletCounts.get(entry.ownerTankId) ?? 0) - 1));
            this._tanks.get(entry.ownerTankId)?.shot.onBulletDestroyed();
        }
    }

    getBullet(bulletId: string): BulletEntry | undefined {
        return this._bullets.get(bulletId);
    }

    /** 指定タンクが現在発射中の弾数（isSplit 弾は含まない） */
    getBulletCount(tankId: string): number {
        return this._bulletCounts.get(tankId) ?? 0;
    }

    get allBullets(): BulletEntry[] { return [...this._bullets.values()]; }

    /** 全弾の Shell を直接返す。allBullets.map(b => b.shell) の配列を毎フレーム生成するコストを排除する。 */
    get allShells(): Shell[] {
        const shells: Shell[] = [];
        for (const b of this._bullets.values()) shells.push(b.shell);
        return shells;
    }

    // ─── 地雷 ─────────────────────────────────────────────────

    registerMine(entry: MineEntry): void {
        this._mines.set(entry.id, entry);
        this._mineCounts.set(entry.ownerTankId, (this._mineCounts.get(entry.ownerTankId) ?? 0) + 1);
    }

    /**
     * 地雷を除去する（爆発・解除時に呼ぶ）。
     * Mine.onHit.hit() → onDestroy コールバック → ここが呼ばれる。
     * オーナータンクの MinePlacer.onMineDestroyed() を呼んで設置数を戻す。
     */
    removeMine(mineId: string): void {
        const entry = this._mines.get(mineId);
        if (!entry) return;

        entry.mine.object.removeFromParent();
        this._mines.delete(mineId);

        this._mineCounts.set(entry.ownerTankId, Math.max(0, (this._mineCounts.get(entry.ownerTankId) ?? 0) - 1));
        this._tanks.get(entry.ownerTankId)?.minePlacer.onMineDestroyed();
    }

    getMine(mineId: string): MineEntry | undefined {
        return this._mines.get(mineId);
    }

    /** 指定タンクが現在フィールドに置いている地雷数 */
    getMineCount(tankId: string): number {
        return this._mineCounts.get(tankId) ?? 0;
    }

    get allMines(): MineEntry[] { return [...this._mines.values()]; }

    /** 全地雷の Mine を直接返す。allMines.map(e => e.mine) の配列を毎フレーム生成するコストを排除する。 */
    get allMineObjects(): Mine[] {
        const mines: Mine[] = [];
        for (const m of this._mines.values()) mines.push(m.mine);
        return mines;
    }

    // ─── 壁（Cube） ────────────────────────────────────────────

    /** 壁の追加・削除時に呼ばれるコールバックを登録する（キャッシュ無効化用）。 */
    onCubeChanged(cb: () => void): void {
        this._cubeChangeCallbacks.push(cb);
    }

    registerCube(entry: CubeEntry): void {
        this._cubes.set(entry.id, entry);
        for (const cb of this._cubeChangeCallbacks) cb();
    }

    removeCube(cubeId: string): void {
        this._cubes.delete(cubeId);
        for (const cb of this._cubeChangeCallbacks) cb();
    }

    getCube(cubeId: string): CubeEntry | undefined {
        return this._cubes.get(cubeId);
    }

    get allCubes(): CubeEntry[] { return [...this._cubes.values()]; }

    // ─── キューブエフェクト ────────────────────────────────────

    registerCubeEffect(effect: CubeEffect): void {
        this._cubeEffects.push(effect);
    }

    /** ゲームループから毎フレーム呼ぶ。完了したエフェクトは自動削除する。 */
    updateCubeEffects(delta: number): void {
        for (let i = this._cubeEffects.length - 1; i >= 0; i--) {
            this._cubeEffects[i].update(delta);
            if (this._cubeEffects[i].isComplete) this._cubeEffects.splice(i, 1);
        }
    }

    // ─── 壁波紋エフェクト ──────────────────────────────────────

    registerWallRippleEffect(effect: WallRippleEffect): void {
        this._wallRippleEffects.push(effect);
    }

    /** ゲームループから毎フレーム呼ぶ。完了したエフェクトは自動削除する。 */
    updateWallRippleEffects(delta: number): void {
        for (let i = this._wallRippleEffects.length - 1; i >= 0; i--) {
            this._wallRippleEffects[i].update(delta);
            if (this._wallRippleEffects[i].isComplete) this._wallRippleEffects.splice(i, 1);
        }
    }

    // ─── タンクエフェクト ──────────────────────────────────────

    registerTankEffect(effect: ITankEffect): void {
        this._tankEffects.push(effect);
    }

    /** ゲームループから毎フレーム呼ぶ。完了したエフェクトは自動削除する。 */
    updateTankEffects(delta: number): void {
        for (let i = this._tankEffects.length - 1; i >= 0; i--) {
            this._tankEffects[i].update(delta);
            if (this._tankEffects[i].isComplete) this._tankEffects.splice(i, 1);
        }
    }

    // ─── 弾破壊エフェクト ──────────────────────────────────────

    /** ゲームループから毎フレーム呼ぶ。完了したエフェクトは自動削除する。 */
    updateShellDestructionEffects(delta: number): void {
        for (let i = this._shellDestructionEffects.length - 1; i >= 0; i--) {
            this._shellDestructionEffects[i].update(delta);
            if (this._shellDestructionEffects[i].isComplete) this._shellDestructionEffects.splice(i, 1);
        }
    }

    // ─── リセット ─────────────────────────────────────────────

    /** ステージ開始・終了時に呼んで全オブジェクトを破棄する */
    reset(): void {
        for (const b of this._bullets.values()) b.shell.object.removeFromParent();
        for (const m of this._mines.values())   m.mine.object.removeFromParent();
        for (const c of this._cubes.values())   c.cube.object.removeFromParent();
        this._tanks.clear();
        this._bullets.clear();
        this._mines.clear();
        this._cubes.clear();
        this._bulletCounts.clear();
        this._mineCounts.clear();
        this._cubeEffects             = [];
        this._wallRippleEffects       = [];
        this._tankEffects             = [];
        this._shellDestructionEffects = [];
        // _cubeChangeCallbacks はクリアしない。
        // CollisionSystem などの永続リスナーがステージをまたいで機能し続けるため。
        this._shellFactory    = null;
        this._bulletIdCounter = 0;
        this._mineIdCounter   = 0;
        this._cubeIdCounter   = 0;
    }
}
