import { GameMode, GAMEMODE_INFO } from '../../Definition/GameMode';
import { getMobileSettings } from '../../managers/MobileSettings';
import { t } from '../../i18n/i18n';

export class BattleView {
    static render(container: HTMLElement, mode: GameMode): void {
        const modeInfo = GAMEMODE_INFO[mode];
        const isMobile = window.matchMedia('(pointer: coarse)').matches;
        const mobile   = isMobile ? getMobileSettings() : null;

        // GameMode × モバイル設定フィルタ（縦向きは pt_bt_* を使用）
        const isPortrait    = mobile?.orientation === 'portrait';
        const inDisplay     = (key: string) => modeInfo.BT_onDisplay?.includes(key as never) ?? false;
        const showShell     = inDisplay('my_Shell')      && (mobile ? (isPortrait ? mobile.pt_bt_shell  : mobile.bt_shell)  : true);
        const showMine      = inDisplay('my_Mine')       && (mobile ? (isPortrait ? mobile.pt_bt_mine   : mobile.bt_mine)   : true);
        const showEnemy     = inDisplay('EnemyCount')    && (mobile ? (isPortrait ? mobile.pt_bt_enemy  : mobile.bt_enemy)  : true);
        const showRemaining = inDisplay('RemaingPlayer') && (mobile ? (isPortrait ? mobile.pt_bt_remain : mobile.bt_remain) : true);

        // リソースボックス (SHELL / MINE)
        const resourcesHtml = (showShell || showMine) ? `
                <div class="bc-resources-box">
                    ${showShell ? `
                    <div class="bc-resource-item">
                        <span class="bc-resource-label">SHELL</span>
                        <img class="bc-resource-icon" src="/assets/icon/Icon_Shell.png" alt="">
                        <span class="bc-resource-x">×</span>
                        <span class="bc-resource-value" id="bc-shell-value">--</span>
                    </div>` : ''}
                    ${showShell && showMine ? `<div class="bc-resource-sep"></div>` : ''}
                    ${showMine ? `
                    <div class="bc-resource-item">
                        <span class="bc-resource-label">MINE </span>
                        <img class="bc-resource-icon" src="/assets/icon/Icon_Mine.png" alt="">
                        <span class="bc-resource-x">×</span>
                        <span class="bc-resource-value" id="bc-mine-value">--</span>
                    </div>` : ''}
                </div>` : '';

        container.innerHTML = `
        <div class="battle-scene">
            <div id="battle-three-container"></div>

            <div class="battle-hud">
                <div class="bc-corner bc-corner--tl"></div>
                <div class="bc-corner bc-corner--tr"></div>
                <div class="bc-corner bc-corner--bl"></div>
                <div class="bc-corner bc-corner--br"></div>
                <div class="bc-scanlines"></div>
                <!-- 縦向きモード: コントロールエリア背景・区切り線 -->
                <div class="bc-portrait-ctrl-bg"></div>

                ${(showEnemy || showRemaining)
                    ? BattleView.renderStatusBox(
                        showEnemy ? 'ENEMY' : 'PLAYERS',
                        showEnemy
                            ? '/assets/icon/Icon_Tank_apmodel.png'
                            : '/assets/icon/Icon_Tank_Player.png'
                      )
                    : ''}

                <div class="bc-timer-box">
                    <span class="bc-timer-label">TIME</span>
                    <span class="bc-timer-value" id="bc-timer">00:00</span>
                </div>

                ${resourcesHtml}

                <!-- ステージ100 特殊演出オーバーレイ -->
                <div id="bc-stage100-overlay" class="bc-stage100-overlay">
                    <p class="bc-stage100-text">${t('stage100Text')}</p>
                </div>

                <!-- STOP ボタン -->
                <button class="bc-stop-btn">■ STOP</button>

                <!-- ポーズオーバーレイ -->
                <div id="bc-pause-overlay" class="bc-pause-overlay">
                    <div class="bc-pause-panel">
                        <p class="bc-pause-title">— PAUSED —</p>
                        <div class="bc-pause-actions">
                            <button class="bc-pause-btn bc-pause-resume">${t('pauseResume')}</button>
                            <button class="bc-pause-btn bc-pause-setting">${t('pauseSettings')}</button>
                            <button class="bc-pause-btn bc-pause-restart">${t('pauseRestart')}</button>
                            <button class="bc-pause-btn bc-pause-title-btn">${t('pauseTitle')}</button>
                        </div>

                    </div>
                </div>

                <!-- タッチ操作 ジョイスティック（独立配置） -->
                <div class="bc-stick">
                    <div class="bc-stick-nub"></div>
                </div>

                <!-- タッチ操作 地雷ボタン（独立配置） -->
                <div class="bc-touch-actions">
                    <button class="bc-touch-btn bc-touch-mine">MINE</button>
                </div>

                <!-- 縦向き: ズームスライダー -->
                <div class="bc-zoom-slider-wrap">
                    <span class="bc-zoom-slider-label">ZOOM</span>
                    <input id="bc-zoom-slider" class="bc-zoom-slider" type="range" min="100" max="300" value="100" step="10">
                </div>

                <!-- カーソル -->
                <div id="bc-cursor" class="bc-cursor">
                    <img src="/assets/icon/Icon_Cursor.png" alt="" draggable="false">
                </div>

                <!-- 照準ライン（カーソル↔自タンク） -->
                <svg id="bc-aim-line" class="bc-aim-line" aria-hidden="true">
                    <line id="bc-aim-line-el"/>
                </svg>
            </div>
        </div>
        `;
    }

    /**
     * タッチ端末用: localStorage に保存された位置設定を
     * バトル HUD のタッチコントロールへ適用する。
     * PC（pointer: fine）では何もしない。
     */
    static applyMobileControls(container: HTMLElement): void {
        if (!window.matchMedia('(pointer: coarse)').matches) return;

        const s          = getMobileSettings();
        const isPortrait = s.orientation === 'portrait';
        const scene      = container.querySelector<HTMLElement>('.battle-scene');
        const stick      = container.querySelector<HTMLElement>('.bc-stick');
        const mine       = container.querySelector<HTMLElement>('.bc-touch-actions');

        // 縦向きモード: 上60% / 下40% 固定レイアウト
        if (isPortrait && scene) {
            scene.classList.add('battle-scene--portrait');
        }

        const sx = isPortrait ? s.pt_stick_x    : s.stick_x;
        const sy = isPortrait ? s.pt_stick_y    : s.stick_y;
        const mx = isPortrait ? s.pt_mine_x     : s.mine_x;
        const my = isPortrait ? s.pt_mine_y     : s.mine_y;
        const ss = isPortrait ? s.pt_stick_size : s.stick_size;
        const ms = isPortrait ? s.pt_mine_size  : s.mine_size;

        if (stick) {
            stick.style.left = `${sx}%`;
            stick.style.top  = `${sy}%`;
            stick.classList.add('bc-ctrl--custom');
            stick.style.setProperty('--stick-scale', String(ss));
        }
        if (mine) {
            mine.style.left = `${mx}%`;
            mine.style.top  = `${my}%`;
            mine.classList.add('bc-ctrl--custom');
            mine.style.setProperty('--mine-scale', String(ms));
        }
    }

    private static renderStatusBox(label: string, iconSrc: string): string {
        return `
        <div class="bc-status-box">
            <span class="bc-status-label">${label}</span>
            <div class="bc-status-main">
                <img class="bc-status-icon" src="${iconSrc}" alt="">
                <span class="bc-resource-x">×</span>
                <span class="bc-status-value" id="bc-status-value">--</span>
            </div>
        </div>
        `;
    }
}
