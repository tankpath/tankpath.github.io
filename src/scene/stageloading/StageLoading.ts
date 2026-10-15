import { ChangeSceneEffect } from '../../Definition/SceneEffect';
import { SceneId } from '../../Definition/SceneId';
import { setOrientationRequirement } from '../../orientation/OrientationManager';
import { getMobileSettings } from '../../managers/MobileSettings';
import { SceneChangeAction } from '../../types/btn/SceneChange';
import type { IScene } from '../IScene';
import { BattleField } from '../battle/BattleField';
import { BattleFieldManager } from '../../managers/BattleFieldManager';
import { GameModeManager } from '../../managers/GameModeManager';
import { StageCreationManager } from '../../managers/StageCreationManager';
import { StageCreat } from '../../stagecreation/StageCreat';
import { StageLoadingView } from './StageLoadingView';
import '../stageloading/stageloading.css';
import { SoundManager } from '../../managers/SoundManager';
import { SE, BGM } from '../../Definition/SoundList';

export class StageLoading implements IScene {
    private container: HTMLElement | null = null;
    private battleField: BattleField | null = null;
    private isLoaded: boolean = false;
    private isActive: boolean = false;

    private readonly buttonConfigs = [
        {
            selector: '.next-btn',
            action: new SceneChangeAction(SceneId.Battle, ChangeSceneEffect.Fade)
        }
    ]

    public mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = '';
        this.isActive = true;
        setOrientationRequirement(getMobileSettings().orientation);

        this.initBattleField();
        this.isLoaded = true;

        StageLoadingView.render(this.container, GameModeManager.instance.currentMode);
        this.startIntro();
    }

    // ---- イントロ演出 (合計 ~7秒) ----

    private async startIntro(): Promise<void> {
        const mgr = StageCreationManager.instance;
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        await Promise.all([
            SoundManager.instance.playBGMOnce(BGM.STAGE_LOADING_INTRO),
            ...(isIOS ? [this.sleep(7000)] : []),
            this.runCountAnim('sl-stage-value', mgr.previousStageNumber, mgr.stageNumber),
            this.runCountAnim('sl-tries-value', mgr.previousTryCount, mgr.tryCount),
        ]);
        if (!this.isActive) return;
        SoundManager.instance.playBGM(BGM.STAGE_LOADING);
        this.showReady();
    }

    /**
     * from → to へデジタル時計風にカウントアニメーション
     * 上昇: 緑エフェクト / 下降: 赤エフェクト
     */
    private async runCountAnim(elementId: string, from: number, to: number): Promise<void> {
        const el = document.getElementById(elementId);
        if (!el) return;

        const TICK_CLASS_UP   = 'sl-count-tick-up';
        const TICK_CLASS_DOWN = 'sl-count-tick-down';

        // 開始値を静止表示
        el.classList.remove(TICK_CLASS_UP, TICK_CLASS_DOWN);
        el.textContent = String(from).padStart(2, '0');
        await this.sleep(1000);

        if (from === to) return;

        const step      = from < to ? 1 : -1;
        const tickClass = step > 0 ? TICK_CLASS_UP : TICK_CLASS_DOWN;
        const tickSE    = step > 0 ? SE.COUNT_UP : SE.COUNT_DOWN;

        for (let n = from + step; step > 0 ? n <= to : n >= to; n += step) {
            if (!this.isActive) return;
            el.classList.remove(TICK_CLASS_UP, TICK_CLASS_DOWN);
            void el.offsetWidth; // アニメーション再起動のためリフロー強制
            el.textContent = String(n).padStart(2, '0');
            el.classList.add(tickClass);
            SoundManager.instance.playSE(tickSE);
            await this.sleep(700);
        }
    }

    /** 7秒後: TOUCH TO START へ切り替えてクリックを有効化 */
    private showReady() {
        const scene = document.getElementById('sl-scene');
        const footer = document.getElementById('sl-footer');
        if (scene) scene.classList.add('is-ready');
        if (footer) {
            footer.classList.add('sl-footer--switching');
            setTimeout(() => {
                footer.textContent = '>>> TOUCH TO START <<<';
            }, 300);
            setTimeout(() => {
                footer.classList.remove('sl-footer--switching');
                footer.classList.add('sl-footer--ready');
            }, 600);
            setTimeout(() => {
                footer.classList.add('animate-blink');
            }, 2600);
        }
        this.nextScene();
    }

    private nextScene() {
        if (!this.container || !this.isLoaded) return;
        this.container.addEventListener('click', () => {
            this.buttonConfigs[0].action.execute();
        }, { once: true });
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private initBattleField() {
        // バトルフィールドの生成（13×23マス、セルサイズは調整可能）
        // ここでは表示せず、シーンとジオメトリのみ生成
        this.battleField = new BattleField({
            rows: 13,
            cols: 23,
            cellSize: 1
        });

        // ステージデータを読み取ってオブジェクトを配置
        const stageCreat = new StageCreat(this.battleField);
        stageCreat.build(StageCreationManager.instance.lastResult);

        // シングルトンマネージャーに保存
        const manager = BattleFieldManager.getInstance();
        manager.setBattleField(this.battleField);
    }

    public unmount(): void {
        this.isActive = false;
        SoundManager.instance.stopBGM();
        // バトル画面で使用するため、まだdisposeしない
        if (this.container) this.container.innerHTML = '';
    }

    // Battle画面で使用するために、生成したフィールドを取得
    public getBattleField(): BattleField | null {
        return this.battleField;
    }
}
