import { GameMode } from '../../Definition/GameMode';

export class StageLoadingView {
    static render(container: HTMLElement, mode: GameMode, playerCount: number = 2): void {
        container.innerHTML = `
        <div class="stageloading-scene" id="sl-scene">
            <div class="sl-scanbeam"></div>
            <div class="sl-corner sl-corner--tl"></div>
            <div class="sl-corner sl-corner--tr"></div>
            <div class="sl-corner sl-corner--bl"></div>
            <div class="sl-corner sl-corner--br"></div>

            <div class="sl-main">
                <div class="sl-top">
                    <div class="sl-header">
                        <p class="sl-header-label">>>> SYSTEM READY <<<</p>
                        <p class="sl-header-title">MISSION BRIEFING</p>
                    </div>

                    ${StageLoadingView.renderMissionData(mode, playerCount)}
                </div>

                ${StageLoadingView.renderControlsGuide()}
            </div>

            <div class="interaction-area">
                <p class="footer-msg" id="sl-footer">&lt;&lt;&lt; STANDBY &gt;&gt;&gt;</p>
            </div>
        </div>
        `;
    }

    private static renderControlsGuide(): string {
        return `
        <div class="sl-controls-area">
            <div class="sl-controls-panel sl-controls--pc">
                <div class="sl-control-item">
                    <svg class="sl-ctrl-svg" viewBox="0 0 44 66" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="3" width="38" height="60" rx="16" fill="#0a1a1a" stroke="#5ab0cc" stroke-width="1.5"/>
                        <line x1="22" y1="3" x2="22" y2="28" stroke="#5ab0cc" stroke-width="1"/>
                        <line x1="3" y1="28" x2="41" y2="28" stroke="#5ab0cc" stroke-width="1"/>
                        <circle cx="13" cy="17" r="5" fill="rgba(91,188,232,0.35)" stroke="#5BBCE8" stroke-width="1.2"/>
                        <rect x="18" y="10" width="8" height="12" rx="4" fill="none" stroke="#7ab8cc" stroke-width="1.2"/>
                    </svg>
                    <span class="sl-control-action">SHOOT</span>
                    <span class="sl-control-key">LEFT CLICK</span>
                </div>
                <div class="sl-ctrl-sep"></div>
                <div class="sl-control-item">
                    <svg class="sl-ctrl-svg" viewBox="0 0 80 56" xmlns="http://www.w3.org/2000/svg">
                        <rect x="28" y="2" width="24" height="22" rx="3" fill="rgba(91,188,232,0.15)" stroke="#5ab0cc" stroke-width="1.2"/>
                        <text x="40" y="17" text-anchor="middle" font-size="12" fill="#a0dff0" font-family="monospace" font-weight="bold">W</text>
                        <rect x="2" y="30" width="24" height="22" rx="3" fill="rgba(91,188,232,0.15)" stroke="#5ab0cc" stroke-width="1.2"/>
                        <text x="14" y="45" text-anchor="middle" font-size="12" fill="#a0dff0" font-family="monospace" font-weight="bold">A</text>
                        <rect x="28" y="30" width="24" height="22" rx="3" fill="rgba(91,188,232,0.15)" stroke="#5ab0cc" stroke-width="1.2"/>
                        <text x="40" y="45" text-anchor="middle" font-size="12" fill="#a0dff0" font-family="monospace" font-weight="bold">S</text>
                        <rect x="54" y="30" width="24" height="22" rx="3" fill="rgba(91,188,232,0.15)" stroke="#5ab0cc" stroke-width="1.2"/>
                        <text x="66" y="45" text-anchor="middle" font-size="12" fill="#a0dff0" font-family="monospace" font-weight="bold">D</text>
                    </svg>
                    <span class="sl-control-action">MOVE</span>
                    <span class="sl-control-key">W A S D</span>
                </div>
            </div>
            <div class="sl-controls-panel sl-controls--touch">
                <div class="sl-control-item">
                    <svg class="sl-ctrl-svg" viewBox="0 0 60 76" xmlns="http://www.w3.org/2000/svg">
                        <rect x="22" y="2" width="16" height="40" rx="8" fill="rgba(91,188,232,0.2)" stroke="#5ab0cc" stroke-width="1.5"/>
                        <rect x="24" y="4" width="12" height="6" rx="3" fill="none" stroke="#5ab0cc" stroke-width="0.8"/>
                        <line x1="23" y1="17" x2="37" y2="17" stroke="#5ab0cc" stroke-width="0.8" opacity="0.4"/>
                        <line x1="23" y1="28" x2="37" y2="28" stroke="#5ab0cc" stroke-width="0.8" opacity="0.4"/>
                        <circle cx="30" cy="54" r="4" fill="none" stroke="#5BBCE8" stroke-width="1.5" opacity="0.9"/>
                        <circle cx="30" cy="54" r="9" fill="none" stroke="#5BBCE8" stroke-width="1" opacity="0.55"/>
                        <circle cx="30" cy="54" r="14" fill="none" stroke="#5BBCE8" stroke-width="0.8" opacity="0.25"/>
                    </svg>
                    <span class="sl-control-action">SHOOT</span>
                    <span class="sl-control-key">TAP</span>
                </div>
                <div class="sl-ctrl-sep"></div>
                <div class="sl-control-item">
                    <svg class="sl-ctrl-svg" viewBox="0 0 76 76" xmlns="http://www.w3.org/2000/svg">
                        <rect x="26" y="2" width="24" height="72" rx="4" fill="rgba(91,188,232,0.12)" stroke="#5ab0cc" stroke-width="1.2"/>
                        <rect x="2" y="26" width="72" height="24" rx="4" fill="rgba(91,188,232,0.12)" stroke="#5ab0cc" stroke-width="1.2"/>
                        <rect x="26" y="26" width="24" height="24" fill="rgba(56,123,148,0.2)" stroke="#5ab0cc" stroke-width="0.5"/>
                        <text x="38" y="20" text-anchor="middle" font-size="14" fill="#a0dff0" font-family="monospace">&#x2191;</text>
                        <text x="38" y="65" text-anchor="middle" font-size="14" fill="#a0dff0" font-family="monospace">&#x2193;</text>
                        <text x="14" y="43" text-anchor="middle" font-size="14" fill="#a0dff0" font-family="monospace">&#x2190;</text>
                        <text x="62" y="43" text-anchor="middle" font-size="14" fill="#a0dff0" font-family="monospace">&#x2192;</text>
                    </svg>
                    <span class="sl-control-action">MOVE</span>
                    <span class="sl-control-key">D-PAD</span>
                </div>
            </div>
        </div>
        `;
    }

