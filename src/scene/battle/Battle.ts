import { SettingsOverlayAction } from '../../types/btn/SettingsOverlayAction';
import { ChangeSceneEffect } from '../../Definition/SceneEffect';
import { SceneId } from '../../Definition/SceneId';
import { SceneChangeAction } from '../../types/btn/SceneChange';
import type { IScene } from '../IScene';
import type { BattleField } from './BattleField';
import { BattleFieldManager } from '../../managers/BattleFieldManager';
import { StageCreationManager } from '../../managers/StageCreationManager';
import type { Enemy } from '../../managers/StageCreationManager';
import { GameModeManager } from '../../managers/GameModeManager';
import { GAMEMODE_INFO } from '../../Definition/GameMode';
import { BattleView } from './BattleView';
import { Timer } from './Timer';
import { AnalyzeManager } from '../../managers/AnalyzeManager';
import { ResultManager } from '../../managers/ResultManager';
import { StageAnalyzer } from '../../Analyze/StageAnalyzer';
import { EnemyAnalyzer } from '../../Analyze/EnemyAnalyzer';
import * as THREE from 'three';
import { StageObjectManager } from '../../managers/StageObjectManager';
import { GameMaster } from './GameMaster';
import { Player } from '../../player/Player';
import { KeyboardInput } from '../../player/input/KeyboardInput';
import { TouchInput } from '../../player/input/TouchInput';
import { Enemy as EnemyAI } from '../../enemy/individual/Enemy';
import { EnemyMaster } from '../../enemy/master/EnemyMaster';
import { ObservationEquipment } from '../../enemy/master/function/ObservationEquipment';
import { CamouflageEffect, DestructionEffect, DeathMark, RainbowEffect, isTransparentTankType } from '../../object/tank/TankEffect';
import './battle.css';
import { setOrientationRequirement } from '../../orientation/OrientationManager';
import { getMobileSettings } from '../../managers/MobileSettings';
import { getCursorSettings } from '../../managers/CursorSettings';
import { SoundManager } from '../../managers/SoundManager';
import { SE, BGM } from '../../Definition/SoundList';

export class Battle implements IScene {
    /** ステージ100の特殊演出を既に表示済みかどうか（セッション中1回のみ） */
    private static _stage100IntroDone = false;

    private container: HTMLElement | null = null;
    private battleField: BattleField | null = null;
    private threeContainer: HTMLElement | null = null;
    private gameMaster: GameMaster | null = null;
    private player: Player | null = null;
    private _enemyAIs: EnemyAI[] = [];
    private timer: Timer = new Timer();
    private _isActive: boolean = false;
    private _isEnding: boolean = false;
    private _initialEnemies: Enemy[] = [];

    // ポーズ関連
    private _isPaused = false;

    // カーソル関連
    private _cursorEl: HTMLElement | null = null;
    private _cursorHideTimer: number | null = null;
    private _cursorAbort = new AbortController();

    // 照準ライン関連
    private _cursorX = 0;
    private _cursorY = 0;
    private _cursorMoved = false;

    public mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = '';
        this._isActive = true;
        setOrientationRequirement(getMobileSettings().orientation);
        this._initialEnemies = StageObjectManager.instance.enemyTanks
            .map(t => ({ id: t.info.id, type: t.info.type }));
        BattleView.render(this.container, GameModeManager.instance.currentMode);
        BattleView.applyMobileControls(this.container);
        this.setupCursor();
        this.attachBattleField();
        this.bindStopButtons();

