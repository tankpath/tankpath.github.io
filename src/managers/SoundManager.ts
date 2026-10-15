import { SE, SE_LIST, BGM_LIST, type SEKey, type BGMKey } from '../Definition/SoundList';

export class SoundManager {
    private static _instance: SoundManager;
    private ctx: AudioContext | null = null;
    private seBuffers     = new Map<string, AudioBuffer>();
    private bgmBuffers    = new Map<string, AudioBuffer>();
    private rawSeBuffers  = new Map<string, ArrayBuffer>();
    private rawBgmBuffers = new Map<string, ArrayBuffer>();
    private bgmGain!:  GainNode;
    private sfxGain!:  GainNode;
    private bgmSource: AudioBufferSourceNode | null = null;
    private currentBGMKey: BGMKey | null = null;
    private bgmIsLoop   = false;
    private bgmOffset   = 0;       // 一時停止した再生位置（秒）
    private bgmStartAt  = 0;       // AudioContext の開始時刻
    private bgmIsPaused = false;
    private loopSources   = new Map<string, AudioBufferSourceNode>();
    private movingTankIds = new Set<string>();
    private activeSeCount = new Map<SEKey, number>();
    private pendingBGMKey: BGMKey | null = null;
    private resumePromise: Promise<void> | null = null;
    private static readonly SE_MAX: Partial<Record<SEKey, number>> = {
        [SE.FIRE_SP]:    3,
        [SE.FIRE_SP_HV]: 3,
        [SE.FIRE_CB]:    3,
        [SE.EXPLODE]:    3,
    };

    static get instance(): SoundManager {
        if (!this._instance) this._instance = new SoundManager();
        return this._instance;
    }

    // AudioContext はユーザー操作後に生成する
    private getCtx(): AudioContext {
        if (!this.ctx) {
            this.ctx    = new AudioContext();
            this.bgmGain = this.ctx.createGain();
            this.sfxGain = this.ctx.createGain();
            this.bgmGain.connect(this.ctx.destination);
            this.sfxGain.connect(this.ctx.destination);
            this.applyStoredSettings();
        }
        if (this.ctx.state === 'suspended') void this.ctx.resume();
        return this.ctx;
    }

    // ================================================================
    // ロード
    // ================================================================
    async loadSE(key: SEKey, url: string): Promise<void> {
        const res = await fetch(url);
        this.rawSeBuffers.set(key, await res.arrayBuffer());
    }

    async loadBGM(key: BGMKey, url: string): Promise<void> {
        const res = await fetch(url);
        this.rawBgmBuffers.set(key, await res.arrayBuffer());
    }

    async loadAllSE(): Promise<void> {
        await Promise.all(SE_LIST.map(({ key, url }) => this.loadSE(key, url)));
    }

    async loadAllBGM(): Promise<void> {
        await Promise.all(BGM_LIST.map(({ key, url }) => this.loadBGM(key, url)));
    }

    /** タップ後に呼ぶこと。フェッチ→デコードまで一括で行う */
    async loadAndDecodeAll(): Promise<void> {
        await this.loadAllSE();
        await this.loadAllBGM();
        await this.decodeAll();
    }

