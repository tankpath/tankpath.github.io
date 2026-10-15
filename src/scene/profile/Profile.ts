import type { IScene } from "../IScene";
import '../profile/profile.css';

import { ChangeSceneEffect } from "../../Definition/SceneEffect";
import { SceneId } from "../../Definition/SceneId";
import { OverallManager } from "../../overallcontroller/OverallManager";
import { SoundManager } from "../../managers/SoundManager";
import { SE, BGM } from "../../Definition/SoundList";
import { ProfileManager, TITLE_DEFINITIONS } from "../../managers/ProfileManager";
import { PixelEditor } from "./PixelEditor";
import type { GridSize } from "./PixelEditor";
import { setOrientationRequirement } from "../../orientation/OrientationManager";
import { t, tf } from "../../i18n/i18n";

const MAX_NICKNAME = 12;
const AVATAR_PX    = 64; // プレビューキャンバスの表示サイズ（px）

export class Profile implements IScene {
    private container: HTMLElement | null = null;
    private manager = ProfileManager.instance;
    private pixelEditor: PixelEditor | null = null;
    private gridSize: GridSize = 32;

    private currentNickname = '';
    private currentTitleId  = '';
    private currentCustom   = '';

    // ----------------------------------------
    // IScene
    // ----------------------------------------

    public mount(container: HTMLElement): void {
        setOrientationRequirement('portrait');
        SoundManager.instance.playBGM(BGM.TITLE);
        this.container   = container;
        this.gridSize    = this.detectGridSize();
        this.currentNickname = this.manager.nickname;
        this.currentTitleId  = this.manager.titleId;
        this.currentCustom   = this.manager.customTitle;

        this.render();
        this.initPixelEditor();
        this.setupEvents();
    }

    /** 画面幅に応じてグリッドサイズを決定 */
    private detectGridSize(): GridSize {
        const w = window.innerWidth;
        if (w <= 767)  return 8;
        if (w <= 1024) return 16;
        return 32;
    }

    public unmount(): void {
        SoundManager.instance.stopBGM();
        this.pixelEditor?.destroy();
        this.pixelEditor = null;
        if (this.container) this.container.innerHTML = '';
    }

    // ----------------------------------------
    // レンダリング
    // ----------------------------------------

