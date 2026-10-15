import type * as THREE from 'three';
import type { InputState, InputSource, ScreenToWorld } from './InputSource';

/** キーボード＋マウス入力（PC 向け） */
export class KeyboardInput implements InputSource {
    private readonly held = new Set<string>();
    private mineCallback:  (() => void) | null = null;
    private shootCallback: (() => void) | null = null;
    private aimTarget: THREE.Vector3 | null = null;
    private readonly screenToWorld: ScreenToWorld;

    constructor(screenToWorld: ScreenToWorld) {
        this.screenToWorld = screenToWorld;
        window.addEventListener('keydown',      this.onKeyDown);
        window.addEventListener('keyup',        this.onKeyUp);
        window.addEventListener('mousemove',    this.onMouseMove);
        window.addEventListener('mousedown',    this.onMouseDown);
        window.addEventListener('contextmenu',  this.onContextMenu);
    }

    getState(): InputState {
        let dx = 0, dz = 0;
        if (this.held.has('ArrowUp')    || this.held.has('w')) dz -= 1;
        if (this.held.has('ArrowDown')  || this.held.has('s')) dz += 1;
        if (this.held.has('ArrowLeft')  || this.held.has('a')) dx -= 1;
        if (this.held.has('ArrowRight') || this.held.has('d')) dx += 1;
        return { dx, dz, aimTarget: this.aimTarget };
    }

    setMineCallback(cb: () => void): void  { this.mineCallback  = cb; }
    setShootCallback(cb: () => void): void { this.shootCallback = cb; }

    dispose(): void {
        window.removeEventListener('keydown',     this.onKeyDown);
        window.removeEventListener('keyup',       this.onKeyUp);
        window.removeEventListener('mousemove',   this.onMouseMove);
        window.removeEventListener('mousedown',   this.onMouseDown);
        window.removeEventListener('contextmenu', this.onContextMenu);
    }

    // ─── イベントハンドラ ─────────────────────────────────────────

    private readonly onKeyDown = (e: KeyboardEvent): void => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
        }
        this.held.add(e.key);
        if ((e.key === 'x' || e.key === 'X') && !e.repeat) {
            this.mineCallback?.();
        }
    };

    private readonly onKeyUp = (e: KeyboardEvent): void => {
        this.held.delete(e.key);
    };

    /** マウス移動：砲塔照準を更新 */
    private readonly onMouseMove = (e: MouseEvent): void => {
        this.aimTarget = this.screenToWorld(e.clientX, e.clientY);
    };

    /** 左クリックで発砲、右クリックで地雷設置 */
    private readonly onMouseDown = (e: MouseEvent): void => {
        if (e.button === 0) this.shootCallback?.();
        if (e.button === 2) this.mineCallback?.();
    };

    /** 右クリックのコンテキストメニューを抑制 */
    private readonly onContextMenu = (e: MouseEvent): void => {
        e.preventDefault();
    };
}
