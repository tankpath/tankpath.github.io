import type { IScene } from "../IScene";
import { SceneId } from "../../Definition/SceneId";
import { ChangeSceneEffect } from "../../Definition/SceneEffect";
import { OverallManager } from "../../overallcontroller/OverallManager";
import { AssetManager } from "../../managers/AssetManager";
import { ASSET_LIST } from "../../Definition/AssetList";
import '../initailLoading/loading.css';
import { SoundManager } from "../../managers/SoundManager";

export class InitialLoading implements IScene {
    private container: HTMLElement | null = null;
    private animationFrameId: number | null = null;

    // バイナリコード演出用
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private drops: number[] = [];

    public mount(container: HTMLElement): void {
        this.container = container;
        console.log('InitialLoading: システム起動シーケンス開始');

        // 1. HTMLの生成
        this.renderHTML();

        // 2. 背景のバイナリストリーム開始
        this.initMatrixEffect();

        // 3. アセット読み込み＆OSログ演出開始
        this.startLoadingProcess();
    }

    public unmount(): void {
        console.log('InitialLoading: 処理解放');
        // アニメーションループを止める（メモリリーク防止）
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }

    // --- HTML生成 ---
    private renderHTML() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="loading-scene">
                <div class="lc-corner lc-corner--tl"></div>
                <div class="lc-corner lc-corner--tr"></div>
                <div class="lc-corner lc-corner--bl"></div>
                <div class="lc-corner lc-corner--br"></div>
                <div class="lc-scanbeam"></div>
                <canvas id="binary-canvas"></canvas>
                <div class="loading-content">
                    <div class="boot-log" id="boot-log"></div>
                    <div class="progress-container">
                        <div class="progress-bar" id="progress-bar"></div>
                    </div>
                    <p id="loading-text">SYSTEM INITIALIZING...</p>
                    <p class="loading-tap-hint" id="tap-hint">[ TAP TO START ]</p>
                </div>
            </div>
        `;
    }

    // --- 背景エフェクト (Matrix Rain) ---
    private initMatrixEffect() {
        this.canvas = document.getElementById('binary-canvas') as HTMLCanvasElement;
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) return;

        // 画面サイズに合わせる
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        const fontSize = 14;
        const columns = this.canvas.width / fontSize;
        
        // 列ごとのY座標を初期化
        this.drops = Array(Math.floor(columns)).fill(1);

        const draw = () => {
            if (!this.ctx || !this.canvas) return;

            // 前の描画を薄く暗く塗りつぶす（残像効果）
            this.ctx.fillStyle = 'rgba(19, 39, 39, 0.05)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            this.ctx.fillStyle = '#76c8de'; // 文字色
            this.ctx.font = `${fontSize}px monospace`;

            for (let i = 0; i < this.drops.length; i++) {
                // 0or1
                const text = Math.random() > 0.5 ? "1" : "0";
                this.ctx.fillText(text, i * fontSize, this.drops[i] * fontSize);

                // 画面下まで行ったらランダムに上に戻す
                if (this.drops[i] * fontSize > this.canvas.height && Math.random() > 0.975) {
                    this.drops[i] = 0;
                }
                this.drops[i]++;
            }
            this.animationFrameId = requestAnimationFrame(draw);
        };

        draw();
    }

    // --- ロード処理とログ演出 ---
    private async startLoadingProcess() {
        // アセットの読み込み（アニメーションと並行して実行）
        const loadingPromise = this.performAssetLoading();

        const progressBar = document.getElementById('progress-bar');
        const loadingText = document.getElementById('loading-text');

        // 擬似的なロード項目と、重み（時間）
        const tasks = [
            { msg: "I SWORE ON THE SOIL I WOULD ONE DAY BURN", time: 300 },
            { msg: "THE FLAG THEY GAVE ME WAS THE FIRST THING I LOST", time: 300 },
            { msg: "THEIR VOICES STILL CALL ME BROTHER THROUGH THE SMOKE", time: 1000 },
            { msg: "GLORY ROTS FASTER THAN THE BODIES I LEFT BEHIND", time: 500 },
            { msg: "NO MONUMENT BEARS MY NAME. NO GRAVE HOLDS THEIRS.", time: 400 },
            { msg: "THEY CALL IT TREASON. I CALLED IT THE ONLY WAY.", time: 1200 },
            { msg: "I WAKE. I REMEMBER. I CANNOT GO BACK.", time: 500}
        ];

        const totalBaseTime = tasks.reduce((acc, t) => acc + t.time, 0);
        let currentProgress = 0;

        for (const task of tasks) {
            // 1.ログを追加
            this.addBooting(task.msg);

            // 2.ランダムな待ち時間の算出 (基準時間の 0.7 〜 1.3 で変動)
            const jitter = 0.7 + Math.random() * 0.6;
            const actualWait = task.time * jitter;

            // 3. プログレスバーを滑らかに更新するための分割処理
            // 重いタスク(500ms以上)の場合は、細かく刻んでバーを動かす
            const steps = 10;
            const stepWait = actualWait / steps;
            const progressIncrement = (task.time / totalBaseTime) * 100 / steps;

            for (let i = 0; i < steps; i++) {
                await this.sleep(stepWait);
                currentProgress += progressIncrement;

                if (progressBar) {
                    const displayProgress = Math.min(currentProgress, 100);
                    progressBar.style.width = `${displayProgress}%`;
                }
            }
        }

        // --- アニメーション完了 ---
        // アニメーションより先にロードが終わっていれば即通過、遅ければここで待機する
        await loadingPromise;

        if (loadingText) loadingText.innerText = "ACCESS GRANTED";

        // タップヒントを表示してユーザー操作を待つ
        const tapHint = document.getElementById('tap-hint');
        if (tapHint) tapHint.classList.add('loading-tap-hint--visible');

        document.addEventListener('pointerdown', async () => {
            // iOS: AudioContext の生成・resume はユーザー操作の同期コード内で開始する必要がある
            void SoundManager.instance.resumeContext();
            // デコード完了を待ってからシーン遷移（iOS は decodeAudioData に時間がかかるため）
            await SoundManager.instance.decodeAll();
            OverallManager.instance.requestChangeScene(SceneId.Title, ChangeSceneEffect.Scan);
        }, { once: true });
    }

    // ログ出現の時間調整
    private sleep(duration: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    private async performAssetLoading() {
        try {
            await AssetManager.instance.loadAll(ASSET_LIST);
            await SoundManager.instance.loadAllSE();
            await SoundManager.instance.loadAllBGM();
        } catch (e) {
            console.error("Asset loading failed:", e);
        }
    }

    private addBooting(msg: string) {
        const logContainer = document.getElementById('boot-log');
        if (!logContainer) return;
        const p = document.createElement('p');
        p.className = 'log-line';
        p.innerText = `> ${msg}`;
        logContainer.appendChild(p);
        logContainer.scrollTop = logContainer.scrollHeight;
    }
}