    private static renderMissionData(mode: GameMode, playerCount: number): string {
        switch (mode) {
            case GameMode.Solo:
            case GameMode.Team:
                return `
                <div class="sl-stats-row">
                    <div class="sl-stat-block">
                        <span class="sl-stat-label">STAGE</span>
                        <div class="sl-stat-body">
                            <div class="sl-stat-value-row">
                                <img class="sl-stat-icon sl-stat-icon--stage" src="assets/icon/Icon_Field.png" alt="" />
                                <span class="sl-stat-value" id="sl-stage-value">00</span>
                            </div>
                        </div>
                    </div>
                    <div class="sl-stat-sep"></div>
                    <div class="sl-stat-block">
                        <span class="sl-stat-label">REMAINING</span>
                        <div class="sl-stat-body">
                            <div class="sl-stat-value-row">
                                <img class="sl-stat-icon" src="assets/icon/Icon_Tank_Player.png" alt="" />
                                <span class="sl-stat-icon-x">×</span>
                                <span class="sl-stat-value" id="sl-tries-value">00</span>
                            </div>
                        </div>
                    </div>
                </div>
                `;

            case GameMode.Race:
                return StageLoadingView.renderPlayerRow('DEFEAT', playerCount);

            case GameMode.Battle:
                return StageLoadingView.renderPlayerRow('WINS', playerCount);
        }
    }

    private static renderPlayerRow(statLabel: string, playerCount: number): string {
        const blocks = Array.from({ length: playerCount }, (_, i) => `
            ${i > 0 ? '<div class="sl-stat-sep"></div>' : ''}
            <div class="sl-stat-block">
                <span class="sl-stat-label">PLAYER ${i + 1}</span>
                <span class="sl-stat-value sl-stat-value--sm" id="sl-player-${i}-value">00</span>
                <span class="sl-stat-sublabel">${statLabel}</span>
            </div>
        `).join('');

        return `
        <div class="sl-stats-row sl-stats-row--players">
            ${blocks}
        </div>
        `;
    }
}