    private render(): void {
        if (!this.container) return;
        const unlockedIds = this.manager.getUnlockedIds();

        this.container.innerHTML = `
            <div class="profile-scene">
                <div class="profile-scanbeam"></div>
                <div class="profile-corner profile-corner--tl"></div>
                <div class="profile-corner profile-corner--tr"></div>
                <div class="profile-corner profile-corner--bl"></div>
                <div class="profile-corner profile-corner--br"></div>

                <button class="profile-back-btn">[ &lt; BACK ]</button>

                <!-- ページヘッダー -->
                <header class="profile-header">
                    <span class="profile-header-label">&gt;&gt;&gt; SYSTEM &lt;&lt;&lt;</span>
                    <h1 class="profile-header-title">COMMANDER PROFILE</h1>
                </header>

                <!-- ボディ -->
                <div class="profile-body">

                    <!-- 左: ドット絵エディタ -->
                    <div class="profile-left">
                        <div class="profile-editor-label">AVATAR EDITOR  <span class="profile-editor-sub">${this.gridSize} × ${this.gridSize}</span></div>
                        <div class="js-pe-container profile-pe-container"></div>
                    </div>

                    <!-- 右: 設定パネル -->
                    <div class="profile-right">
                        <div class="profile-panel">
                            <div class="profile-panel-inner">

                                <!-- アバタープレビュー -->
                                <div class="profile-section profile-section--preview">
                                    <p class="profile-section-label">PREVIEW</p>
                                    <div class="profile-preview-card">
                                        <div class="profile-preview-avatar-wrap">
                                            <canvas
                                                class="js-avatar-preview profile-preview-canvas"
                                                width="${AVATAR_PX}"
                                                height="${AVATAR_PX}"
                                            ></canvas>
                                        </div>
                                        <div class="profile-preview-info">
                                            <p class="profile-preview-name js-preview-name">${this.escHtml(this.currentNickname || 'COMMANDER')}</p>
                                            <p class="profile-preview-title js-preview-title">${this.escHtml(this.resolveDisplayTitle())}</p>
                                        </div>
                                    </div>
                                </div>

                                <!-- ニックネーム -->
                                <div class="profile-section">
                                    <p class="profile-section-label">NICKNAME  <span class="profile-section-note">${tf('nicknameNote', { max: MAX_NICKNAME })}</span></p>
                                    <div class="profile-nickname-wrap">
                                        <input
                                            class="profile-nickname-input"
                                            type="text"
                                            maxlength="${MAX_NICKNAME}"
                                            placeholder="COMMANDER"
                                            value="${this.escHtml(this.currentNickname)}"
                                            autocomplete="off"
                                            spellcheck="false"
                                        >
                                        <span class="profile-char-count js-char-count">${this.currentNickname.length}/${MAX_NICKNAME}</span>
                                    </div>
                                </div>

                                <!-- 称号 -->
                                <div class="profile-section">
                                    <p class="profile-section-label">${t('titleSectionLabel')}</p>
                                    <div class="profile-title-list">
                                        ${TITLE_DEFINITIONS.map(def =>
                                            this.renderTitleItem(def.id, def.requiredStage, unlockedIds)
                                        ).join('')}
                                    </div>
                                    <div class="profile-custom-wrap ${this.currentTitleId === 'custom' ? 'profile-custom-wrap--visible' : ''}">
                                        <span class="profile-custom-label">${tf('customTitleHint', { max: MAX_NICKNAME })}</span>
                                        <input
                                            class="profile-custom-input"
                                            type="text"
                                            maxlength="${MAX_NICKNAME}"
                                            placeholder="${t('customTitlePh')}"
                                            value="${this.escHtml(this.currentCustom)}"
                                            autocomplete="off"
                                            spellcheck="false"
                                        >
                                    </div>
                                </div>

                            </div><!-- /.profile-panel-inner -->

                            <!-- 保存ボタン -->
                            <div class="profile-save-wrap">
                                <button class="profile-save-btn">${t('saveProfileBtn')}</button>
                                <p class="profile-save-feedback js-save-feedback">SAVED</p>
                            </div>
                        </div>
                    </div>

                </div><!-- /.profile-body -->
            </div>
        `;
    }

    private renderTitleItem(id: string, requiredStage: number, unlockedIds: Set<string>): string {
        const label = t(('title' + id.charAt(0).toUpperCase() + id.slice(1)) as Parameters<typeof t>[0]);
        const isSelected = this.currentTitleId === id;
        const isLocked   = !unlockedIds.has(id);

        let cls = 'profile-title-item';
        if (isSelected) cls += ' profile-title-item--selected';
        if (isLocked)   cls += ' profile-title-item--locked';

        const badgeCls = isSelected ? 'profile-title-badge profile-title-badge--selected'
                       : isLocked   ? 'profile-title-badge profile-title-badge--locked'
                       : 'profile-title-badge';
        const badgeText = isSelected ? '[ ACTIVE ]'
                        : isLocked   ? `ST.${requiredStage}〜`
                        : '';

        return `
            <button class="${cls}" data-id="${id}" ${isLocked ? 'disabled' : ''}>
                <span>${label}</span>
                <span class="${badgeCls}">${badgeText}</span>
            </button>
        `;
    }

    // ----------------------------------------
    // PixelEditor 初期化
    // ----------------------------------------

    private initPixelEditor(): void {
        if (!this.container) return;
        const peContainer = this.container.querySelector<HTMLElement>('.js-pe-container')!;
        const savedAvatar = this.manager.loadAvatar(this.gridSize) ?? undefined;

        this.pixelEditor = new PixelEditor(
            peContainer,
            this.gridSize,
            () => this.updateAvatarPreview(),
            savedAvatar,
        );

        // 保存済みデータがあれば即プレビューに反映
        if (savedAvatar) this.updateAvatarPreview();
    }

    /** PixelEditor の現在データをプレビューキャンバスに描画する */
    private updateAvatarPreview(): void {
        const canvas = this.container?.querySelector<HTMLCanvasElement>('.js-avatar-preview');
        if (!canvas || !this.pixelEditor) return;
        const ctx   = canvas.getContext('2d')!;
        const data  = this.pixelEditor.getData();
        const g     = this.gridSize;
        const scale = AVATAR_PX / g; // 8→8px/dot, 16→4px/dot, 32→2px/dot
        ctx.clearRect(0, 0, AVATAR_PX, AVATAR_PX);
        data.forEach((color, i) => {
            if (!color) return;
            ctx.fillStyle = color;
            ctx.fillRect((i % g) * scale, Math.floor(i / g) * scale, scale, scale);
        });
    }

