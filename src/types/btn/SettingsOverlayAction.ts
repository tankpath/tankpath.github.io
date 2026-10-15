import type { ClickAction } from "./ClickAction";
import './overlay.css';
import './settings-overlay.css';
import { t, setLang, type Lang } from '../../i18n/i18n';
import { SoundManager } from '../../managers/SoundManager';
import { SE } from '../../Definition/SoundList';

const DEFAULT_POS = {
    stick_x:    13, stick_y:    78,
    mine_x:     87, mine_y:     78,
    pt_stick_x: 50, pt_stick_y: 72,
    pt_mine_x:  50, pt_mine_y:  87,
};

export class SettingsOverlayAction implements ClickAction {
    execute(): void { this.showOverlay(); }

    private showOverlay(): void {
        document.getElementById('overlay-display')?.remove();

        const backdrop = document.createElement('div');
        backdrop.id = 'overlay-display';
        backdrop.className = 'ovl-backdrop';

        backdrop.innerHTML = `
            <div class="ovl-window stg-window" role="dialog" aria-modal="true" aria-label="SETTINGS">
                <div class="ovl-corner ovl-corner--tl"></div>
                <div class="ovl-corner ovl-corner--tr"></div>
                <div class="ovl-corner ovl-corner--bl"></div>
                <div class="ovl-corner ovl-corner--br"></div>

                <div class="ovl-titlebar">
                    <span class="ovl-title">SETTINGS</span>
                    <button class="ovl-close-btn" aria-label="close">[ X ]</button>
                </div>

                <div class="stg-tabs">
                    <button class="stg-tab stg-tab--active" data-tab="1">${t('settingTab1')}</button>
                    <button class="stg-tab" data-tab="2">${t('settingTab2')}</button>
                    <button class="stg-tab" data-tab="3">${t('settingTab3')}</button>
                </div>

                <div class="ovl-content stg-content">

                    <!-- ===================== 設定１: 言語・サウンド ===================== -->
                    <div class="stg-panel stg-panel--active" data-panel="1">
                        <p class="ovl-section-label">LANGUAGE</p>
                        <div class="stg-row">
                            <span class="stg-row-label">${t('langLabel')}</span>
                            <div class="stg-btn-group">
                                <button class="stg-option-btn stg-option-btn--active" data-setting="lang" data-value="ja">日本語</button>
                                <button class="stg-option-btn" data-setting="lang" data-value="en">English</button>
                            </div>
                        </div>

                        <hr class="ovl-divider">

                        <p class="ovl-section-label">SOUND</p>
                        <div class="stg-row">
                            <span class="stg-row-label">BGM</span>
                            <div class="stg-slider-wrap">
                                <input type="range" class="stg-slider" data-setting="bgm" min="0" max="100" value="80">
                                <span class="stg-slider-val">80</span>
                            </div>
                        </div>
                        <div class="stg-row">
                            <span class="stg-row-label">SFX</span>
                            <div class="stg-slider-wrap">
                                <input type="range" class="stg-slider" data-setting="sfx" min="0" max="100" value="80">
                                <span class="stg-slider-val">80</span>
                            </div>
                        </div>

                        <hr class="ovl-divider">

                        <p class="ovl-section-label">GRAPHICS</p>
                        <div class="stg-row">
                            <span class="stg-row-label">${t('graphicsLabel')}</span>
                            <div class="stg-btn-group">
                                <button class="stg-option-btn stg-option-btn--active" data-setting="graphics" data-value="high">${t('graphicsHigh')}</button>
                                <button class="stg-option-btn" data-setting="graphics" data-value="med">${t('graphicsMed')}</button>
                                <button class="stg-option-btn" data-setting="graphics" data-value="low">${t('graphicsLow')}</button>
                            </div>
                        </div>

                        <div class="stg-panel-footer">
                            <button class="stg-reset-btn" data-panel-reset="1">${t('resetDefault')}</button>
                            <button class="stg-save-btn" data-panel-save="1">${t('save')}</button>
                        </div>
                    </div>

                    <!-- ===================== 設定２: スマホ操作 ===================== -->
                    <div class="stg-panel" data-panel="2">

                        <!-- スマホ用注記 -->
                        <p class="stg-smartphone-note">${t('smartphoneNote')}</p>

                        <!-- 画面向き -->
                        <p class="ovl-section-label">ORIENTATION</p>
                        <div class="stg-row">
                            <span class="stg-row-label">${t('orientationLabel')}</span>
                            <div class="stg-btn-group">
                                <button class="stg-option-btn stg-option-btn--active" data-setting="orientation" data-value="landscape">${t('orientationLs')}</button>
                                <button class="stg-option-btn" data-setting="orientation" data-value="portrait">${t('orientationPt')}</button>
                            </div>
                        </div>
                        <div class="stg-hint stg-hint--ls">
                            <span class="stg-hint-icon">↔</span>${t('hintLandscape')}
                        </div>
                        <div class="stg-hint stg-hint--pt" hidden>
                            <span class="stg-hint-icon">↕</span>${t('hintPortrait')}
                        </div>

                        <hr class="ovl-divider">

                        <!-- 横向き設定 -->
                        <div class="stg-landscape-sec">

                            <p class="ovl-section-label">BATTLE DISPLAY</p>
                            <div class="stg-checklist">
                                <label class="stg-check-item">
                                    <input type="checkbox" class="stg-checkbox" data-bt-item="bt_shell" checked>
                                    <span class="stg-check-label">${t('hudShell')}<span class="stg-check-tag">my_Shell</span></span>
                                </label>
                                <label class="stg-check-item">
                                    <input type="checkbox" class="stg-checkbox" data-bt-item="bt_mine" checked>
                                    <span class="stg-check-label">${t('hudMine')}<span class="stg-check-tag">my_Mine</span></span>
                                </label>
                                <label class="stg-check-item">
                                    <input type="checkbox" class="stg-checkbox" data-bt-item="bt_enemy" checked>
                                    <span class="stg-check-label">${t('hudEnemy')}<span class="stg-check-tag">EnemyCount</span></span>
                                </label>
                                <label class="stg-check-item">
                                    <input type="checkbox" class="stg-checkbox" data-bt-item="bt_remain">
                                    <span class="stg-check-label">${t('hudRemain')}<span class="stg-check-tag">RemaingPlayer</span></span>
                                </label>
                            </div>

                            <hr class="ovl-divider">

                            <!-- 操作レイアウト -->
                            <p class="ovl-section-label">CONTROL LAYOUT</p>
                            <div class="stg-row">
                                <span class="stg-row-label">${t('controlSize')}</span>
                                <div class="stg-slider-wrap">
                                    <input type="range" class="stg-slider" data-setting="stick_size" min="70" max="150" value="100">
                                    <span class="stg-slider-val">100%</span>
                                </div>
                            </div>
                            <div class="stg-row">
                                <span class="stg-row-label">${t('mineSize')}</span>
                                <div class="stg-slider-wrap">
                                    <input type="range" class="stg-slider" data-setting="mine_size" min="70" max="150" value="100">
                                    <span class="stg-slider-val">100%</span>
                                </div>
                            </div>
                            <div class="stg-drag-hint">
                                <span class="stg-drag-hint-icon">✥</span>
                                ${t('dragHintLandscape')}
                            </div>

                            <!-- バトル画面プレビュー -->
                            <div class="stg-preview">
                                <p class="stg-preview-label">PREVIEW — LANDSCAPE</p>
                                <div class="stg-preview-screen">
                                    <!-- グリッドフィールド（台形クリップ） -->
                                    <div class="stg-preview-field"></div>
                                    <!-- 台形フレーム（クリップ外） -->
                                    <svg class="stg-field-frame" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                                        <polygon points="5,6 95,6 97,92 3,92"/>
                                    </svg>
                                    <!-- 左上: 弾数・地雷数（台形の左辺に被せる） -->
                                    <div class="stg-preview-hud-resources">
                                        <div class="stg-preview-hud-box" data-bt="bt_shell">
                                            <span class="stg-preview-hud-key">SHELL</span>
                                            <span class="stg-preview-hud-num">5</span>
                                        </div>
                                        <div class="stg-preview-hud-box" data-bt="bt_mine">
                                            <span class="stg-preview-hud-key">MINE</span>
                                            <span class="stg-preview-hud-num">3</span>
                                        </div>
                                    </div>
                                    <!-- 上中央: タイマー（台形内中央） -->
                                    <div class="stg-preview-hud-time">
                                        <span class="stg-preview-hud-key">TIME</span>
                                        <span class="stg-preview-hud-num">00:00</span>
                                    </div>
                                    <!-- 右上: 敵カウント（台形の右上に被せる） -->
                                    <div class="stg-preview-hud-box stg-preview-hud-enemy" data-bt="bt_enemy">
                                        <span class="stg-preview-hud-key">ENEMY</span>
                                        <span class="stg-preview-hud-num">1</span>
                                    </div>
                                    <!-- 右上付近: 残存プレイヤー -->
                                    <div class="stg-preview-hud-box stg-preview-hud-remain" data-bt="bt_remain">
                                        <span class="stg-preview-hud-key">REMAIN</span>
                                        <span class="stg-preview-hud-num">3</span>
                                    </div>
                                    <!-- ドラッグ可能なボタン（絶対配置） -->
                                    <div class="stg-preview-ctrl" data-ctrl-elem="stick"
                                         style="left:${DEFAULT_POS.stick_x}%;top:${DEFAULT_POS.stick_y}%">
                                        <div class="stg-preview-stick-icon">
                                            <div class="stg-preview-stick-nub"></div>
                                        </div>
                                        <span class="stg-preview-ctrl-label">${t('controlLabel')}</span>
                                    </div>
                                    <div class="stg-preview-ctrl" data-ctrl-elem="mine"
                                         style="left:${DEFAULT_POS.mine_x}%;top:${DEFAULT_POS.mine_y}%">
                                        <div class="stg-preview-mine-icon">${t('mineLabel')}</div>
                                        <span class="stg-preview-ctrl-label">${t('mineLabel')}</span>
                                    </div>
                                </div>
                            </div>

                        </div><!-- /stg-landscape-sec -->

                        <!-- 縦向き設定 -->
                        <div class="stg-portrait-sec" hidden>

                            <p class="ovl-section-label">BATTLE DISPLAY</p>
                            <div class="stg-checklist">
                                <label class="stg-check-item">
                                    <input type="checkbox" class="stg-checkbox" data-pt-bt-item="pt_bt_shell" checked>
                                    <span class="stg-check-label">${t('hudShell')}<span class="stg-check-tag">my_Shell</span></span>
                                </label>
                                <label class="stg-check-item">
                                    <input type="checkbox" class="stg-checkbox" data-pt-bt-item="pt_bt_mine" checked>
                                    <span class="stg-check-label">${t('hudMine')}<span class="stg-check-tag">my_Mine</span></span>
                                </label>
                                <label class="stg-check-item">
                                    <input type="checkbox" class="stg-checkbox" data-pt-bt-item="pt_bt_enemy" checked>
                                    <span class="stg-check-label">${t('hudEnemy')}<span class="stg-check-tag">EnemyCount</span></span>
                                </label>
                                <label class="stg-check-item">
                                    <input type="checkbox" class="stg-checkbox" data-pt-bt-item="pt_bt_remain">
                                    <span class="stg-check-label">${t('hudRemain')}<span class="stg-check-tag">RemaingPlayer</span></span>
                                </label>
                            </div>

                            <hr class="ovl-divider">

                            <p class="ovl-section-label">CONTROL LAYOUT</p>
                            <div class="stg-row">
                                <span class="stg-row-label">${t('controlSize')}</span>
                                <div class="stg-slider-wrap">
                                    <input type="range" class="stg-slider" data-setting="pt_stick_size" min="70" max="150" value="100">
                                    <span class="stg-slider-val">100%</span>
                                </div>
                            </div>
                            <div class="stg-row">
                                <span class="stg-row-label">${t('mineSize')}</span>
                                <div class="stg-slider-wrap">
                                    <input type="range" class="stg-slider" data-setting="pt_mine_size" min="70" max="150" value="100">
                                    <span class="stg-slider-val">100%</span>
                                </div>
                            </div>
                            <div class="stg-drag-hint">
                                <span class="stg-drag-hint-icon">✥</span>
                                ${t('dragHintPortrait')}
                            </div>

                            <!-- バトル画面プレビュー（縦） -->
                            <div class="stg-preview">
                                <p class="stg-preview-label">PREVIEW — PORTRAIT</p>
                                <div class="stg-pt-preview-wrap">
                                    <div class="stg-preview-screen stg-preview-screen--portrait">
                                        <!-- グリッドフィールド（台形クリップ、上半分） -->
                                        <div class="stg-preview-field stg-preview-field--portrait"></div>
                                        <!-- 台形フレーム -->
                                        <svg class="stg-field-frame" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                                            <polygon points="8,3 92,3 94,46 6,46"/>
                                        </svg>
                                        <!-- 左上: 弾数・地雷数 -->
                                        <div class="stg-preview-hud-resources">
                                            <div class="stg-preview-hud-box" data-pt-bt="pt_bt_shell">
                                                <span class="stg-preview-hud-key">SHELL</span>
                                                <span class="stg-preview-hud-num">5</span>
                                            </div>
                                            <div class="stg-preview-hud-box" data-pt-bt="pt_bt_mine">
                                                <span class="stg-preview-hud-key">MINE</span>
                                                <span class="stg-preview-hud-num">3</span>
                                            </div>
                                        </div>
                                        <!-- 上中央: タイマー -->
                                        <div class="stg-preview-hud-time">
                                            <span class="stg-preview-hud-key">TIME</span>
                                            <span class="stg-preview-hud-num">00:00</span>
                                        </div>
                                        <!-- 右上: 敵カウント -->
                                        <div class="stg-preview-hud-box stg-preview-hud-enemy" data-pt-bt="pt_bt_enemy">
                                            <span class="stg-preview-hud-key">ENEMY</span>
                                            <span class="stg-preview-hud-num">1</span>
                                        </div>
                                        <!-- 右上付近: 残存プレイヤー -->
                                        <div class="stg-preview-hud-box stg-preview-hud-remain" data-pt-bt="pt_bt_remain">
                                            <span class="stg-preview-hud-key">REMAIN</span>
                                            <span class="stg-preview-hud-num">3</span>
                                        </div>
                                        <!-- 下半分コントロールゾーン -->
                                        <div class="stg-pt-ctrl-zone"></div>
                                        <!-- ドラッグ可能なボタン（下半分に制限） -->
                                        <div class="stg-preview-ctrl" data-ctrl-elem="pt-stick"
                                             style="left:${DEFAULT_POS.pt_stick_x}%;top:${DEFAULT_POS.pt_stick_y}%">
                                            <div class="stg-preview-stick-icon">
                                                <div class="stg-preview-stick-nub"></div>
                                            </div>
                                            <span class="stg-preview-ctrl-label">${t('controlLabel')}</span>
                                        </div>
                                        <div class="stg-preview-ctrl" data-ctrl-elem="pt-mine"
                                             style="left:${DEFAULT_POS.pt_mine_x}%;top:${DEFAULT_POS.pt_mine_y}%">
                                            <div class="stg-preview-mine-icon">${t('mineLabel')}</div>
                                            <span class="stg-preview-ctrl-label">${t('mineLabel')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div><!-- /stg-portrait-sec -->

                        <div class="stg-panel-footer">
                            <button class="stg-reset-btn" data-panel-reset="2">${t('resetDefault')}</button>
                            <button class="stg-save-btn" data-panel-save="2">${t('save')}</button>
                        </div>
                    </div>

                    <!-- ===================== 設定３: カーソル ===================== -->
                    <div class="stg-panel" data-panel="3">

                        <p class="ovl-section-label">CURSOR</p>
                        <div class="stg-row">
                            <span class="stg-row-label">${t('cursorDisplay')}</span>
                            <div class="stg-btn-group">
                                <button class="stg-option-btn stg-option-btn--active" data-setting="cursor_enabled" data-value="on">ON</button>
                                <button class="stg-option-btn" data-setting="cursor_enabled" data-value="off">OFF</button>
                            </div>
                        </div>
                        <div class="stg-row">
                            <span class="stg-row-label">${t('aimLine')}</span>
                            <div class="stg-btn-group">
                                <button class="stg-option-btn" data-setting="line_enabled" data-value="on">ON</button>
                                <button class="stg-option-btn stg-option-btn--active" data-setting="line_enabled" data-value="off">OFF</button>
                            </div>
                        </div>

                        <hr class="ovl-divider">

                        <p class="ovl-section-label">APPEARANCE</p>
                        <div class="stg-row">
                            <span class="stg-row-label">${t('cursorSize')}</span>
                            <div class="stg-slider-wrap">
                                <input type="range" class="stg-slider" data-setting="cursor_size" min="50" max="200" value="100">
                                <span class="stg-slider-val">100%</span>
                            </div>
                        </div>
                        <div class="stg-row">
                            <span class="stg-row-label">${t('cursorHue')}</span>
                            <div class="stg-slider-wrap">
                                <input type="range" class="stg-slider stg-slider--hue" data-setting="cursor_hue" min="0" max="360" value="0">
                                <span class="stg-slider-val">0°</span>
                            </div>
                        </div>
                        <div class="stg-row">
                            <span class="stg-row-label">${t('cursorBrightness')}</span>
                            <div class="stg-slider-wrap">
                                <input type="range" class="stg-slider" data-setting="cursor_brightness" min="50" max="150" value="100">
                                <span class="stg-slider-val">100%</span>
                            </div>
                        </div>

                        <div class="stg-cursor-preview-wrap">
                            <p class="stg-preview-label">PREVIEW</p>
                            <div class="stg-cursor-preview-box">
                                <img class="stg-cursor-preview-img" src="/assets/icon/Icon_Cursor.png" alt="" draggable="false">
                            </div>
                        </div>

                        <div class="stg-panel-footer">
                            <button class="stg-reset-btn" data-panel-reset="3">${t('resetDefault')}</button>
                            <button class="stg-save-btn" data-panel-save="3">${t('save')}</button>
                        </div>
                    </div>

                </div><!-- /stg-content -->
            </div>
        `;

        document.body.appendChild(backdrop);
        requestAnimationFrame(() => backdrop.classList.add('ovl-backdrop--visible'));

        const close = () => this.closeOverlay(backdrop, handleKey);
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
        backdrop.querySelector('.ovl-close-btn')?.addEventListener('click', () => {
            SoundManager.instance.playSE(SE.CANCEL);
            close();
        });

        // タブ切り替え
        backdrop.querySelectorAll('.stg-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabNum = (tab as HTMLElement).dataset.tab;
                backdrop.querySelectorAll('.stg-tab').forEach(t => t.classList.remove('stg-tab--active'));
                backdrop.querySelectorAll('.stg-panel').forEach(p => p.classList.remove('stg-panel--active'));
                tab.classList.add('stg-tab--active');
                backdrop.querySelector(`.stg-panel[data-panel="${tabNum}"]`)?.classList.add('stg-panel--active');
            });
        });

        this.setupPanel1(backdrop);
        this.setupPanel2(backdrop);
        this.setupPanel3(backdrop);

        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', handleKey);
    }

    // ================================================================
    // 設定１
    // ================================================================
    private setupPanel1(backdrop: HTMLElement): void {
        const panel = backdrop.querySelector('[data-panel="1"]') as HTMLElement;

        panel.querySelectorAll('.stg-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const setting = (btn as HTMLElement).dataset.setting!;
                panel.querySelectorAll(`.stg-option-btn[data-setting="${setting}"]`)
                    .forEach(b => b.classList.remove('stg-option-btn--active'));
                btn.classList.add('stg-option-btn--active');
            });
        });

        const updateSlider = (input: HTMLInputElement) => {
            const pct = ((+input.value - +input.min) / (+input.max - +input.min)) * 100;
            input.style.setProperty('--val', `${pct}%`);
            (input.nextElementSibling as HTMLElement).textContent = input.value;
        };
        panel.querySelectorAll<HTMLInputElement>('.stg-slider').forEach(input => {
            updateSlider(input);
            input.addEventListener('input', () => updateSlider(input));
        });

        const saved = this.loadSettings('tankpath-settings');
        if (saved.lang) this.setOptionBtn(panel, 'lang', saved.lang as string);
        (['bgm', 'sfx'] as const).forEach(key => {
            if (saved[key] != null) {
                const el = panel.querySelector<HTMLInputElement>(`.stg-slider[data-setting="${key}"]`)!;
                el.value = String(saved[key]);
                updateSlider(el);
            }
        });
        if (saved.graphics) this.setOptionBtn(panel, 'graphics', saved.graphics as string);

        panel.querySelector('[data-panel-save="1"]')?.addEventListener('click', (e) => {
            const lang     = this.getOptionValue(panel, 'lang')     ?? 'ja';
            const bgm      = panel.querySelector<HTMLInputElement>('.stg-slider[data-setting="bgm"]')?.value ?? '80';
            const sfx      = panel.querySelector<HTMLInputElement>('.stg-slider[data-setting="sfx"]')?.value ?? '80';
            const graphics = this.getOptionValue(panel, 'graphics') ?? 'high';
            setLang(lang as Lang);
            localStorage.setItem('tankpath-settings', JSON.stringify({ lang, bgm: +bgm, sfx: +sfx, graphics }));
            SoundManager.instance.setBgmVolume(+bgm);
            SoundManager.instance.setSfxVolume(+sfx);
            this.flashSaved(e.currentTarget as HTMLButtonElement);
        });

        panel.querySelector('[data-panel-reset="1"]')?.addEventListener('click', () => {
            this.setOptionBtn(panel, 'lang', 'ja');
            this.setOptionBtn(panel, 'graphics', 'high');
            panel.querySelectorAll<HTMLInputElement>('.stg-slider').forEach(input => {
                input.value = '80';
                updateSlider(input);
            });
        });
    }

    // ================================================================
    // 設定２
    // ================================================================
    private setupPanel2(backdrop: HTMLElement): void {
        const panel        = backdrop.querySelector('[data-panel="2"]') as HTMLElement;
        const landscapeSec = panel.querySelector('.stg-landscape-sec') as HTMLElement;
        const portraitSec  = panel.querySelector('.stg-portrait-sec')  as HTMLElement;
        const hintLs       = panel.querySelector('.stg-hint--ls')      as HTMLElement;
        const hintPt       = panel.querySelector('.stg-hint--pt')      as HTMLElement;

        // オプションボタン汎用ハンドラ
        panel.querySelectorAll('.stg-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const setting = (btn as HTMLElement).dataset.setting!;
                panel.querySelectorAll(`.stg-option-btn[data-setting="${setting}"]`)
                    .forEach(b => b.classList.remove('stg-option-btn--active'));
                btn.classList.add('stg-option-btn--active');
            });
        });

        // 向き切り替え
        const setOrientation = (value: string) => {
            const isLs = value === 'landscape';
            hintLs.hidden = !isLs;
            hintPt.hidden = isLs;
            hintLs.classList.toggle('stg-hint--active', isLs);
            hintPt.classList.toggle('stg-hint--active', !isLs);
            landscapeSec.hidden = !isLs;
            portraitSec.hidden  = isLs;
        };
        panel.querySelectorAll('.stg-option-btn[data-setting="orientation"]').forEach(btn => {
            btn.addEventListener('click', () => setOrientation((btn as HTMLElement).dataset.value!));
        });

        // HUD プレビュー更新
        const updateHUD = () => {
            panel.querySelectorAll<HTMLInputElement>('.stg-checkbox').forEach(cb => {
                const key = cb.dataset.btItem!;
                panel.querySelector(`.stg-preview-screen [data-bt="${key}"]`)
                    ?.classList.toggle('stg-preview-item--off', !cb.checked);
            });
        };
        panel.querySelectorAll<HTMLInputElement>('.stg-checkbox').forEach(cb => {
            cb.addEventListener('change', updateHUD);
        });

        // ドラッグ配置
        const screen   = panel.querySelector('.stg-preview-screen') as HTMLElement;
        const stickEl  = panel.querySelector('[data-ctrl-elem="stick"]') as HTMLElement;
        const mineEl   = panel.querySelector('[data-ctrl-elem="mine"]')  as HTMLElement;

        // 保存済み設定を復元
        const saved = this.loadSettings('tankpath-settings-mobile');

        const initOrientation = (saved.orientation as string | undefined) ?? 'landscape';
        this.setOptionBtn(panel, 'orientation', initOrientation);
        setOrientation(initOrientation);

        const btKeys = ['bt_shell', 'bt_mine', 'bt_enemy', 'bt_remain'] as const;
        btKeys.forEach(key => {
            const cb = panel.querySelector<HTMLInputElement>(`.stg-checkbox[data-bt-item="${key}"]`)!;
            if (saved[key] !== undefined) cb.checked = saved[key] as boolean;
        });
        updateHUD();

        // ボタン位置を復元してドラッグを有効化
        this.applyPos(stickEl,
            (saved.stick_x as number | undefined) ?? DEFAULT_POS.stick_x,
            (saved.stick_y as number | undefined) ?? DEFAULT_POS.stick_y);
        this.applyPos(mineEl,
            (saved.mine_x as number | undefined) ?? DEFAULT_POS.mine_x,
            (saved.mine_y as number | undefined) ?? DEFAULT_POS.mine_y);

        this.makeDraggable(stickEl, screen);
        this.makeDraggable(mineEl,  screen);

        // サイズスライダー共通処理
        const updateSizeSlider = (input: HTMLInputElement) => {
            const pct = ((+input.value - +input.min) / (+input.max - +input.min)) * 100;
            input.style.setProperty('--val', `${pct}%`);
            (input.nextElementSibling as HTMLElement).textContent = `${input.value}%`;
        };
        const stickSizeEl = panel.querySelector<HTMLInputElement>('.stg-slider[data-setting="stick_size"]')!;
        const mineSizeEl  = panel.querySelector<HTMLInputElement>('.stg-slider[data-setting="mine_size"]')!;
        stickSizeEl.value = String(Math.round(((saved.stick_size as number | undefined) ?? 1.0) * 100));
        mineSizeEl.value  = String(Math.round(((saved.mine_size  as number | undefined) ?? 1.0) * 100));
        updateSizeSlider(stickSizeEl);
        updateSizeSlider(mineSizeEl);

        // プレビューの初期スケールを適用
        stickEl.style.setProperty('--preview-scale', String(parseFloat(stickSizeEl.value) / 100));
        mineEl.style.setProperty('--preview-scale',  String(parseFloat(mineSizeEl.value)  / 100));

        stickSizeEl.addEventListener('input', () => {
            updateSizeSlider(stickSizeEl);
            stickEl.style.setProperty('--preview-scale', String(parseFloat(stickSizeEl.value) / 100));
        });
        mineSizeEl.addEventListener('input', () => {
            updateSizeSlider(mineSizeEl);
            mineEl.style.setProperty('--preview-scale', String(parseFloat(mineSizeEl.value) / 100));
        });

        // ── 縦向き設定 ──────────────────────────────────────────

        const ptBtKeys = ['pt_bt_shell', 'pt_bt_mine', 'pt_bt_enemy', 'pt_bt_remain'] as const;
        const ptScreenEl  = panel.querySelector('.stg-preview-screen--portrait') as HTMLElement;
        const ptStickEl   = panel.querySelector('[data-ctrl-elem="pt-stick"]')    as HTMLElement;
        const ptMineEl    = panel.querySelector('[data-ctrl-elem="pt-mine"]')     as HTMLElement;

        // 縦向き HUD プレビュー更新
        const updatePtHUD = () => {
            panel.querySelectorAll<HTMLInputElement>('.stg-checkbox[data-pt-bt-item]').forEach(cb => {
                const key = cb.dataset.ptBtItem!;
                panel.querySelector(`.stg-preview-screen--portrait [data-pt-bt="${key}"]`)
                    ?.classList.toggle('stg-preview-item--off', !cb.checked);
            });
        };
        panel.querySelectorAll<HTMLInputElement>('.stg-checkbox[data-pt-bt-item]').forEach(cb => {
            cb.addEventListener('change', updatePtHUD);
        });

        // 縦向き保存済み設定を復元
        ptBtKeys.forEach(key => {
            const cb = panel.querySelector<HTMLInputElement>(`.stg-checkbox[data-pt-bt-item="${key}"]`)!;
            cb.checked = (saved[key] !== undefined) ? (saved[key] as boolean) : (key !== 'pt_bt_remain');
        });
        updatePtHUD();

        this.applyPos(ptStickEl,
            (saved.pt_stick_x as number | undefined) ?? DEFAULT_POS.pt_stick_x,
            (saved.pt_stick_y as number | undefined) ?? DEFAULT_POS.pt_stick_y);
        this.applyPos(ptMineEl,
            (saved.pt_mine_x as number | undefined) ?? DEFAULT_POS.pt_mine_x,
            (saved.pt_mine_y as number | undefined) ?? DEFAULT_POS.pt_mine_y);

        // 縦向きは Y の最小値を 52% にして下半分に制限
        this.makeDraggable(ptStickEl, ptScreenEl, 52);
        this.makeDraggable(ptMineEl,  ptScreenEl, 52);

        // 縦向きサイズスライダー
        const ptStickSizeEl = panel.querySelector<HTMLInputElement>('.stg-slider[data-setting="pt_stick_size"]')!;
        const ptMineSizeEl  = panel.querySelector<HTMLInputElement>('.stg-slider[data-setting="pt_mine_size"]')!;

        ptStickSizeEl.value = String(Math.round(((saved.pt_stick_size as number | undefined) ?? 1.0) * 100));
        ptMineSizeEl.value  = String(Math.round(((saved.pt_mine_size  as number | undefined) ?? 1.0) * 100));
        updateSizeSlider(ptStickSizeEl);
        updateSizeSlider(ptMineSizeEl);

        ptStickEl.style.setProperty('--preview-scale', String(parseFloat(ptStickSizeEl.value) / 100));
        ptMineEl.style.setProperty('--preview-scale',  String(parseFloat(ptMineSizeEl.value)  / 100));

        ptStickSizeEl.addEventListener('input', () => {
            updateSizeSlider(ptStickSizeEl);
            ptStickEl.style.setProperty('--preview-scale', String(parseFloat(ptStickSizeEl.value) / 100));
        });
        ptMineSizeEl.addEventListener('input', () => {
            updateSizeSlider(ptMineSizeEl);
            ptMineEl.style.setProperty('--preview-scale', String(parseFloat(ptMineSizeEl.value) / 100));
        });

        // 保存
        panel.querySelector('[data-panel-save="2"]')?.addEventListener('click', (e) => {
            const data: Record<string, unknown> = {
                orientation:   this.getOptionValue(panel, 'orientation') ?? 'landscape',
                stick_x:       parseFloat(stickEl.style.left),
                stick_y:       parseFloat(stickEl.style.top),
                mine_x:        parseFloat(mineEl.style.left),
                mine_y:        parseFloat(mineEl.style.top),
                stick_size:    parseFloat(stickSizeEl.value) / 100,
                mine_size:     parseFloat(mineSizeEl.value)  / 100,
                pt_stick_x:    parseFloat(ptStickEl.style.left),
                pt_stick_y:    parseFloat(ptStickEl.style.top),
                pt_mine_x:     parseFloat(ptMineEl.style.left),
                pt_mine_y:     parseFloat(ptMineEl.style.top),
                pt_stick_size: parseFloat(ptStickSizeEl.value) / 100,
                pt_mine_size:  parseFloat(ptMineSizeEl.value)  / 100,
            };
            btKeys.forEach(key => {
                data[key] = panel.querySelector<HTMLInputElement>(`.stg-checkbox[data-bt-item="${key}"]`)?.checked ?? false;
            });
            ptBtKeys.forEach(key => {
                data[key] = panel.querySelector<HTMLInputElement>(`.stg-checkbox[data-pt-bt-item="${key}"]`)?.checked ?? false;
            });
            localStorage.setItem('tankpath-settings-mobile', JSON.stringify(data));
            this.flashSaved(e.currentTarget as HTMLButtonElement);
        });

        // デフォルトに戻す
        panel.querySelector('[data-panel-reset="2"]')?.addEventListener('click', () => {
            this.setOptionBtn(panel, 'orientation', 'landscape');
            setOrientation('landscape');

            this.applyPos(stickEl, DEFAULT_POS.stick_x, DEFAULT_POS.stick_y);
            this.applyPos(mineEl,  DEFAULT_POS.mine_x,  DEFAULT_POS.mine_y);

            stickSizeEl.value = '100';
            mineSizeEl.value  = '100';
            updateSizeSlider(stickSizeEl);
            updateSizeSlider(mineSizeEl);

            (panel.querySelector<HTMLInputElement>('.stg-checkbox[data-bt-item="bt_shell"]')!).checked  = true;
            (panel.querySelector<HTMLInputElement>('.stg-checkbox[data-bt-item="bt_mine"]')!).checked   = true;
            (panel.querySelector<HTMLInputElement>('.stg-checkbox[data-bt-item="bt_enemy"]')!).checked  = true;
            (panel.querySelector<HTMLInputElement>('.stg-checkbox[data-bt-item="bt_remain"]')!).checked = false;
            updateHUD();

            // 縦向きリセット
            this.applyPos(ptStickEl, DEFAULT_POS.pt_stick_x, DEFAULT_POS.pt_stick_y);
            this.applyPos(ptMineEl,  DEFAULT_POS.pt_mine_x,  DEFAULT_POS.pt_mine_y);
            ptStickSizeEl.value = '100';
            ptMineSizeEl.value  = '100';
            updateSizeSlider(ptStickSizeEl);
            updateSizeSlider(ptMineSizeEl);
            ptStickEl.style.setProperty('--preview-scale', '1');
            ptMineEl.style.setProperty('--preview-scale',  '1');

            ptBtKeys.forEach(key => {
                const cb = panel.querySelector<HTMLInputElement>(`.stg-checkbox[data-pt-bt-item="${key}"]`)!;
                cb.checked = key !== 'pt_bt_remain';
            });
            updatePtHUD();
        });
    }

    // ================================================================
    // 設定３
    // ================================================================
    private setupPanel3(backdrop: HTMLElement): void {
        const panel      = backdrop.querySelector('[data-panel="3"]') as HTMLElement;
        const previewImg = panel.querySelector<HTMLImageElement>('.stg-cursor-preview-img')!;

        // オプションボタン
        panel.querySelectorAll('.stg-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const setting = (btn as HTMLElement).dataset.setting!;
                panel.querySelectorAll(`.stg-option-btn[data-setting="${setting}"]`)
                    .forEach(b => b.classList.remove('stg-option-btn--active'));
                btn.classList.add('stg-option-btn--active');
            });
        });

        const sizeEl       = panel.querySelector<HTMLInputElement>('.stg-slider[data-setting="cursor_size"]')!;
        const hueEl        = panel.querySelector<HTMLInputElement>('.stg-slider[data-setting="cursor_hue"]')!;
        const brightnessEl = panel.querySelector<HTMLInputElement>('.stg-slider[data-setting="cursor_brightness"]')!;

        const updatePreview = () => {
            const sizePx = Math.round(40 * parseFloat(sizeEl.value) / 100);
            previewImg.style.width  = `${sizePx}px`;
            previewImg.style.height = `${sizePx}px`;
            previewImg.style.filter =
                `hue-rotate(${hueEl.value}deg) brightness(${parseFloat(brightnessEl.value) / 100})`;
        };

        // バトル画面が開いていれば即時反映する
        const applyToGame = () => {
            const cursorEl    = document.getElementById('bc-cursor') as HTMLElement | null;
            const aimLineEl   = document.getElementById('bc-aim-line') as SVGElement | null;
            const battleScene = document.querySelector<HTMLElement>('.battle-scene');
            if (!cursorEl) return;
            const enabled = this.getOptionValue(panel, 'cursor_enabled') !== 'off';
            if (!enabled) {
                cursorEl.style.display = 'none';
                battleScene?.classList.remove('bc-custom-cursor');
                return;
            }
            const isTouch = window.matchMedia('(pointer: coarse)').matches;
            if (!isTouch) battleScene?.classList.add('bc-custom-cursor');
            const sizePx = Math.round(40 * parseFloat(sizeEl.value) / 100);
            cursorEl.style.width  = `${sizePx}px`;
            cursorEl.style.height = `${sizePx}px`;
            const img = cursorEl.querySelector<HTMLImageElement>('img');
            if (img) img.style.filter =
                `hue-rotate(${hueEl.value}deg) brightness(${parseFloat(brightnessEl.value) / 100})`;

            if (aimLineEl) {
                const lineOn = this.getOptionValue(panel, 'line_enabled') !== 'off';
                aimLineEl.style.display = lineOn ? 'block' : 'none';
            }
        };

        const updatePctSlider = (input: HTMLInputElement) => {
            const pct = ((+input.value - +input.min) / (+input.max - +input.min)) * 100;
            input.style.setProperty('--val', `${pct}%`);
            (input.nextElementSibling as HTMLElement).textContent = `${input.value}%`;
            updatePreview();
            applyToGame();
        };

        const updateHueSlider = (input: HTMLInputElement) => {
            input.style.setProperty('--val', `${(+input.value / 360) * 100}%`);
            (input.nextElementSibling as HTMLElement).textContent = `${input.value}°`;
            updatePreview();
            applyToGame();
        };

        sizeEl.addEventListener('input',       () => updatePctSlider(sizeEl));
        hueEl.addEventListener('input',        () => updateHueSlider(hueEl));
        brightnessEl.addEventListener('input', () => updatePctSlider(brightnessEl));

        // ON/OFF 切り替え時も即時反映
        panel.querySelectorAll('.stg-option-btn[data-setting="cursor_enabled"]')
            .forEach(btn => btn.addEventListener('click', () => applyToGame()));
        panel.querySelectorAll('.stg-option-btn[data-setting="line_enabled"]')
            .forEach(btn => btn.addEventListener('click', () => applyToGame()));

        // 保存済み設定を復元
        const saved = this.loadSettings('tankpath-settings-cursor');
        this.setOptionBtn(panel, 'cursor_enabled', saved.enabled === false ? 'off' : 'on');
        this.setOptionBtn(panel, 'line_enabled',   saved.lineEnabled === true ? 'on' : 'off');
        if (saved.size       != null) sizeEl.value       = String(saved.size);
        if (saved.hue        != null) hueEl.value        = String(saved.hue);
        if (saved.brightness != null) brightnessEl.value = String(saved.brightness);

        updatePctSlider(sizeEl);
        updateHueSlider(hueEl);
        updatePctSlider(brightnessEl);

        // 保存
        panel.querySelector('[data-panel-save="3"]')?.addEventListener('click', (e) => {
            localStorage.setItem('tankpath-settings-cursor', JSON.stringify({
                enabled:     this.getOptionValue(panel, 'cursor_enabled') !== 'off',
                lineEnabled: this.getOptionValue(panel, 'line_enabled') !== 'off',
                size:        +sizeEl.value,
                hue:         +hueEl.value,
                brightness:  +brightnessEl.value,
            }));
            this.flashSaved(e.currentTarget as HTMLButtonElement);
        });

        // デフォルトに戻す
        panel.querySelector('[data-panel-reset="3"]')?.addEventListener('click', () => {
            this.setOptionBtn(panel, 'cursor_enabled', 'on');
            this.setOptionBtn(panel, 'line_enabled',   'off');
            sizeEl.value       = '100';
            hueEl.value        = '0';
            brightnessEl.value = '100';
            updatePctSlider(sizeEl);
            updateHueSlider(hueEl);
            updatePctSlider(brightnessEl);
            applyToGame();
        });
    }

    // ================================================================
    // ドラッグ処理
    // ================================================================
    private makeDraggable(el: HTMLElement, screen: HTMLElement, yMin = 4): void {
        el.addEventListener('pointerdown', (e: PointerEvent) => {
            // スクロール等と衝突しないようにキャプチャ
            e.preventDefault();
            el.setPointerCapture(e.pointerId);
            el.classList.add('stg-preview-ctrl--dragging');

            const rect      = screen.getBoundingClientRect();
            const startCX   = e.clientX;
            const startCY   = e.clientY;
            const startLeft = parseFloat(el.style.left);
            const startTop  = parseFloat(el.style.top);

            const onMove = (ev: PointerEvent) => {
                const dx = ((ev.clientX - startCX) / rect.width)  * 100;
                const dy = ((ev.clientY - startCY) / rect.height) * 100;
                this.applyPos(
                    el,
                    Math.max(4,    Math.min(96, startLeft + dx)),
                    Math.max(yMin, Math.min(96, startTop  + dy)),
                );
            };

            const onUp = (ev: PointerEvent) => {
                el.releasePointerCapture(ev.pointerId);
                el.classList.remove('stg-preview-ctrl--dragging');
                el.removeEventListener('pointermove', onMove);
                el.removeEventListener('pointerup',   onUp);
            };

            el.addEventListener('pointermove', onMove);
            el.addEventListener('pointerup',   onUp);
        });
    }

    private applyPos(el: HTMLElement, x: number, y: number): void {
        el.style.left = `${x}%`;
        el.style.top  = `${y}%`;
    }

    // ================================================================
    // ユーティリティ
    // ================================================================
    private setOptionBtn(scope: HTMLElement, setting: string, value: string): void {
        scope.querySelectorAll(`.stg-option-btn[data-setting="${setting}"]`)
            .forEach(b => b.classList.remove('stg-option-btn--active'));
        scope.querySelector(`.stg-option-btn[data-setting="${setting}"][data-value="${value}"]`)
            ?.classList.add('stg-option-btn--active');
    }

    private getOptionValue(scope: HTMLElement, setting: string): string | undefined {
        return (scope.querySelector(`.stg-option-btn--active[data-setting="${setting}"]`) as HTMLElement | null)
            ?.dataset.value;
    }

    private loadSettings(key: string): Record<string, unknown> {
        try { return JSON.parse(localStorage.getItem(key) ?? '{}'); }
        catch { return {}; }
    }

    private flashSaved(btn: HTMLButtonElement): void {
        btn.textContent = t('saved');
        btn.classList.add('stg-save-btn--done');
        setTimeout(() => {
            btn.textContent = t('save');
            btn.classList.remove('stg-save-btn--done');
        }, 1500);
    }

    private closeOverlay(backdrop: HTMLElement, handleKey: (e: KeyboardEvent) => void): void {
        document.removeEventListener('keydown', handleKey);
        backdrop.classList.remove('ovl-backdrop--visible');
        backdrop.classList.add('ovl-backdrop--closing');
        setTimeout(() => backdrop.remove(), 220);
    }
}
