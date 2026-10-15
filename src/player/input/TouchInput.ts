import type * as THREE from 'three';
import type { InputState, InputSource, ScreenToWorld } from './InputSource';

/** タッチ入力（スマートフォン・タブレット向け） */
export class TouchInput implements InputSource {
    /** ジョイスティック出力 (-1 〜 1) */
    private stickX = 0;
    private stickZ = 0;

    private aimTarget: THREE.Vector3 | null = null;
    private mineCallback:  (() => void) | null = null;
    private shootCallback: (() => void) | null = null;
    private readonly screenToWorld: ScreenToWorld;

    /** 照準用タッチの識別子セット（コントロール以外の指） */
    private readonly aimTouchIds = new Set<number>();

    /**
     * イベント登録リスト（dispose 用）。
     * window も含めるため EventTarget に広げている。
     */
    private readonly listeners: Array<[EventTarget, string, EventListener]> = [];

    constructor(container: HTMLElement, screenToWorld: ScreenToWorld) {
        this.screenToWorld = screenToWorld;
        this.bindStick(container);
        this.bindMine(container);
        this.bindAimAndShoot();
    }

    getState(): InputState {
        return {
            dx: this.stickX,
            dz: this.stickZ,
            aimTarget: this.aimTarget,
        };
    }

    setMineCallback(cb: () => void): void  { this.mineCallback  = cb; }
    setShootCallback(cb: () => void): void { this.shootCallback = cb; }

    dispose(): void {
        for (const [el, type, handler] of this.listeners) {
            el.removeEventListener(type, handler);
        }
        this.listeners.length = 0;
    }

    // ─── ジョイスティックバインド ─────────────────────────────────

    private bindStick(container: HTMLElement): void {
        const el = container.querySelector<HTMLElement>('.bc-stick');
        if (!el) return;

        let stickTouchId: number | null = null;
        let cx = 0, cy = 0, radius = 0;

        const onStart = (e: TouchEvent): void => {
            e.preventDefault();
            if (stickTouchId !== null) return;
            const touch = e.changedTouches[0];
            const rect  = el.getBoundingClientRect();
            cx = rect.left + rect.width  / 2;
            cy = rect.top  + rect.height / 2;
            radius = rect.width / 2;
            stickTouchId = touch.identifier;
            this.updateStick(touch.clientX, touch.clientY, cx, cy, radius, el);
        };

        const onMove = (e: TouchEvent): void => {
            if (stickTouchId === null) return;
            for (const touch of Array.from(e.changedTouches)) {
                if (touch.identifier !== stickTouchId) continue;
                e.preventDefault();
                this.updateStick(touch.clientX, touch.clientY, cx, cy, radius, el);
            }
        };

        const onEnd = (e: TouchEvent): void => {
            for (const touch of Array.from(e.changedTouches)) {
                if (touch.identifier !== stickTouchId) continue;
                stickTouchId = null;
                this.stickX  = 0;
                this.stickZ  = 0;
                const nub = el.querySelector<HTMLElement>('.bc-stick-nub');
                if (nub) nub.style.transform = 'translate(-50%, -50%)';
            }
        };

        el.addEventListener('touchstart', onStart as EventListener, { passive: false });
        window.addEventListener('touchmove',   onMove as EventListener, { passive: false });
        window.addEventListener('touchend',    onEnd  as EventListener, { passive: false });
        window.addEventListener('touchcancel', onEnd  as EventListener, { passive: false });

        this.listeners.push([el,     'touchstart',  onStart as EventListener]);
        this.listeners.push([window, 'touchmove',   onMove  as EventListener]);
        this.listeners.push([window, 'touchend',    onEnd   as EventListener]);
        this.listeners.push([window, 'touchcancel', onEnd   as EventListener]);
    }

    private updateStick(
        clientX: number, clientY: number,
        cx: number, cy: number, radius: number,
        el: HTMLElement,
    ): void {
        const dx   = clientX - cx;
        const dy   = clientY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const maxTravel = radius * 0.65;
        const deadZone  = maxTravel * 0.12;

        if (dist < deadZone) {
            this.stickX = 0;
            this.stickZ = 0;
        } else {
            const clamped = Math.min(dist, maxTravel);
            this.stickX = (dx / dist) * (clamped / maxTravel);
            this.stickZ = (dy / dist) * (clamped / maxTravel);
        }

        // ナブを視覚的に移動
        const nub = el.querySelector<HTMLElement>('.bc-stick-nub');
        if (nub) {
            const clamped = Math.min(dist, maxTravel);
            const nx = dist > 0 ? (dx / dist) * clamped : 0;
            const ny = dist > 0 ? (dy / dist) * clamped : 0;
            nub.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
        }
    }

