import { ChangeSceneEffect } from "../../Definition/SceneEffect";
import { SceneId } from "../../Definition/SceneId";
import type { IScene } from "../IScene";

import '../title/title.css';
import { SceneChangeAction } from "../../types/btn/SceneChange";
import { titleButtonConfigs } from "./titleButtonConfigs";
import { StageCreationManager } from "../../managers/StageCreationManager";
import { GameModeManager } from "../../managers/GameModeManager";
import { GameMode } from "../../Definition/GameMode";
import { setOrientationRequirement } from "../../orientation/OrientationManager";
import { SoundManager } from "../../managers/SoundManager";
import { SE, BGM } from "../../Definition/SoundList";
import { ProfileManager } from "../../managers/ProfileManager";
import { t } from "../../i18n/i18n";

export class Title implements IScene {
    private container: HTMLElement | null = null;

    private readonly targetData = [
        { status: 'CONFIRMED', level: 'HIGH' },
        { status: 'ACTIVE',    level: 'MED'  },
        { status: 'UNKNOWN',   level: '???'  },
        { status: 'CONFIRMED', level: 'HIGH' },
        { status: 'ACTIVE',    level: 'HIGH' },
        { status: 'UNKNOWN',   level: '???'  },
        { status: 'CONFIRMED', level: 'MED'  },
        { status: 'ACTIVE',    level: 'HIGH' },
        { status: 'UNKNOWN',   level: '???'  },
    ];

    private readonly neutralizeThresholds = [10, 20, 30, 40, 50, 60, 70, 80, 100];

    private readonly buttonConfigs = [
        {
            selector: '.solo-btn',
            action: new SceneChangeAction(SceneId.StageLoading, ChangeSceneEffect.Scan)
        },
        ...titleButtonConfigs
    ]

    public mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = '';
        StageCreationManager.instance.reset();
        this.render();
        this.setupEventBtn();
        setOrientationRequirement('portrait');
        SoundManager.instance.playBGM(BGM.TITLE);
    }

    private renderCells(): string {
        const cleared = ProfileManager.instance.getClearedStages();
        return this.targetData.map((t, i) => {
            const id = String(i + 1).padStart(2, '0');
            const neutralized = cleared >= this.neutralizeThresholds[i];
            const status      = neutralized ? 'neutralized' : t.status.toLowerCase();
            const statusLabel = neutralized ? 'NEUTRALIZED' : t.status;
            const levelLabel  = neutralized ? 'THREAT: ---' : `THREAT: ${t.level}`;
            return `<div class="tmon-cell" data-status="${status}">
                        <img src="/assets/image/image${id}.png" class="tmon-cell-img" alt="" draggable="false">
                        <div class="target-reticle">
                            <span class="r-tl"></span><span class="r-tr"></span>
                            <span class="r-bl"></span><span class="r-br"></span>
                        </div>
                        <div class="target-elim"></div>
                        <div class="target-scan"></div>
                        <span class="target-name">TARGET ${id}</span>
                        <span class="target-id">TGT-${id}</span>
                        <span class="target-status">${statusLabel}</span>
                        <span class="target-level">${levelLabel}</span>
                    </div>`;
        }).join('');
    }

    private render() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="title-scene">
                <!-- ambient effects (absolute) -->
                <div class="title-scanbeam"></div>
                <div class="title-corner title-corner--tl"></div>
                <div class="title-corner title-corner--tr"></div>
                <div class="title-corner title-corner--bl"></div>
                <div class="title-corner title-corner--br"></div>

                <!-- スマホ縦専用ヘッダー（PC/横では非表示・ARMORED STRATEGY なし） -->
                <header class="title-header title-header--portrait-only">
                    <h1 class="title-logo">TANK PATH</h1>
                </header>

                <!-- 左ボタン列 + 右モニター -->
                <div class="title-body">
                    <div class="title-left">
                        <!-- PC/横画面用ヘッダー（縦スマホでは非表示） -->
                        <header class="title-header title-header--default">
                            <p class="title-sub-label">&gt;&gt;&gt; ARMORED STRATEGY &lt;&lt;&lt;</p>
                            <h1 class="title-logo">TANK PATH</h1>
                        </header>

                        <div class="title-mission-box">
                            <span class="title-box-label">PLAY THE GAME</span>
                            <button class="menu-btn solo-btn"><img src="/assets/icon/Icon_Tank_Player.png" class="btn-icon" alt="">SOLO MISSION</button>
                            <button class="menu-btn team-btn"><img src="/assets/icon/Icon_Tank_Player_Team.png" class="btn-icon" alt="">TEAM MISSION</button>
                        </div>

                        <div class="title-profile-box">
                            <span class="title-box-label">PROFILE</span>
                            <button class="menu-btn data-btn"><img src="/assets/icon/Icon_Note.png" class="btn-icon" alt="">DATA</button>
                            <button class="menu-btn jamming-btn">Ad JAMMING</button>
                        </div>

                        <div class="title-sub-box">
                            <span class="title-box-label">SYSTEM</span>
                            <button class="menu-btn config-btn"><img src="/assets/icon/Icon_Gear.png" class="btn-icon" alt="">SETTINGS</button>
                            <button class="menu-btn credit-btn">CREDITS</button>
                        </div>

                        <div class="title-social-row">
                            <a href="https://x.com/Kakikakakais_g" target="_blank" rel="noopener noreferrer" class="social-icon-btn" aria-label="X / Twitter">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.262 5.636 5.902-5.636zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                            </a>
                            <a href="https://www.youtube.com/@kakikakaka-ggg" target="_blank" rel="noopener noreferrer" class="social-icon-btn" aria-label="YouTube">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                            </a>
                        </div>
                        <div class="title-links-row">
                        <ol>
                            <li><a href="/gamerule.html" target="_blank" rel="noopener noreferrer" class="title-link">${t('linkGameRule')}</a></li>
                            <li><a href="/privacy.html" target="_blank" rel="noopener noreferrer" class="title-link">${t('linkPrivacy')}</a></li>
                            <li><a href="/contact.html" target="_blank" rel="noopener noreferrer" class="title-link">${t('linkContact')}</a></li>
                        </ol>
                        </div>
                    </div>

                <!-- 右カラム: モニター -->
                <div class="title-monitor">
                    <div class="title-monitor-frame">
                        <div class="tmon-corner tmon-corner--tl"></div>
                        <div class="tmon-corner tmon-corner--tr"></div>
                        <div class="tmon-corner tmon-corner--bl"></div>
                        <div class="tmon-corner tmon-corner--br"></div>
                        <span class="tmon-label">TARGET REGISTRY</span>
                        <div class="tmon-screen">
                            <div class="tmon-scanline"></div>
                            <div class="tmon-sweep"></div>
                            <div class="tmon-noise"></div>
                            <div class="tmon-grid">${this.renderCells()}</div>
                        </div>
                    </div>
                </div>
                </div><!-- /.title-body -->
            </div>
        `;
    }

    private setupEventBtn() {
        this.buttonConfigs.forEach(({ selector, action }) => {
            const btn = this.container?.querySelector(selector);
            if (!btn) return;
            if (selector === '.solo-btn') {
                GameModeManager.instance.setMode(GameMode.Solo);
            }
            btn.addEventListener('click', () => {
                SoundManager.instance.playSE(SE.DECISION);
                action.execute();
            });
        });
    }

    public unmount(): void {
        SoundManager.instance.stopBGM();
        if (this.container) this.container.innerHTML = '';
    }
}