        void this.runIntro();
    }

    // ─── イントロ待機（BGM イントロ分 3 秒） ─────────────────────────

    private setStopButtonEnabled(enabled: boolean): void {
        const btn = this.container?.querySelector<HTMLButtonElement>('.bc-stop-btn');
        if (btn) btn.disabled = !enabled;
    }

    private async runIntro(): Promise<void> {
        this.setupDestructionEffects();
        this.startCamouflageEffects();
        this.startPlayer(true); // 砲塔追尾のみ先行有効化
        this.setStopButtonEnabled(false);

        // INTRO を1回再生し、終了後 BATTLE_01 をループ
        void SoundManager.instance.playBGMOnce(BGM.INTRO).then(() => {
            if (this._isActive) SoundManager.instance.playBGM(BGM.BATTLE_01);
        });

        const isStage100First = StageCreationManager.instance.stageNumber === 100
            && !Battle._stage100IntroDone;
        if (isStage100First) {
            Battle._stage100IntroDone = true;
            await this.showStage100Intro();
        } else {
            await this.sleep(3000);
        }

        if (!this._isActive) return;
        this.setStopButtonEnabled(true);
        this.player?.setTurretOnly(false); // フル操作を解放
        this.timer.start(() => {
            StageObjectManager.instance.playerTank?.destruction.destroy();
        });
        this.startGameMaster();
        this.startEnemyAI();
        this.startRainbowEffects();
    }

    private async showStage100Intro(): Promise<void> {
        const overlay = this.container?.querySelector<HTMLElement>('#bc-stage100-overlay');
        if (!overlay) { await this.sleep(3000); return; }
        overlay.classList.add('bc-stage100-overlay--visible');
        await this.sleep(3500);
        overlay.classList.add('bc-stage100-overlay--hide');
        await this.sleep(800);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ─── 勝敗処理（GameMaster・デバッグボタン共通） ───────────────

    private async handleWin(): Promise<void> {
        if (this._isEnding) return;
        this._isEnding = true;
        this.timer.stop();
        this.freezeField();

        await this.sleep(500);
        if (!this._isActive) return;

        await SoundManager.instance.playSEAndWait(SE.WINNER);
        if (!this._isActive) return;

        const mgr = StageCreationManager.instance;
        const stageNumber  = mgr.stageNumber;
        const isCheckpoint = stageNumber % 5 === 0;
        const modeInfo     = GAMEMODE_INFO[GameModeManager.instance.currentMode];
        const isFinalStage = typeof modeInfo.stageNumber === 'number'
            && stageNumber === modeInfo.stageNumber;
        ResultManager.instance.addElapsedMs(this.timer.elapsedMs);
        AnalyzeManager.instance.recordWin(stageNumber, mgr.resolvedMapNumber, this._initialEnemies, this.timer.elapsedMs);
        StageAnalyzer.instance.notify();
        EnemyAnalyzer.instance.notify();
        mgr.receiveResult('win', []);
        if (isFinalStage) {
            new SceneChangeAction(SceneId.MissionComplete, ChangeSceneEffect.Fade).execute();
            return;
        }
        const isTryUp = modeInfo.isTryUp;
        const dest = (isCheckpoint && isTryUp) ? SceneId.TryCountUp : SceneId.StageLoading;
        new SceneChangeAction(dest, ChangeSceneEffect.Fade).execute();
    }

    private async handleLose(survivors: Enemy[]): Promise<void> {
        if (this._isEnding) return;
        this._isEnding = true;
        this.timer.stop();
        this.freezeField();

        await this.sleep(500);
        if (!this._isActive) return;

        const mgr = StageCreationManager.instance;
        const survivorIds = new Set(survivors.map(s => s.id));
        const defeated = this._initialEnemies.filter(e => !survivorIds.has(e.id));
        ResultManager.instance.addElapsedMs(this.timer.elapsedMs);
        AnalyzeManager.instance.recordLose(mgr.stageNumber, mgr.resolvedMapNumber, survivors, defeated, this.timer.elapsedMs);
        StageAnalyzer.instance.notify();
        EnemyAnalyzer.instance.notify();
        mgr.receiveResult('lose', survivors);
        const dest = mgr.tryCount <= 0 ? SceneId.Result : SceneId.StageLoading;
        const loseSE = mgr.tryCount <= 0 ? SE.LOSER : SE.RETRY;
        await SoundManager.instance.playSEAndWait(loseSE);
        if (!this._isActive) return;
        new SceneChangeAction(dest, ChangeSceneEffect.Fade).execute();
    }

    // ─── フィールド停止 ───────────────────────────────────────────

    private freezeField(): void {
        this.battleField?.freeze();   // 弾・地雷・衝突・エフェクト全停止
        this.player?.dispose();
        this.player = null;
        this.gameMaster?.dispose();
        this.gameMaster = null;
        this._stopEnemyAI();
        SoundManager.instance.stopBGM();
    }

    // ─── 破壊エフェクト ───────────────────────────────────────────

    /**
     * 全タンクに破壊エフェクト起動関数を登録する。
     * destroy() が呼ばれるとゲームロジックは即座に処理され、
     * DestructionEffect が完了した後に 3D オブジェクトがシーンから除去される。
     */
    private setupDestructionEffects(): void {
        if (!this.battleField) return;
        const scene = this.battleField.getScene();
        const mgr   = StageObjectManager.instance;
        const allTanks = [...mgr.enemyTanks, ...(mgr.playerTank ? [mgr.playerTank] : [])];
        for (const tank of allTanks) {
            tank.destruction.setEffectStarter((onRemove) => {
                const pos = new THREE.Vector3();
                tank.object.getWorldPosition(pos);
                new DeathMark(pos, scene);
                mgr.registerTankEffect(new DestructionEffect(tank.object, scene, onRemove));
            });
        }
    }

    // ─── 虹色エフェクト ───────────────────────────────────────────

    private startRainbowEffects(): void {
        const mgr = StageObjectManager.instance;
        for (const tank of mgr.enemyTanks) {
            if (tank.info.type !== 'godofall') continue;
            mgr.registerTankEffect(new RainbowEffect(tank.object));
        }
    }

    // ─── カモフラージュエフェクト ──────────────────────────────────

    private startCamouflageEffects(): void {
        if (!this.battleField) return;
        const scene = this.battleField.getScene();
        const mgr   = StageObjectManager.instance;
        for (const tank of mgr.enemyTanks) {
            if (!isTransparentTankType(tank.info.type)) continue;
            mgr.registerTankEffect(new CamouflageEffect(tank.object, scene, tank.info.type));
        }
    }

    // ─── 敵 AI ────────────────────────────────────────────────────

    private startEnemyAI(): void {
        if (!this.battleField) return;

        const mgr = StageObjectManager.instance;

        const playerTank = mgr.playerTank;
        if (playerTank) ObservationEquipment.instance.register(playerTank);

        const config = this.battleField.getConfig();
        EnemyMaster.instance.setup(
            config,
            this.battleField.getScene(), // デバッグ用ルート可視化あり
        );

        const debugScene = this.battleField.getScene();
        for (const tank of mgr.enemyTanks) {
            EnemyMaster.instance.registerEnemy(tank);
            const ai = new EnemyAI(tank, config, debugScene);
            this._enemyAIs.push(ai);
            ai.start();
        }
    }

    private _stopEnemyAI(): void {
        for (const ai of this._enemyAIs) ai.dispose();
        this._enemyAIs = [];
        ObservationEquipment.instance.reset();
        EnemyMaster.instance.reset();
    }

    // ─── Player ───────────────────────────────────────────────────

    private startPlayer(turretOnly = false): void {
        const tank = StageObjectManager.instance.playerTank;
        if (!tank) return;

        const toWorld = (x: number, y: number) => this.screenToWorld(x, y);
        const isTouch = window.matchMedia('(pointer: coarse)').matches;
        const input = isTouch
            ? new TouchInput(this.container!, toWorld)
            : new KeyboardInput(toWorld);

        this.player = new Player(tank, input);
        if (turretOnly) this.player.setTurretOnly(true);
        this.player.start();
    }

    /**
     * スクリーン座標 → y=0 平面上のワールド座標へ変換する。
     * Three.js Raycaster でカメラからレイを飛ばし、地面平面との交点を返す。
     */
    private screenToWorld(clientX: number, clientY: number): THREE.Vector3 | null {
        if (!this.battleField) return null;
        const camera = this.battleField.getCamera();
        const canvas = this.battleField.getRenderer().domElement;
        const rect   = canvas.getBoundingClientRect();
        const ndc    = new THREE.Vector2(
            ((clientX - rect.left) / rect.width)  *  2 - 1,
            ((clientY - rect.top)  / rect.height) * -2 + 1,
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(ndc, camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const point = new THREE.Vector3();
        return raycaster.ray.intersectPlane(plane, point);
    }

    // ─── GameMaster ───────────────────────────────────────────────

    private startGameMaster(): void {
        this.gameMaster = new GameMaster(
            ()          => this.handleWin(),
            (survivors) => this.handleLose(survivors),
        );
        this.gameMaster.start();
    }

    // ─── STOPボタン / ポーズ ──────────────────────────────────────

    private bindStopButtons(): void {
        const c = this.container!;

        c.querySelector('.bc-stop-btn')
            ?.addEventListener('click', () => this.pauseGame());

        c.querySelector('.bc-pause-resume')
            ?.addEventListener('click', () => this.resumeGame());

        c.querySelector('.bc-pause-setting')
            ?.addEventListener('click', () => new SettingsOverlayAction().execute());

        c.querySelector('.bc-pause-restart')
            ?.addEventListener('click', () => this.doRestart());

        c.querySelector('.bc-pause-title-btn')
            ?.addEventListener('click', () => this.goToTitle());
    }

    private pauseGame(): void {
        if (this._isPaused || this._isEnding) return;
        this._isPaused = true;
        this.battleField?.pause();
        this.player?.setPaused(true);
        this.timer.pause();
        SoundManager.instance.pauseBGM();
        SoundManager.instance.stopAllLoopSE();
        this.container?.querySelector('#bc-pause-overlay')
            ?.classList.add('bc-pause-overlay--visible');
    }

    private resumeGame(): void {
        if (!this._isPaused) return;
        this._isPaused = false;
        this.battleField?.resume();
        this.player?.setPaused(false);
        this.timer.resume();
        SoundManager.instance.resumeBGM();
        this.container?.querySelector('#bc-pause-overlay')
            ?.classList.remove('bc-pause-overlay--visible');
    }

    private goToTitle(): void {
        if (this._isEnding) return;
        this._isEnding = true;
        this.timer.stop();
        this.freezeField();
        new SceneChangeAction(SceneId.Title, ChangeSceneEffect.Fade).execute();
    }

    private doRestart(): void {
        if (this._isEnding) return;
        this._isEnding = true;
        this.timer.stop();
        this.freezeField();
        StageCreationManager.instance.reset();
        ResultManager.instance.reset();
        new SceneChangeAction(SceneId.StageLoading, ChangeSceneEffect.Fade).execute();
    }

    // ─── BattleField アタッチ ─────────────────────────────────────

    private attachBattleField() {
        this.threeContainer = document.getElementById('battle-three-container');
        if (!this.threeContainer) return;

        const manager = BattleFieldManager.getInstance();
        this.battleField = manager.getBattleField();
        if (!this.battleField) return;

        this.battleField.attachToContainer(this.threeContainer);
        this.battleField.setTickCallback(() => this.tickAimLine());
        window.addEventListener('resize', this.handleResize);

        // 縦向きモード: ズームスライダーを配線
        const zoomSlider = this.container?.querySelector<HTMLInputElement>('#bc-zoom-slider');
        if (zoomSlider) {
            zoomSlider.addEventListener('input', () => {
                this.battleField?.setZoom(parseInt(zoomSlider.value, 10) / 100);
            });
        }
    }

    private handleResize = () => {
        if (this.battleField && this.threeContainer) {
            this.battleField.handleResize(this.threeContainer);
        }
    };

    // ─── カーソル ─────────────────────────────────────────────────

    private setupCursor(): void {
        if (!this.container) return;
        this._cursorEl = this.container.querySelector<HTMLElement>('#bc-cursor');
        if (!this._cursorEl) return;

        const cs = getCursorSettings();
        const isTouch = window.matchMedia('(pointer: coarse)').matches;

        if (!cs.enabled) {
            // PC では通常カーソルをそのまま表示（.bc-custom-cursor クラスを付けない）
            return;
        }

        // PC のみネイティブカーソルを非表示にする
        if (!isTouch) {
            this.container.querySelector('.battle-scene')?.classList.add('bc-custom-cursor');
        }

        // サイズ適用（基準 40px）
        const sizePx = Math.round(40 * cs.size / 100);
        this._cursorEl.style.width  = `${sizePx}px`;
        this._cursorEl.style.height = `${sizePx}px`;

        // 色フィルター適用
        const img = this._cursorEl.querySelector<HTMLImageElement>('img');
        if (img) {
            img.style.filter = `hue-rotate(${cs.hue}deg) brightness(${cs.brightness / 100})`;
        }

        const signal = this._cursorAbort.signal;

        if (isTouch) {
            const isControlTouch = (t: Touch): boolean => {
                const el = document.elementFromPoint(t.clientX, t.clientY);
                return el?.closest('.bc-stick')           !== null
                    || el?.closest('.bc-touch-mine')      !== null
                    || el?.closest('.bc-zoom-slider-wrap') !== null;
            };
            // 縦向きモード時、タッチがステージ描画エリア（上部60%）内かを判定
            const isInStageArea = (t: Touch): boolean => {
                const scene = this.container?.querySelector<HTMLElement>('.battle-scene--portrait');
                if (!scene) return true;
                const rect = scene.getBoundingClientRect();
                return t.clientY <= rect.top + rect.height * 0.60;
            };
            const showAt = (e: TouchEvent) => {
                const touch = Array.from(e.touches).find(t => !isControlTouch(t) && isInStageArea(t))
                           ?? Array.from(e.changedTouches).find(t => !isControlTouch(t) && isInStageArea(t));
                if (!touch || !this._cursorEl || !this.container) return;
                const rect = this.container.getBoundingClientRect();
                this._cursorX = touch.clientX - rect.left;
                this._cursorY = touch.clientY - rect.top;
                this._cursorMoved = true;
                this._cursorEl.style.left = `${this._cursorX}px`;
                this._cursorEl.style.top  = `${this._cursorY}px`;
                this._cursorEl.style.display = 'block';
                this._cursorEl.classList.remove('bc-cursor--fade');
                if (this._cursorHideTimer !== null) clearTimeout(this._cursorHideTimer);
            };
            const scheduleHide = () => {
                if (this._cursorHideTimer !== null) clearTimeout(this._cursorHideTimer);
                this._cursorHideTimer = window.setTimeout(() => {
                    this._cursorEl?.classList.add('bc-cursor--fade');
                }, 500);
            };
            this.container.addEventListener('touchstart', showAt, { passive: true, signal });
            this.container.addEventListener('touchmove',  showAt, { passive: true, signal });
            this.container.addEventListener('touchend',   scheduleHide, { passive: true, signal });
        } else {
            const onMove = (e: MouseEvent) => {
                if (!this._cursorEl || !this.container) return;
                const rect = this.container.getBoundingClientRect();
                this._cursorX = e.clientX - rect.left;
                this._cursorY = e.clientY - rect.top;
                this._cursorMoved = true;
                this._cursorEl.style.left = `${this._cursorX}px`;
                this._cursorEl.style.top  = `${this._cursorY}px`;
                this._cursorEl.style.display = 'block';
            };
            const onLeave = () => {
                if (this._cursorEl) this._cursorEl.style.display = 'none';
            };
            this.container.addEventListener('mousemove',  onMove,  { signal });
            this.container.addEventListener('mouseleave', onLeave, { signal });
        }

        this.setupAimLine();
    }

    private disposeCursor(): void {
        this._cursorAbort.abort();
        this._cursorAbort = new AbortController();
        if (this._cursorHideTimer !== null) {
            clearTimeout(this._cursorHideTimer);
            this._cursorHideTimer = null;
        }
        this.container?.querySelector('.battle-scene')?.classList.remove('bc-custom-cursor');
        this._cursorEl = null;
        this.battleField?.setTickCallback(null);
    }

    // ─── 照準ライン ───────────────────────────────────────────────

    private setupAimLine(): void {
        const cs = getCursorSettings();
        if (cs.lineEnabled) {
            const svg = this.container?.querySelector<SVGElement>('#bc-aim-line');
            if (svg) svg.style.display = 'block';
        }
    }

    private tickAimLine(): void {
        const svg = this.container?.querySelector<SVGElement>('#bc-aim-line');
        if (!svg || svg.style.display !== 'block') return;
        if (!this._cursorMoved) return;

        const lineEl = svg.querySelector<SVGLineElement>('#bc-aim-line-el');
        const tank   = StageObjectManager.instance.playerTank;
        if (!lineEl || !tank) return;

        const tankPos    = tank.turret.worldPosition;
        const tankScreen = this.worldToContainerPos(tankPos);
        if (!tankScreen) return;

        lineEl.setAttribute('x1', String(this._cursorX));
        lineEl.setAttribute('y1', String(this._cursorY));
        lineEl.setAttribute('x2', String(tankScreen.x));
        lineEl.setAttribute('y2', String(tankScreen.y));
    }

    private worldToContainerPos(worldPos: THREE.Vector3): { x: number; y: number } | null {
        if (!this.battleField || !this.container) return null;
        const camera        = this.battleField.getCamera();
        const canvas        = this.battleField.getRenderer().domElement;
        const canvasRect    = canvas.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();

        const projected = worldPos.clone().project(camera);
        const clientX   = (projected.x * 0.5 + 0.5)  * canvasRect.width  + canvasRect.left;
        const clientY   = (-projected.y * 0.5 + 0.5) * canvasRect.height + canvasRect.top;
        return {
            x: clientX - containerRect.left,
            y: clientY - containerRect.top,
        };
    }

    // ─── アンマウント ─────────────────────────────────────────────

    public unmount(): void {
        this._isActive = false;
        this.timer.stop();

        this.disposeCursor();

        this.player?.dispose();
        this.player = null;

        this.gameMaster?.dispose();
        this.gameMaster = null;

        this._stopEnemyAI();

        window.removeEventListener('resize', this.handleResize);

        BattleFieldManager.getInstance().clearBattleField();
        this.battleField = null;

        if (this.container) this.container.innerHTML = '';
    }
}
