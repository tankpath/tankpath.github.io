import { ChangeSceneEffect } from "../../Definition/SceneEffect";
import { SceneId } from "../../Definition/SceneId";
import { OverlayAction } from "../../types/btn/OverlayAction";
import { SettingsOverlayAction } from "../../types/btn/SettingsOverlayAction";
import { SceneChangeAction } from "../../types/btn/SceneChange";
import type { ClickAction } from "../../types/btn/ClickAction";
import { ENEMY_COLORS } from "../../Definition/EnemyDefinition";
import type { EnemyType } from "../../Definition/EnemyDefinition";
import { EnemyAnalyzer } from "../../Analyze/EnemyAnalyzer";
import { t } from "../../i18n/i18n";

export interface ButtonConfig {
    selector: string;
    action: ClickAction;
}

// ====================================================
// 成績オーバーレイ コンテンツビルダー
// ====================================================

/** LEVEL1_FIRST_APPEARANCE の初登場順、末尾に destroy → squadron */
const ENEMY_ORDER: EnemyType[] = [
    'detect', 'typeA', 'missile', 'multimine', 'typeB',
    'triangle', 'typeC', 'camouflage', 'split', 'pentagon',
    'apmodel', 'selectmine', 'curve', 'command', 'highspeed',
    'destroy', 'squadron',
];

const ENEMY_LABEL: Partial<Record<EnemyType, string>> = {
    highspeed:  'HIGHSPEED',
    typeA:      'TYPE-A',
    typeB:      'TYPE-B',
    typeC:      'TYPE-C',
    detect:     'DETECT',
    command:    'COMMAND',
    split:      'SPLIT',
    triangle:   'TRIANGLE',
    pentagon:   'PENTAGON',
    missile:    'MISSILE',
    curve:      'CURVE',
    camouflage: 'CAMOUFLAGE',
    multimine:  'MULTIMINE',
    selectmine: 'SELECTMINE',
    apmodel:    'AP-MODEL',
    destroy:    'DESTROY',
    squadron:   'SQUADRON',
};

function buildGradesContent(): string {
    const state  = EnemyAnalyzer.instance.getState();
    const scores = new Map<string, number>(state.scores);
    const counts = new Map<string, number>(
        state.compressed.map(([k, v]) => [k, v.count])
    );

    const rows = ENEMY_ORDER.map(type => {
        const color    = ENEMY_COLORS[type];
        const cssColor = '#' + color.main.toString(16).padStart(6, '0');
        const score    = scores.get(type);
        const count    = counts.get(type) ?? 0;
        const label    = ENEMY_LABEL[type] ?? type.toUpperCase();

        let scoreCell: string;
        if (score === undefined || count === 0) {
            scoreCell = `<span class="gr-no-data">─</span>`;
        } else {
            const pct      = Math.round((score + 1) / 2 * 100);
            const barColor = score >= 0 ? '#00EE88' : '#DD4444';
            const tag      = score >= 0.25 ? t('tagProficient') : score <= -0.25 ? t('tagWeak') : t('tagAverage');
            scoreCell = `
                <div class="gr-score">
                    <div class="gr-bar-track"><div class="gr-bar-fill" style="width:${pct}%;background:${barColor};"></div></div>
                    <span class="gr-tag" style="color:${barColor};">${tag}</span>
                </div>`;
        }

        return `
            <div class="gr-row">
                <span class="gr-icon" style="background-color:${cssColor};"></span>
                <span class="gr-name">${label}</span>
                <span class="gr-count">${count > 0 ? count + 'x' : '─'}</span>
                ${scoreCell}
            </div>`;
    }).join('');

    return `
        <p class="ovl-section-label">BATTLE RECORDS</p>
        <div class="gr-list">${rows}</div>`;
}

// ====================================================
// DATA ボタン内メニュー
// ====================================================

const dataOverlay = new OverlayAction({
    title: 'DATA',
    menuItems: [
        {
            label: () => t('gradesLabel'),
            action: new OverlayAction({
                title: t('gradesLabel'),
                content: buildGradesContent,
            })
        },
        {
            label: () => t('profileLabel'),
            action: new SceneChangeAction(SceneId.Profile, ChangeSceneEffect.Fade)
        }
    ]
});

// ====================================================
// タイトル画面ボタン設定一覧
// ====================================================

export const titleButtonConfigs: ButtonConfig[] = [
    {
        selector: '.team-btn',
        action: new OverlayAction({
            title: 'TEAM MISSION',
            content: `
                <div class="ovl-coming-soon">
                    <p class="ovl-coming-soon-title">COMING SOON</p>
                    <p class="ovl-coming-soon-sub">This mode is under development</p>
                </div>
            `
        })
    },
    {
        selector: '.data-btn',
        action: dataOverlay
    },
    {
        selector: '.jamming-btn',
        action: new OverlayAction({
            title: 'JAMMING',
            content: `
                <div class="ovl-coming-soon">
                    <p class="ovl-coming-soon-title">COMING SOON</p>
                    <p class="ovl-coming-soon-sub">This feature is under development</p>
                </div>
            `
        })
    },
    {
        selector: '.config-btn',
        action: new SettingsOverlayAction()
    },
    {
        selector: '.credit-btn',
        action: new OverlayAction({
            title: 'CREDITS',
            content: `
                <p class="ovl-section-label">DEVELOPMENT TEAM</p>
                <p class="ovl-text">TANK PATH</p>
                <hr class="ovl-divider">
                <p class="ovl-text">Developed with Three.js &amp; Rapier3D</p>
                <p class="ovl-text">Built with Vite + TypeScript</p>
            `
        })
    }
];
