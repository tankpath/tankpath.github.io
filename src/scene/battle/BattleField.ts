import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { StageObjectManager } from '../../managers/StageObjectManager';
import { GameModeManager } from '../../managers/GameModeManager';
import { GAMEMODE_INFO } from '../../Definition/GameMode';
import { Cube } from '../../object/stage_object/Cube';
import { CubeInformation } from '../../object/stage_object/CubeInfomation';
import type { Tank } from '../../object/tank/Tank';
import { CollisionSystem } from './CollisionSystem';
import { ObservationEquipment } from '../../enemy/master/function/ObservationEquipment';
import { EnemyMaster } from '../../enemy/master/EnemyMaster';
import { FootPrint, FOOTPRINT_PIXELS_PER_CELL } from '../../object/tank/function/FootPrint';

// ─── Bloom パラメータ ─────────────────────────────────────────
const BLOOM_STRENGTH  = 0.4;  // 光の強さ（大きいほど広がる）
const BLOOM_RADIUS    = 0.4;  // ぼかし半径
const BLOOM_THRESHOLD = 0.3;  // この輝度を超えたピクセルだけ Bloom する

// ─── デジタル感重視のカラーパレット設定 ───
const PALETTE = {
    DARK_BASE:  "#132727",
    DEEP_AQUA:  "#516f6f",
    STEEL_BLUE: "#387B94",
    CYAN_MED:   "#76c8de",
    BRIGHT_BLUE:"#5BBCE8",
    GLOW_WHITE: "#d8f5fb",
    WALL_BLUE:  "#3A6878",
};

// ─── デザイン設定 ───
const THEME = {
    background: PALETTE.DARK_BASE,
    ground:     PALETTE.DEEP_AQUA, 
    grid:       PALETTE.DEEP_AQUA,
    wall:       PALETTE.WALL_BLUE,
    lights: {
        ambient: PALETTE.CYAN_MED,
        direct:  "#ffffff",
    }
};

export interface BattleFieldConfig {
    rows: number;        // 縦のマス数
    cols: number;        // 横のマス数
    cellSize: number;    // 1マスのサイズ
}

export class BattleField {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private composer: EffectComposer;
    private bloomPass!: UnrealBloomPass;
    private config: BattleFieldConfig;
    private animationId: number | null = null;
    private lastTime:    number | null = null;
    private _frozen = false;
    private _paused = false;
    private _onTick: (() => void) | null = null;

    private readonly collision = new CollisionSystem();

    // HUD 要素キャッシュ（attachToContainer で取得）
    private shellEl:  HTMLElement | null = null;
    private mineEl:   HTMLElement | null = null;
    private statusEl: HTMLElement | null = null;

    // 地面 CanvasTexture 関連
    private footprintCtx:     CanvasRenderingContext2D | null = null;
    private footprintTexture: THREE.CanvasTexture | null = null;
    // タンクごとの履帯描画（id → FootPrint）
    private footprints = new Map<string, FootPrint>();

    // 鉛直からの傾き角（度）
    private static readonly TILT_DEG = 33;
    private static readonly FOV = 38;
    /** レンダリングの上限フレームレート */
    private static readonly TARGET_FPS = 60;
    /** AI更新フレームレート（ゲームロジックより低くて十分） */
    private static readonly AI_FRAME_SEC = 1 / 20;

    /** 縦向きモード用ズーム倍率（1.0 = マップ全体表示） */
    private zoomLevel = 1.0;
    private static readonly FRAME_MS = 1000 / BattleField.TARGET_FPS;
    private _aiAccum = 0;

    constructor(
        config: BattleFieldConfig = { rows: 13, cols: 23, cellSize: 1 }
    ) {
        this.config = config;

        // シーンの作成
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(THEME.background);

        // PerspectiveCamera（サイズ・位置はattachToContainerで確定）
        this.camera = new THREE.PerspectiveCamera(BattleField.FOV, 1, 0.1, 1000);
        this.camera.up.set(0, 1, 0);

        // レンダラーの作成（サイズは後で設定）
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(1);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // EffectComposer + Bloom（サイズは attachToContainer で確定）
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        // サイズは attachToContainer → composer.setSize() で正しく設定される
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(1, 1),
            BLOOM_STRENGTH,
            BLOOM_RADIUS,
            BLOOM_THRESHOLD,
        );
        this.composer.addPass(this.bloomPass);

