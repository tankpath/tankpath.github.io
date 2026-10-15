// タイマー、アナライザーへ秒数を送る

const TIME_LIMIT_MS = 5 * 60 * 1000; // 5分

/**
 * バトル経過時間を計測し、HUD の #bc-timer 要素を更新するクラス。
 * start() はイントロ終了後に呼ぶこと。
 * 5分経過で onTimeout コールバックを一度だけ呼ぶ。
 */
export class Timer {
    private startTime: number = 0;
    private _elapsedMs: number = 0;
    private rafId: number | null = null;
    private timeoutId: ReturnType<typeof setTimeout> | null = null;
    private running = false;
    private _pausedAt: number | null = null;
    private _onTimeout: (() => void) | null = null;

    /** 計測開始 & 表示ループ開始（イントロ後に呼ぶ） */
    start(onTimeout: () => void): void {
        this._onTimeout  = onTimeout;
        this.startTime   = Date.now();
        this.running     = true;
        this.rafId       = requestAnimationFrame(this.tick);
        this.timeoutId   = setTimeout(() => { this.stop(); onTimeout(); }, TIME_LIMIT_MS);
    }

    /** 一時停止（ポーズ時に呼ぶ） */
    pause(): void {
        if (!this.running || this._pausedAt !== null) return;
        this._pausedAt = Date.now();
        if (this.rafId    !== null) { cancelAnimationFrame(this.rafId);  this.rafId    = null; }
        if (this.timeoutId !== null) { clearTimeout(this.timeoutId);     this.timeoutId = null; }
    }

    /** 一時停止解除（ポーズ解除時に呼ぶ） */
    resume(): void {
        if (!this.running || this._pausedAt === null) return;
        this.startTime   += Date.now() - this._pausedAt;
        this._pausedAt    = null;
        this.rafId        = requestAnimationFrame(this.tick);
        const remaining   = TIME_LIMIT_MS - (Date.now() - this.startTime);
        if (remaining > 0 && this._onTimeout) {
            const cb = this._onTimeout;
            this.timeoutId = setTimeout(() => { this.stop(); cb(); }, remaining);
        }
    }

    /** 計測停止（勝敗確定 or unmount 時に呼ぶ） */
    stop(): void {
        if (!this.running) return;
        this.running = false;
        this._pausedAt = null;
        if (this.rafId     !== null) { cancelAnimationFrame(this.rafId);  this.rafId     = null; }
        if (this.timeoutId !== null) { clearTimeout(this.timeoutId);      this.timeoutId = null; }
        this._elapsedMs = Date.now() - this.startTime;
    }

    /** 現在の経過ミリ秒（停止後は停止時点の値を保持） */
    get elapsedMs(): number {
        return this.running
            ? Date.now() - this.startTime
            : this._elapsedMs;
    }

    private readonly tick = (): void => {
        if (!this.running) return;
        this.updateDisplay();
        this.rafId = requestAnimationFrame(this.tick);
    };

    private updateDisplay(): void {
        const el = document.getElementById('bc-timer');
        if (!el) return;
        const total = Math.floor((Date.now() - this.startTime) / 1000);
        const mm = Math.floor(total / 60).toString().padStart(2, '0');
        const ss = (total % 60).toString().padStart(2, '0');
        el.textContent = `${mm}:${ss}`;
    }
}
