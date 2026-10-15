import type { ClickAction } from "./ClickAction";
import './overlay.css';
import { SoundManager } from '../../managers/SoundManager';
import { SE } from '../../Definition/SoundList';

export interface OverlayMenuItem {
    /** ボタンに表示するラベル（関数を渡すとオーバーレイを開くたびに評価される） */
    label: string | (() => string);
    /** ボタンを押したときに実行するアクション */
    action: ClickAction;
}

export interface OverlayConfig {
    /** タイトルバーに表示するラベル */
    title: string;
    /**
     * コンテンツ領域に挿入する HTML 文字列（任意）。
     * 関数を渡すと、オーバーレイを開くたびに呼び出されて動的に生成する。
     */
    content?: string | (() => string);
    /** オーバーレイ内に表示するメニューボタン（任意） */
    menuItems?: OverlayMenuItem[];
}

export class OverlayAction implements ClickAction {
    private readonly config: OverlayConfig;

    constructor(config: OverlayConfig) {
        this.config = config;
    }

    execute(): void {
        this.showOverlay();
    }

    private showOverlay(): void {
        // 既存オーバーレイがあれば即削除
        document.getElementById('overlay-display')?.remove();

        const backdrop = document.createElement('div');
        backdrop.id = 'overlay-display';
        backdrop.className = 'ovl-backdrop';

        const resolvedContent = typeof this.config.content === 'function'
            ? this.config.content()
            : (this.config.content ?? '');

        backdrop.innerHTML = `
            <div class="ovl-window" role="dialog" aria-modal="true" aria-label="${this.config.title}">
                <div class="ovl-corner ovl-corner--tl"></div>
                <div class="ovl-corner ovl-corner--tr"></div>
                <div class="ovl-corner ovl-corner--bl"></div>
                <div class="ovl-corner ovl-corner--br"></div>

                <div class="ovl-titlebar">
                    <span class="ovl-title">${this.config.title}</span>
                    <button class="ovl-close-btn" aria-label="close">[ X ]</button>
                </div>

                <div class="ovl-content">
                    ${resolvedContent}
                    ${this.renderMenuItems()}
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);

        // アニメーション開始
        requestAnimationFrame(() => {
            backdrop.classList.add('ovl-backdrop--visible');
        });

        // 閉じる処理
        const close = () => this.closeOverlay(backdrop, handleKey);

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) close();
        });

        backdrop.querySelector('.ovl-close-btn')?.addEventListener('click', () => {
            SoundManager.instance.playSE(SE.CANCEL);
            close();
        });

        // メニューボタンのイベント設定
        this.config.menuItems?.forEach((item, i) => {
            const btn = backdrop.querySelector(`.ovl-menu-item[data-index="${i}"]`);
            btn?.addEventListener('click', () => {
                SoundManager.instance.playSE(SE.DECISION);
                close();
                // アニメーション完了後にアクション実行
                setTimeout(() => item.action.execute(), 220);
            });
        });

        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        document.addEventListener('keydown', handleKey);
    }

    private renderMenuItems(): string {
        if (!this.config.menuItems?.length) return '';
        const items = this.config.menuItems
            .map((item, i) => {
                const label = typeof item.label === 'function' ? item.label() : item.label;
                return `
                <button class="ovl-menu-item" data-index="${i}">
                    ${label}
                </button>
            `;
            })
            .join('');
        return `<div class="ovl-menu-list">${items}</div>`;
    }

    private closeOverlay(
        backdrop: HTMLElement,
        handleKey: (e: KeyboardEvent) => void
    ): void {
        document.removeEventListener('keydown', handleKey);
        backdrop.classList.remove('ovl-backdrop--visible');
        backdrop.classList.add('ovl-backdrop--closing');
        setTimeout(() => backdrop.remove(), 220);
    }
}