        this.applyGraphicsQuality();

        // フィールドの生成
        this.createField();

        // ライトの追加
        this.addLights();
    }

    // コンテナにアタッチして表示開始
    public attachToContainer(container: HTMLElement): void {
        // HUD 要素を一度だけ取得してキャッシュ（毎フレームの getElementById を排除）
        this.shellEl  = document.getElementById('bc-shell-value');
        this.mineEl   = document.getElementById('bc-mine-value');
        this.statusEl = document.getElementById('bc-status-value');

        const w = container.clientWidth;
        const h = container.clientHeight;
        this.adjustCameraToFitScreen(w, h);
        this.renderer.setSize(w, h);
        this.composer.setSize(w, h);
        this.bloomPass.setSize(Math.ceil(w / 4), Math.ceil(h / 4));
        container.appendChild(this.renderer.domElement);
        document.addEventListener('visibilitychange', this._visibilityHandler);
        this.startAnimation();
    }

    private adjustCameraToFitScreen(width: number, height: number): void {
        const { rows, cols, cellSize } = this.config;
        const screenAspect = width / height;

        const tiltRad = BattleField.TILT_DEG * Math.PI / 180;
        const cosT = Math.cos(tiltRad);
        const sinT = Math.sin(tiltRad);

        // 画面内に収まるために必要なカメラ距離を計算
        const halfVFov = (BattleField.FOV / 2) * Math.PI / 180;
        const halfHFov = Math.atan(Math.tan(halfVFov) * screenAspect);

        const halfW_field = (cols + 2) * cellSize / 2;
        const halfH_field = (rows + 2) * cellSize / 2;
        // 傾きにより手前の壁上端が画面上の最大値になる
        const halfH_view = sinT * cellSize + cosT * halfH_field;

        const distForW = halfW_field / Math.tan(halfHFov);
        const distForH = halfH_view / Math.tan(halfVFov);
        const dist = Math.max(distForW, distForH) * 1.1;

        const centerX = cols * cellSize / 2;
        const centerZ = rows * cellSize / 2;

        this.camera.aspect = screenAspect;
        this.camera.position.set(
            centerX,
            dist * cosT,
            centerZ + dist * sinT
        );
        this.camera.lookAt(centerX, 0, centerZ);
        this.camera.updateProjectionMatrix();
    }

    /**
     * ズーム時にプレイヤーを中心としたカメラ位置へ毎フレーム更新する。
     * zoomLevel > 1.0 のときのみ呼ばれる。
     */
    private updateZoomedCamera(): void {
        const player = StageObjectManager.instance.playerTank;
        const w = this.renderer.domElement.width  / this.renderer.getPixelRatio();
        const h = this.renderer.domElement.height / this.renderer.getPixelRatio();
        const screenAspect = w / h;

        const tiltRad  = BattleField.TILT_DEG * Math.PI / 180;
        const cosT     = Math.cos(tiltRad);
        const sinT     = Math.sin(tiltRad);
        const halfVFov = (BattleField.FOV / 2) * Math.PI / 180;
        const halfHFov = Math.atan(Math.tan(halfVFov) * screenAspect);

        const { rows, cols, cellSize } = this.config;
        const halfW    = (cols + 2) * cellSize / 2;
        const halfH    = sinT * cellSize + cosT * (rows + 2) * cellSize / 2;
        const baseDist = Math.max(halfW / Math.tan(halfHFov), halfH / Math.tan(halfVFov)) * 1.1;
        const dist     = baseDist / this.zoomLevel;

        const focusX = player ? player.movement.position.x : cols * cellSize / 2;
        const focusZ = player ? player.movement.position.z : rows * cellSize / 2;

        this.camera.position.set(focusX, dist * cosT, focusZ + dist * sinT);
        this.camera.lookAt(focusX, 0, focusZ);
        this.camera.updateProjectionMatrix();
    }

    /**
     * カメラのズーム倍率を設定する（1.0 = マップ全体）。
     * ズームが 1.0 に戻った場合はマップ全体を映すカメラ位置に復帰する。
     */
    public setZoom(level: number): void {
        this.zoomLevel = Math.max(1.0, level);
        if (this.zoomLevel <= 1.0) {
            const w = this.renderer.domElement.width  / this.renderer.getPixelRatio();
            const h = this.renderer.domElement.height / this.renderer.getPixelRatio();
            this.adjustCameraToFitScreen(w, h);
        }
    }

    private createField(): void {
        const { rows, cols, cellSize } = this.config;

        // 地面（元の単色マテリアル）
        const groundGeometry = new THREE.PlaneGeometry(cols * cellSize, rows * cellSize);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: THEME.ground,
            side:  THREE.DoubleSide,
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(cols * cellSize / 2, 0, rows * cellSize / 2);
        this.scene.add(ground);

        // 履帯スタンプ用の透明オーバーレイ（地面より僅かに上）
        const ppc     = FOOTPRINT_PIXELS_PER_CELL;
        const canvasW = Math.round(cols * cellSize * ppc);
        const canvasH = Math.round(rows * cellSize * ppc);
        const canvas  = document.createElement('canvas');
        canvas.width  = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d')!;
        // 完全透明で初期化（スタンプのみ描かれる）
        ctx.clearRect(0, 0, canvasW, canvasH);
        this.footprintCtx     = ctx;
        this.footprintTexture = new THREE.CanvasTexture(canvas);

        const overlayGeometry = new THREE.PlaneGeometry(cols * cellSize, rows * cellSize);
        const overlayMaterial = new THREE.MeshBasicMaterial({
            map:        this.footprintTexture,
            transparent: true,
            depthWrite:  false,
            side:        THREE.DoubleSide,
        });
        const overlay = new THREE.Mesh(overlayGeometry, overlayMaterial);
        overlay.rotation.x = -Math.PI / 2;
        overlay.position.set(cols * cellSize / 2, 0.002, rows * cellSize / 2);
        this.scene.add(overlay);

        this.addGridLines();
        this.addWalls();
    }

    private addWalls(): void {
        const { rows, cols, cellSize } = this.config;
        const baseGeometry = new THREE.BoxGeometry(cellSize, cellSize, cellSize);
        const geometries: THREE.BufferGeometry[] = [];

        const collectWall = (col: number, row: number) => {
            const matrix = new THREE.Matrix4().setPosition(
                col * cellSize + cellSize / 2,
                cellSize / 2,
                row * cellSize + cellSize / 2,
            );
            geometries.push(baseGeometry.clone().applyMatrix4(matrix));
        };

        for (let c = -1; c <= cols; c++) {
            collectWall(c, -1);
            collectWall(c, rows);
        }
        for (let r = 0; r < rows; r++) {
            collectWall(-1, r);
            collectWall(cols, r);
        }

        const mergedGeometry = mergeGeometries(geometries);
        const wallMaterial = new THREE.MeshStandardMaterial({ color: THEME.wall });
        this.scene.add(new THREE.Mesh(mergedGeometry, wallMaterial));
    }

    /**
     * 外壁の当たり判定 Cube を StageObjectManager に登録する。
     * 上下左右の 4 枚の大きな壁として登録する。
     * reset() で消えるため、StageCreat.build() から reset() 後に毎回呼ぶこと。
     */
    public registerOuterWallCubes(): void {
        const { rows, cols, cellSize } = this.config;
        const mgr = StageObjectManager.instance;

        const registerWall = (x: number, z: number, w: number, d: number) => {
            // コライダー専用メッシュ：衝突判定にのみ使用するためシーンには追加しない
            const collider = new THREE.Mesh(
                new THREE.BoxGeometry(w, cellSize, d),
                new THREE.MeshStandardMaterial(),
            );
            collider.position.set(x, cellSize / 2, z);

            const id   = mgr.generateCubeId();
            const cube = new Cube(collider, new CubeInformation(id, 'wall'), () => mgr.removeCube(id));
            mgr.registerCube({ id, cube });
        };

        const totalW = (cols + 2) * cellSize;  // 角を含む横幅
        const centerX = cols * cellSize / 2;
        const centerZ = rows * cellSize / 2;

        // 外壁コライダーは内側の面位置を保ちつつ外向きに 3 倍厚にする。
        // 厚さ 1 cell だと高速弾が壁中心を越えた瞬間に法線が反転してトンネリングが
        // 発生するため、中心まで 1.5 cell の距離を確保する。
        // 上壁（z = -1 行）
        registerWall(centerX, -cellSize * 1.5, totalW, cellSize * 3);
        // 下壁（z = rows 行）
        registerWall(centerX, rows * cellSize + cellSize * 1.5, totalW, cellSize * 3);
        // 左壁（x = -1 列、角は上下壁がカバー）
        registerWall(-cellSize * 1.5, centerZ, cellSize * 3, rows * cellSize);
        // 右壁（x = cols 列、角は上下壁がカバー）
        registerWall(cols * cellSize + cellSize * 1.5, centerZ, cellSize * 3, rows * cellSize);
    }

    private addGridLines(): void {
        const { rows, cols, cellSize } = this.config;

        // 全グリッド線の頂点を1配列にまとめ、LineSegments + 共有マテリアル1つで描画
        const points: THREE.Vector3[] = [];

        for (let i = 0; i <= cols; i++) {
            points.push(new THREE.Vector3(i * cellSize, 0.01, 0));
            points.push(new THREE.Vector3(i * cellSize, 0.01, rows * cellSize));
        }
        for (let i = 0; i <= rows; i++) {
            points.push(new THREE.Vector3(0, 0.01, i * cellSize));
            points.push(new THREE.Vector3(cols * cellSize, 0.01, i * cellSize));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: THEME.grid });
        this.scene.add(new THREE.LineSegments(geometry, material));
    }

    private addLights(): void {
        this.scene.add(new THREE.AmbientLight(THEME.lights.ambient, 0.6));

        const directionalLight = new THREE.DirectionalLight(THEME.lights.direct, 0.8);
        directionalLight.position.set(10, 20, 10);
        this.scene.add(directionalLight);
    }

    private readonly _visibilityHandler = (): void => {
        if (document.hidden) {
            this.stopAnimation();
        } else {
            this.lastTime = null; // タブ復帰時の delta スパイク防止
            this.startAnimation();
        }
    };

    private startAnimation(): void {
        if (this.animationId !== null) return; // 二重起動防止
        this.animationId = requestAnimationFrame(this.animate);
    }

    private animate = (now: number): void => {
        this.animationId = requestAnimationFrame(this.animate);

        if (this.lastTime !== null && now - this.lastTime < BattleField.FRAME_MS) return;

        const delta = this.lastTime !== null ? (now - this.lastTime) / 1000 : 0;
        this.lastTime = now;

        if (this._frozen || this._paused) {
            // freeze / pause 中はエフェクトのみ継続してレンダリング
            StageObjectManager.instance.updateTankEffects(delta);
            StageObjectManager.instance.updateShellDestructionEffects(delta);
            this.composer.render();
            return;
        }

        const mgr        = StageObjectManager.instance;
        const bullets    = mgr.allBullets;
        for (const bullet of bullets) {
            bullet.shell.update(delta);
        }

        const aliveTanks  = mgr.aliveTanks;
        const allShells   = mgr.allShells;       // Shell[] を直接取得（.map() 不要）
        const allMines    = mgr.allMineObjects;  // Mine[]  を直接取得（.map() 不要）
        const mineEntries = mgr.allMines;        // 1回だけ展開してループと共有
        for (const mineEntry of mineEntries) {
            mineEntry.mine.update(delta, aliveTanks, allShells, allMines);
        }

        mgr.updateCubeEffects(delta);
        mgr.updateWallRippleEffects(delta);
        mgr.updateTankEffects(delta);
        mgr.updateShellDestructionEffects(delta);

        this.collision.update();

        this._aiAccum += delta;
        if (this._aiAccum >= BattleField.AI_FRAME_SEC) {
            ObservationEquipment.instance.update(this._aiAccum);
            EnemyMaster.instance.update(this._aiAccum);
            this._aiAccum = 0;
        }

        this.updateFootPrints();
        this.updateResources(aliveTanks);
        if (this.zoomLevel > 1.0) this.updateZoomedCamera();

        this._onTick?.();
        this.composer.render();
    };

    /**
     * 毎フレーム呼ぶ。プレイヤーの残弾数・残地雷数、および敵/残プレイヤー数を HUD に反映する。
     */
    private updateResources(aliveTanks: Tank[]): void {
        const mgr  = StageObjectManager.instance;
        const tank = mgr.playerTank;

        if (this.shellEl) {
            this.shellEl.textContent = tank ? String(tank.shot.remainingShots) : '--';
        }
        if (this.mineEl) {
            this.mineEl.textContent = tank ? String(tank.minePlacer.remainingMines) : '--';
        }
        if (this.statusEl) {
            const display = GAMEMODE_INFO[GameModeManager.instance.currentMode].BT_onDisplay ?? [];
            if (display.includes('EnemyCount')) {
                const count = aliveTanks.filter(t => !t.info.isPlayer).length;
                this.statusEl.textContent = String(count);
            } else if (display.includes('RemaingPlayer')) {
                const count = aliveTanks.filter(t => t.info.isPlayer).length;
                this.statusEl.textContent = String(count);
            }
        }
    }

    /**
     * 毎フレーム呼ぶ。全タンクの履帯スタンプを地面キャンバスに描画する。
     * 0.2セル以上移動したタンクのみ実際に描かれる。
     */
    private updateFootPrints(): void {
        if (!this.footprintCtx || !this.footprintTexture) return;

        const tanks   = StageObjectManager.instance.allTanks;
        const liveIds = new Set(tanks.map(t => t.info.id));

        // 消滅したタンクのエントリを削除
        for (const id of this.footprints.keys()) {
            if (!liveIds.has(id)) this.footprints.delete(id);
        }

        for (const tank of tanks) {
            if (!this.footprints.has(tank.info.id)) {
                this.footprints.set(
                    tank.info.id,
                    new FootPrint(this.footprintCtx, this.footprintTexture),
                );
            }
            this.footprints.get(tank.info.id)!.update(
                tank.movement.position,
                tank.movement.rotationY,
            );
        }
    }

    /**
     * ゲームロジック（弾・地雷・衝突・AI）を停止する（勝敗確定時に呼ぶ）。
     * タンクエフェクトとレンダリングは継続し、シーン遷移まで演出が再生される。
     */
    public freeze(): void {
        this._frozen = true;
    }

    /** 一時停止（ポーズメニュー用）。resume() で再開できる。 */
    public pause(): void  { this._paused = true;  }
    /** 一時停止を解除する。 */
    public resume(): void { this._paused = false; }

    private stopAnimation(): void {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    // ウィンドウリサイズ対応
    public handleResize(container: HTMLElement): void {
        this.adjustCameraToFitScreen(container.clientWidth, container.clientHeight);
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.composer.setSize(container.clientWidth, container.clientHeight);
        this.bloomPass.setSize(Math.ceil(container.clientWidth / 2), Math.ceil(container.clientHeight / 2));
    }

    // リソースの解放
    public dispose(): void {
        this.stopAnimation();
        document.removeEventListener('visibilitychange', this._visibilityHandler);
        this.renderer.dispose();
        this.scene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
                object.geometry.dispose();
                if (Array.isArray(object.material)) {
                    object.material.forEach(m => m.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
    }

    public setTickCallback(fn: (() => void) | null): void { this._onTick = fn; }

    public getScene(): THREE.Scene { return this.scene; }
    public getCamera(): THREE.Camera { return this.camera; }
    public getRenderer(): THREE.WebGLRenderer { return this.renderer; }
    public getConfig(): BattleFieldConfig { return this.config; }

    private applyGraphicsQuality(): void {
        let quality = 'high';
        try {
            const s = localStorage.getItem('tankpath-settings');
            if (s) quality = (JSON.parse(s).graphics as string) ?? 'high';
        } catch { /* ignore */ }

        if (quality === 'low') {
            this.bloomPass.enabled = false;
        } else if (quality === 'med') {
            this.bloomPass.strength = 0.2;
            this.bloomPass.radius   = 0.2;
        }
        // 'high' はデフォルト値のまま
    }

}