    // ─── 地雷ボタン ───────────────────────────────────────────────

    private bindMine(container: HTMLElement): void {
        const el = container.querySelector<HTMLElement>('.bc-touch-mine');
        if (!el) return;

        const handler = this.prevent(() => { this.mineCallback?.(); });
        el.addEventListener('touchstart', handler, { passive: false });
        this.listeners.push([el, 'touchstart', handler]);
    }

    // ─── 照準＆発砲（画面タッチ全体） ────────────────────────────

    /**
     * window 全体のタッチを監視。
     * ジョイスティック・MINE ボタン以外のタッチを「照準タッチ」として扱う。
     * - touchstart / touchmove : 砲塔照準を更新
     * - touchend               : 発砲
     */
    private bindAimAndShoot(): void {
        const entries: Array<[string, (e: TouchEvent) => void]> = [
            ['touchstart',  this.onAimTouchStart],
            ['touchmove',   this.onAimTouchMove],
            ['touchend',    this.onAimTouchEnd],
            ['touchcancel', this.onAimTouchCancel],
        ];
        for (const [type, handler] of entries) {
            window.addEventListener(type, handler as EventListener, { passive: false });
            this.listeners.push([window, type, handler as EventListener]);
        }
    }

    private readonly onAimTouchStart = (e: TouchEvent): void => {
        for (const touch of Array.from(e.changedTouches)) {
            if (this.isControlElement(document.elementFromPoint(touch.clientX, touch.clientY))) continue;
            if (!this.isInStageArea(touch.clientY)) continue;
            this.aimTouchIds.add(touch.identifier);
            const pos = this.screenToWorld(touch.clientX, touch.clientY);
            if (pos) this.aimTarget = pos;
        }
    };

    private readonly onAimTouchMove = (e: TouchEvent): void => {
        for (const touch of Array.from(e.changedTouches)) {
            if (!this.aimTouchIds.has(touch.identifier)) continue;
            e.preventDefault();
            const pos = this.screenToWorld(touch.clientX, touch.clientY);
            if (pos) this.aimTarget = pos;
        }
    };

    /** 照準タッチの指が離れたら発砲。aim 位置は最後の座標を保持したまま */
    private readonly onAimTouchEnd = (e: TouchEvent): void => {
        for (const touch of Array.from(e.changedTouches)) {
            if (!this.aimTouchIds.has(touch.identifier)) continue;
            this.aimTouchIds.delete(touch.identifier);
            this.shootCallback?.();
        }
    };

    private readonly onAimTouchCancel = (e: TouchEvent): void => {
        for (const touch of Array.from(e.changedTouches)) {
            this.aimTouchIds.delete(touch.identifier);
        }
    };

    // ─── ユーティリティ ───────────────────────────────────────────

    /** ジョイスティック・MINE ボタン・ズームスライダー・オーバーレイ上のタッチかどうか判定 */
    private isControlElement(el: Element | null): boolean {
        if (!el) return false;
        return el.closest('.bc-stick')          !== null
            || el.closest('.bc-touch-mine')     !== null
            || el.closest('.bc-zoom-slider-wrap') !== null
            || el.closest('.ovl-backdrop')      !== null;
    }

    /**
     * 縦向きモード時、タッチが Three.js ステージ描画エリア（上部 60%）内かを判定。
     * 横向きモードまたは非モバイルでは常に true を返す。
     */
    private isInStageArea(clientY: number): boolean {
        const scene = document.querySelector<HTMLElement>('.battle-scene--portrait');
        if (!scene) return true;
        const rect = scene.getBoundingClientRect();
        return clientY <= rect.top + rect.height * 0.60;
    }

    /** e.preventDefault() を呼んでからハンドラを実行するラッパー */
    private prevent(fn: () => void): EventListener {
        return (e: Event) => { e.preventDefault(); fn(); };
    }
}