    // ================================================================
    // SE再生（ポリフォニック：同時再生可）
    // ================================================================
    playSE(key: SEKey): void {
        const max = SoundManager.SE_MAX[key];
        if (max !== undefined) {
            const count = this.activeSeCount.get(key) ?? 0;
            if (count >= max) return;
            this.activeSeCount.set(key, count + 1);
        }

        const ctx = this.getCtx();
        const buf = this.seBuffers.get(key);
        if (!buf) return;

        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.sfxGain);
        src.start();
        if (max !== undefined) {
            src.onended = () => {
                this.activeSeCount.set(key, (this.activeSeCount.get(key) ?? 1) - 1);
            };
        }
    }

    // ================================================================
    // BGM再生（1回のみ・完了時にPromise解決）
    // ================================================================
    async playBGMOnce(key: BGMKey): Promise<void> {
        this.stopBGM();
        const ctx = this.getCtx();
        // iOS: コンテキストが suspended の場合は resume を待ってから再生する
        if (ctx.state === 'suspended') {
            try { await ctx.resume(); } catch { /* ignore */ }
        }
        const buf = this.bgmBuffers.get(key);
        if (!buf) return;

        return new Promise<void>((resolve) => {
            let done = false;
            const finish = () => { if (!done) { done = true; resolve(); } };

            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.loop   = false;
            src.connect(this.bgmGain);
            src.onended = () => {
                if (this.bgmSource === src) {
                    this.bgmSource     = null;
                    this.currentBGMKey = null;
                }
                finish();
            };
            src.start();
            this.bgmSource     = src;
            this.currentBGMKey = key;
            this.bgmIsLoop     = false;
            this.bgmOffset     = 0;
            this.bgmStartAt    = ctx.currentTime;
            this.bgmIsPaused   = false;

            // iOS対応: onended が発火しない場合のフォールバック
            setTimeout(finish, (buf.duration + 0.5) * 1000);
        });
    }

    // ================================================================
    // BGM再生（ループ）
    // ================================================================
    playBGM(key: BGMKey): void {
        if (this.currentBGMKey === key && !this.bgmIsPaused) return;
        this.stopBGM();

        const ctx = this.getCtx();
        const buf = this.bgmBuffers.get(key);
        if (!buf) {
            // デコード未完了の場合は完了後に再生する
            this.pendingBGMKey = key;
            return;
        }

        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop   = true;
        src.connect(this.bgmGain);
        src.start();
        this.bgmSource     = src;
        this.currentBGMKey = key;
        this.bgmIsLoop     = true;
        this.bgmOffset     = 0;
        this.bgmStartAt    = ctx.currentTime;
        this.bgmIsPaused   = false;
    }

    stopBGM(): void {
        this.bgmSource?.stop();
        this.bgmSource     = null;
        this.currentBGMKey = null;
        this.bgmOffset     = 0;
        this.bgmIsPaused   = false;
    }

    // ================================================================
    // BGM一時停止 / 再開
    // ================================================================
    pauseBGM(): void {
        if (!this.bgmSource || this.bgmIsPaused) return;
        const ctx = this.getCtx();
        const buf = this.bgmBuffers.get(this.currentBGMKey!);
        const elapsed = ctx.currentTime - this.bgmStartAt;
        this.bgmOffset   = buf ? elapsed % buf.duration : 0;
        this.bgmSource.stop();
        this.bgmSource   = null;
        this.bgmIsPaused = true;
    }

    resumeBGM(): void {
        if (!this.bgmIsPaused || !this.currentBGMKey) return;
        const ctx = this.getCtx();
        const buf = this.bgmBuffers.get(this.currentBGMKey);
        if (!buf) return;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop   = this.bgmIsLoop;
        src.connect(this.bgmGain);
        src.start(0, this.bgmOffset);
        this.bgmSource   = src;
        this.bgmStartAt  = ctx.currentTime - this.bgmOffset;
        this.bgmIsPaused = false;
    }

    // ================================================================
    // SE再生（再生終了まで待機）
    // ================================================================
    async playSEAndWait(key: SEKey): Promise<void> {
        const ctx = this.getCtx();
        // iOS: コンテキストが suspended の場合は resume を待ってから再生する
        if (ctx.state === 'suspended') {
            try { await ctx.resume(); } catch { /* ignore */ }
        }
        const buf = this.seBuffers.get(key);
        if (!buf) return;

        return new Promise<void>((resolve) => {
            let done = false;
            const finish = () => { if (!done) { done = true; resolve(); } };

            const src = ctx.createBufferSource();
            src.buffer  = buf;
            src.connect(this.sfxGain);
            src.onended = () => finish();
            src.start();

            // iOS対応: onended が発火しない場合のフォールバック
            setTimeout(finish, (buf.duration + 0.5) * 1000);
        });
    }

    // ================================================================
    // ループSE（走行音など）
    // ================================================================

    /** ループSEを全て停止しタンク移動状態をリセットする */
    stopAllLoopSE(): void {
        for (const src of this.loopSources.values()) src.stop();
        this.loopSources.clear();
        this.movingTankIds.clear();
    }

    /** タンクIDごとに移動状態を通知し、1体でも動いていれば TANK_RUN を再生する */
    notifyMoving(tankId: string, isMoving: boolean): void {
        if (isMoving) this.movingTankIds.add(tankId);
        else          this.movingTankIds.delete(tankId);

        if (this.movingTankIds.size > 0) this.playLoopSE(SE.TANK_RUN);
        else                             this.stopLoopSE(SE.TANK_RUN);
    }

    playLoopSE(key: SEKey): void {
        if (this.loopSources.has(key)) return;
        const ctx = this.getCtx();
        const buf = this.seBuffers.get(key);
        if (!buf) return;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop   = true;
        src.connect(this.sfxGain);
        src.start();
        this.loopSources.set(key, src);
    }

    stopLoopSE(key: SEKey): void {
        const src = this.loopSources.get(key);
        if (!src) return;
        src.stop();
        this.loopSources.delete(key);
    }

    // ================================================================
    // AudioContext resume（オートプレイ制限対策）
    // ================================================================
    /** ユーザー操作イベント内から呼ぶこと。AudioContext を生成（未生成なら）し、suspended なら resume する */
    async resumeContext(): Promise<void> {
        if (!this.ctx) {
            this.ctx     = new AudioContext();
            this.bgmGain = this.ctx.createGain();
            this.sfxGain = this.ctx.createGain();
            this.bgmGain.connect(this.ctx.destination);
            this.sfxGain.connect(this.ctx.destination);
            this.applyStoredSettings();
        }
        if (this.ctx.state === 'suspended') {
            this.resumePromise = this.ctx.resume().finally(() => { this.resumePromise = null; });
            await this.resumePromise;
        }
    }

    /** ユーザー操作後に呼ぶこと。ロード済みの生バッファをデコードして再生可能にする */
    async decodeAll(): Promise<void> {
        // resume() を最大 3 秒待つ（iOS で ctx.resume() が応答しない場合の対策）
        if (this.resumePromise) {
            await Promise.race([
                this.resumePromise,
                new Promise<void>(r => setTimeout(r, 3000)),
            ]);
        }
        const ctx = this.getCtx();
        const tasks: Promise<void>[] = [];

        const decode = (raw: ArrayBuffer, onSuccess: (buf: AudioBuffer) => void, label: string): Promise<void> =>
            new Promise<void>(resolve => {
                const timer = setTimeout(() => {
                    console.warn(`[SoundManager] decode timeout: ${label}`);
                    resolve();
                }, 5000);
                // コールバック形式を使用（iOS Safari で Promise 形式がハングするバグを回避）
                ctx.decodeAudioData(
                    raw.slice(0), // slice でコピーを渡す（Safari の ArrayBuffer 転送バグ対策）
                    decoded => { clearTimeout(timer); onSuccess(decoded); resolve(); },
                    err    => { clearTimeout(timer); console.warn(`[SoundManager] decode failed: ${label}`, err); resolve(); },
                );
            });

        for (const [key, raw] of this.rawSeBuffers) {
            tasks.push(decode(raw, decoded => this.seBuffers.set(key as SEKey, decoded), key));
        }
        for (const [key, raw] of this.rawBgmBuffers) {
            tasks.push(decode(raw, decoded => this.bgmBuffers.set(key as BGMKey, decoded), key));
        }

        await Promise.all(tasks);
        this.rawSeBuffers.clear();
        this.rawBgmBuffers.clear();

        // デコード完了後、待機中の BGM があれば再生する
        if (this.pendingBGMKey) {
            const key = this.pendingBGMKey;
            this.pendingBGMKey = null;
            this.playBGM(key);
        }
    }

    // ================================================================
    // 音量制御（SettingsOverlayAction から呼ぶ）
    // ================================================================
    setBgmVolume(v: number): void {
        this.getCtx();
        this.bgmGain.gain.value = v / 100;
    }

    setSfxVolume(v: number): void {
        this.getCtx();
        this.sfxGain.gain.value = v / 100;
    }

    // 起動時に localStorage から音量を復元
    applyStoredSettings(): void {
        const s = JSON.parse(localStorage.getItem('tankpath-settings') ?? '{}');
        if (this.bgmGain) this.bgmGain.gain.value = (s.bgm ?? 80) / 100;
        if (this.sfxGain) this.sfxGain.gain.value = (s.sfx ?? 80) / 100;
    }
}