    // ----------------------------------------
    // イベント設定
    // ----------------------------------------

    private setupEvents(): void {
        if (!this.container) return;
        const c = this.container;

        // 戻るボタン
        c.querySelector('.profile-back-btn')?.addEventListener('click', () => {
            SoundManager.instance.playSE(SE.CANCEL);
            OverallManager.instance.requestChangeScene(SceneId.Title, ChangeSceneEffect.Fade);
        });

        // ニックネーム
        const nameInput   = c.querySelector<HTMLInputElement>('.profile-nickname-input')!;
        const charCount   = c.querySelector<HTMLElement>('.js-char-count')!;
        const previewName = c.querySelector<HTMLElement>('.js-preview-name')!;
        nameInput.addEventListener('input', () => {
            const val = nameInput.value.slice(0, MAX_NICKNAME);
            nameInput.value      = val;
            this.currentNickname = val;
            charCount.textContent = `${val.length}/${MAX_NICKNAME}`;
            charCount.classList.toggle('profile-char-count--warn', val.length >= MAX_NICKNAME);
            previewName.textContent = val || 'COMMANDER';
        });

        // 称号ボタン
        c.querySelectorAll<HTMLButtonElement>('.profile-title-item:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                SoundManager.instance.playSE(SE.DECISION);
                this.selectTitle(btn.dataset.id ?? '');
            });
        });

        // カスタム称号入力
        const customInput  = c.querySelector<HTMLInputElement>('.profile-custom-input')!;
        const previewTitle = c.querySelector<HTMLElement>('.js-preview-title')!;
        customInput.addEventListener('input', () => {
            this.currentCustom = customInput.value.slice(0, MAX_NICKNAME);
            customInput.value  = this.currentCustom;
            if (this.currentTitleId === 'custom') {
                previewTitle.textContent = this.currentCustom.trim() || '---';
            }
        });

        // 保存
        c.querySelector('.profile-save-btn')?.addEventListener('click', () => {
            SoundManager.instance.playSE(SE.DECISION);
            this.save();
        });
    }

    private selectTitle(id: string): void {
        if (!this.container) return;
        this.currentTitleId = id;

        this.container.querySelectorAll<HTMLButtonElement>('.profile-title-item:not([disabled])').forEach(btn => {
            const isNow = btn.dataset.id === id;
            btn.classList.toggle('profile-title-item--selected', isNow);
            const badge = btn.querySelector('.profile-title-badge');
            if (badge) {
                badge.className   = isNow ? 'profile-title-badge profile-title-badge--selected' : 'profile-title-badge';
                badge.textContent = isNow ? '[ ACTIVE ]' : '';
            }
        });

        const customWrap = this.container.querySelector<HTMLElement>('.profile-custom-wrap')!;
        customWrap.classList.toggle('profile-custom-wrap--visible', id === 'custom');

        this.container.querySelector<HTMLElement>('.js-preview-title')!.textContent = this.resolveDisplayTitle();
    }

    private save(): void {
        if (!this.container) return;
        const nickname = this.currentNickname.trim() || 'COMMANDER';
        this.manager.save(nickname, this.currentTitleId, this.currentCustom);
        if (this.pixelEditor) {
            this.manager.saveAvatar(this.pixelEditor.getData(), this.gridSize);
        }

        // フィードバックアニメーション
        const fb = this.container.querySelector<HTMLElement>('.js-save-feedback')!;
        fb.classList.remove('profile-save-feedback--show');
        void fb.offsetWidth;
        fb.classList.add('profile-save-feedback--show');
    }

    // ----------------------------------------
    // ユーティリティ
    // ----------------------------------------

    private resolveDisplayTitle(): string {
        if (this.currentTitleId === 'custom') return this.currentCustom.trim() || '---';
        const key = ('title' + this.currentTitleId.charAt(0).toUpperCase() + this.currentTitleId.slice(1)) as Parameters<typeof t>[0];
        return t(key) ?? t('titleRookie');
    }

    private escHtml(s: string): string {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}
