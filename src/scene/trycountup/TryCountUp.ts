import { ChangeSceneEffect } from '../../Definition/SceneEffect';
import { SceneId } from '../../Definition/SceneId';
import { OverallManager } from '../../overallcontroller/OverallManager';
import { StageCreationManager } from '../../managers/StageCreationManager';
import type { IScene } from '../IScene';
import { setOrientationRequirement } from '../../orientation/OrientationManager';
import { getMobileSettings } from '../../managers/MobileSettings';
import './trycountup.css';
import { SoundManager } from '../../managers/SoundManager';
import { BGM } from '../../Definition/SoundList';

export class TryCountUP implements IScene {
    private container: HTMLElement | null = null;
    private isActive: boolean = false;
    private skipEnabled: boolean = false;
    private tryCounted: boolean = false;
    private boundSkip: (() => void) | null = null;

    public mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = '';
        this.isActive = true;
        setOrientationRequirement(getMobileSettings().orientation);
        this.render();
        this.startAnimation();

        this.boundSkip = () => this.skip();
        container.addEventListener('click', this.boundSkip);
        container.addEventListener('touchstart', this.boundSkip);

        SoundManager.instance.playBGM(BGM.TRY_COUNT_UP);
    }

    private skip(): void {
        if (!this.skipEnabled) return;
        if (!this.tryCounted) {
            StageCreationManager.instance.receiveTryCount();
            this.tryCounted = true;
        }
        this.isActive = false;
        OverallManager.instance.requestChangeScene(SceneId.StageLoading, ChangeSceneEffect.Fade);
    }

    private render() {
        if (!this.container) return;
        const mgr = StageCreationManager.instance;
        const countStr  = String(mgr.tryCount).padStart(2, '0');
        const nextStr   = String(mgr.tryCount + 1).padStart(2, '0');

        this.container.innerHTML = `
        <div class="trycountup-scene">
            <div class="tc-scanbeam"></div>
            <div class="tc-corner tc-corner--tl"></div>
            <div class="tc-corner tc-corner--tr"></div>
            <div class="tc-corner tc-corner--bl"></div>
            <div class="tc-corner tc-corner--br"></div>

            <!-- HUD right -->
            <div class="tc-hud-right">
                <span class="tc-count-label">UNITS ACTIVE</span>
                <span class="tc-count" id="tc-count">${countStr}</span>
            </div>

            <!-- Shipping box (drops at the end) -->
            <div class="tc-box" id="tc-box">
                <span class="tc-box-label">UNIT ${nextStr}</span>
            </div>

            <!-- Full-screen factory floor -->
            <div class="tc-factory" id="tc-factory">

                <!-- Crane 1: body (at 28%) -->
                <div class="tc-crane-pole tc-crane-pole--1">
                    <div class="tc-crane-wire" id="tc-wire-1"></div>
                </div>

                <!-- Crane 2: turret (at 62%) -->
                <div class="tc-crane-pole tc-crane-pole--2">
                    <div class="tc-crane-wire" id="tc-wire-2"></div>
                </div>

                <!-- Belt conveyor -->
                <div class="tc-belt">
                    <div class="tc-belt-inner"></div>
                    <div class="tc-belt-roller tc-belt-roller--l"></div>
                    <div class="tc-belt-roller tc-belt-roller--r"></div>
                </div>

                <!-- Tank assembly (slides along belt) -->
                <div class="tc-assembly" id="tc-assembly">
                    <div class="tc-asm-turret" id="tc-asm-turret">
                        <div class="tc-asm-barrel"></div>
                    </div>
                    <div class="tc-asm-body" id="tc-asm-body"></div>
                    <div class="tc-asm-tracks" id="tc-asm-tracks">
                        <div class="tc-wheel"></div>
                        <div class="tc-wheel"></div>
                        <div class="tc-wheel"></div>
                        <div class="tc-wheel"></div>
                        <div class="tc-wheel"></div>
                    </div>
                    <div class="tc-paint-spray"></div>
                </div>

                <!-- 中央タイトル -->
                <div class="tc-mission-title">
                    <p class="tc-mission-label">>> UNIT PRODUCTION <<<</p>
                    <p class="tc-mission-name">MISSION BONUS!!</p>
                </div>

            </div>
        </div>
        `;
    }

    // =========================================================
    //  Animation phases
    // =========================================================

    private async startAnimation(): Promise<void> {
        await this.sleep(400);
        if (!this.isActive) return;
        this.sleep(600).then(() => { this.skipEnabled = true; });

        await this.phase1_SlideTracks();       // tracks enter from right
        if (!this.isActive) return;
        await this.phase2_DropBody();          // crane 1 lowers body
        if (!this.isActive) return;
        await this.phase3_SlideToCrane2();     // move to crane 2
        if (!this.isActive) return;
        await this.phase4_DropTurret();        // crane 2 lowers turret
        if (!this.isActive) return;
        await this.phase5_Paint();             // paint spray
        if (!this.isActive) return;
        await this.phase6_BoxDrop();           // box drops
        if (!this.isActive) return;
        await this.phase7_AbsorbToCounter();   // box → light ball → count up
        if (!this.isActive) return;

        OverallManager.instance.requestChangeScene(SceneId.StageLoading, ChangeSceneEffect.Fade);
    }

    // --- Phase 1: キャタピラが右からスライドイン ---
    private async phase1_SlideTracks(): Promise<void> {
        const asm = document.getElementById('tc-assembly');
        if (asm) {
            asm.style.transition = 'none';
            asm.style.left = '110%';
        }
        await this.sleep(50);
        this.slideAssembly('28%', '1.3s');
        await this.sleep(1500);
    }

    // --- Phase 2: クレーン1が胴体を掴んで降ろす ---
    private async phase2_DropBody(): Promise<void> {
        const body      = document.getElementById('tc-asm-body');
        const cranePole = document.querySelector('.tc-crane-pole--1') as HTMLElement;
        let wireH = 'calc(100vh - 210px)';  // フォールバック

        if (body && cranePole) {
            // DOM実測値でレスポンシブに対応
            const craneRect = cranePole.getBoundingClientRect();
            const bodyRect  = body.getBoundingClientRect();  // opacity:0 でもレイアウト位置は確定
            const hookY  = craneRect.bottom + 8;            // フック先端Y
            const startY = hookY - bodyRect.top;            // 胴体をフック位置へ
            wireH = `${Math.max(0, bodyRect.top - craneRect.bottom)}px`;

            body.style.transition = 'none';
            body.style.transform  = `translateY(${startY}px)`;
            body.style.opacity    = '1';
        }
        await this.sleep(50);

        // ワイヤーと胴体を同時に降下
        this.extendWire('tc-wire-1', true, 1.0, wireH);
        if (body) {
            body.style.transition = 'transform 1.0s ease-in-out';
            body.style.transform  = 'translateY(0)';
        }
        await this.sleep(1150);
        if (body) body.style.transition = '';  // CSSペイント遷移を有効に戻す

        await this.clang();
        this.extendWire('tc-wire-1', false, 0.75);
        await this.sleep(750);
    }

    // --- Phase 3: クレーン2位置へ移動 ---
    private async phase3_SlideToCrane2(): Promise<void> {
        this.slideAssembly('62%', '0.9s');
        await this.sleep(1050);
    }

    // --- Phase 4: クレーン2が砲塔を掴んで降ろす ---
    private async phase4_DropTurret(): Promise<void> {
        const turret    = document.getElementById('tc-asm-turret');
        const cranePole = document.querySelector('.tc-crane-pole--2') as HTMLElement;
        let wireH = 'calc(100vh - 260px)';  // フォールバック

        if (turret && cranePole) {
            const craneRect  = cranePole.getBoundingClientRect();
            const turretRect = turret.getBoundingClientRect();
            const hookY  = craneRect.bottom + 8;
            const startY = hookY - turretRect.top;
            wireH = `${Math.max(0, turretRect.top - craneRect.bottom)}px`;

            turret.style.transition = 'none';
            turret.style.transform  = `translateY(${startY}px)`;
            turret.style.opacity    = '1';
        }
        await this.sleep(50);

        this.extendWire('tc-wire-2', true, 1.0, wireH);
        if (turret) {
            turret.style.transition = 'transform 1.0s ease-in-out';
            turret.style.transform  = 'translateY(0)';
        }
        await this.sleep(1150);
        if (turret) turret.style.transition = '';

        await this.clang();
        this.extendWire('tc-wire-2', false, 0.75);
        await this.sleep(700);
    }

    // --- Phase 5: スキャナー出現 → 塗装スイープ → スキャナー消去 ---
    private async phase5_Paint(): Promise<void> {
        const asm = document.getElementById('tc-assembly');

        // 1. スキャナーを左端に出現させる（700ms 待機で視認しやすく）
        if (asm) asm.classList.add('tc-scanning');
        await this.sleep(700);

        // 2. スキャナーが戦車を横断しながら塗装（CSS側 1.2s アニメに合わせて待機）
        if (asm) {
            asm.classList.remove('tc-scanning');
            asm.classList.add('tc-painting');
        }
        await this.sleep(1350);

        // 3. 塗装完了
        if (asm) {
            asm.classList.remove('tc-painting');
            asm.classList.add('tc-painted');
        }
        await this.sleep(600);
    }

    // --- Phase 6: 箱を降ろす ---
    private async phase6_BoxDrop(): Promise<void> {
        this.slideAssembly('50%', '0.5s');
        await this.sleep(650);

        document.getElementById('tc-box')?.classList.add('tc-box--dropping');
        await this.sleep(750);
    }

    // --- Phase 7: ハコが光の玉に変化してカウンターへ吸収 ---
    private async phase7_AbsorbToCounter(): Promise<void> {
        const box     = document.getElementById('tc-box');
        const countEl = document.getElementById('tc-count');
        const asm     = document.getElementById('tc-assembly');

        // アセンブリをフェードアウト
        if (asm) {
            asm.style.transition = 'opacity 0.4s ease';
            asm.style.opacity = '0';
        }

        // カウンター中心座標と箱サイズをDOMから取得（レスポンシブ対応）
        if (box && countEl) {
            const rect    = countEl.getBoundingClientRect();
            const boxRect = box.getBoundingClientRect();
            const cX = rect.left + rect.width  / 2;
            const cY = rect.top  + rect.height / 2;

            const targetLeft   = cX - boxRect.width  / 2;
            const targetBottom = window.innerHeight - cY - boxRect.height / 2;

            box.style.setProperty('--absorb-left',   `${targetLeft}px`);
            box.style.setProperty('--absorb-bottom', `${targetBottom}px`);
            box.classList.add('tc-absorb-fly');
        }

        // アニメーション完了（1.2s）と同時にカウントアップ
        await this.sleep(1200);

        if (box) box.style.display = 'none';
        this.tryCounted = true;
        this.countUp();
        await this.sleep(700);
    }

    // =========================================================
    //  Helpers
    // =========================================================

    // アセンブリをクレーン中心に合わせてスライド（幅が変わっても正確に中央揃え）
    private slideAssembly(cranePercent: string, dur: string) {
        const el = document.getElementById('tc-assembly');
        if (!el) return;
        const half = el.offsetWidth / 2;
        el.style.transition = `left ${dur} cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
        el.style.left = `calc(${cranePercent} - ${half}px)`;
    }

    private extendWire(id: string, extend: boolean, duration: number = 0.75, extendHeight: string = 'calc(100vh - 210px)') {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.transition = `height ${duration}s ease-in-out`;
        el.style.height = extend ? extendHeight : '0px';
    }

    private async clang(): Promise<void> {
        const el = document.getElementById('tc-assembly');
        if (!el) return;
        el.classList.remove('tc-clanging');
        void el.offsetWidth; // reflow
        el.classList.add('tc-clanging');
        await this.sleep(320);
    }

    // シンプルなカウントアップ（フリッカーなし）
    private countUp(): void {
        const el = document.getElementById('tc-count');
        if (!el) return;
        StageCreationManager.instance.receiveTryCount();
        el.classList.add('tc-incremented');
        el.textContent = String(StageCreationManager.instance.tryCount).padStart(2, '0');
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public unmount(): void {
        this.isActive = false;
        SoundManager.instance.stopBGM();
        if (this.container && this.boundSkip) {
            this.container.removeEventListener('click', this.boundSkip);
            this.container.removeEventListener('touchstart', this.boundSkip);
        }
        if (this.container) this.container.innerHTML = '';
    }
}
