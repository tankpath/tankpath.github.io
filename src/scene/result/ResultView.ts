import { isPlayerType } from '../../Definition/TankDefinition';
import type { TankType, PlayerType } from '../../Definition/TankDefinition';
import { ResultManager } from '../../managers/ResultManager';
import { StageCreationManager } from '../../managers/StageCreationManager';
import { GameModeManager } from '../../managers/GameModeManager';
import { GAMEMODE_INFO } from '../../Definition/GameMode';
import { LEVEL1_FIRST_APPEARANCE } from '../../Definition/StageDefinition';
import { ENEMY_COLORS } from '../../Definition/EnemyDefinition';
import type { EnemyType } from '../../Definition/EnemyDefinition';

/** 撃破数表示の並び順: LEVEL1_FIRST_APPEARANCE 順 → destroy → squadron */
const ENEMY_SORT_ORDER: ReadonlyMap<string, number> = new Map([
    ...LEVEL1_FIRST_APPEARANCE.map(({ type }, i) => [type, i] as [string, number]),
    ['destroy',  LEVEL1_FIRST_APPEARANCE.length],
    ['squadron', LEVEL1_FIRST_APPEARANCE.length + 1],
]);

type DisplayItem = NonNullable<
    typeof GAMEMODE_INFO[keyof typeof GAMEMODE_INFO]['RL_onDisplay']
>[number];

const STAT_ITEMS: DisplayItem[] = ['StageNum', 'Time', 'DefeatEnemy'];

const ALL_PLAYERS: PlayerType[] = ['player1', 'player2', 'player3', 'player4'];

export class ResultView {

    /** container に HTML を書き出す */
    static render(container: HTMLElement): void {
        const mode    = GameModeManager.instance.currentMode;
        const display = GAMEMODE_INFO[mode].RL_onDisplay ?? [];
        const { stats: innerStats, other: innerOther } = ResultView.buildSections(display);

        container.innerHTML = `
        <div class="result-scene">
            <div class="rs-scanbeam"></div>
            <div class="rs-corner rs-corner--tl"></div>
            <div class="rs-corner rs-corner--tr"></div>
            <div class="rs-corner rs-corner--bl"></div>
            <div class="rs-corner rs-corner--br"></div>

            <div class="rs-left">
                <div class="rs-header">
                    <p class="rs-header-title">RESULT</p>
                </div>
                ${innerStats}
            </div>

            <div class="rs-right">
                <div class="rs-actions">
                    <button class="rs-btn" id="rs-back-btn">TITLE</button>
                    <button class="rs-btn rs-btn--primary" id="rs-retry-btn">RETRY</button>
                </div>
                <div class="rs-ad-slots">
                    <div class="rs-ad-slot"></div>
                    <div class="rs-ad-slot"></div>
                </div>
            </div>

            <div class="rs-full">
                ${innerOther}
            </div>
        </div>`;
    }

    // ─── セクション振り分け ──────────────────────────────────────────

    private static buildSections(display: DisplayItem[]): { stats: string; other: string } {
        const statItems  = display.filter((d): d is typeof STAT_ITEMS[number] =>
            (STAT_ITEMS as DisplayItem[]).includes(d),
        );
        const otherItems = display.filter(d => !(STAT_ITEMS as DisplayItem[]).includes(d));

        // StageNum / Time / DefeatEnemy → MISSION DATA にまとめる
        let stats = '';
        if (statItems.length > 0) {
            const rows = statItems.map(item => {
                switch (item) {
                    case 'StageNum':    return ResultView.rowStageNum();
                    case 'Time':        return ResultView.rowTime();
                    case 'DefeatEnemy': return ResultView.rowDefeatEnemy();
                    default:            return '';
                }
            }).join('');
            stats = `
            <div class="rs-divider">MISSION DATA</div>
            <div class="rs-stats">${rows}</div>`;
        }

        let other = '';
        for (const item of otherItems) {
            switch (item) {
                case 'Enemy_Sort':          other += ResultView.sectionEnemySort();          break;
                case 'MVP':                 other += ResultView.sectionMVP();                break;
                case 'Player_DefeatEnemy':  other += ResultView.sectionPlayerDefeatEnemy();  break;
                case 'Winner':              other += ResultView.sectionWinner();             break;
                case 'Player_DefeatPlayer': other += ResultView.sectionPlayerDefeatPlayer(); break;
            }
        }

        return { stats, other };
    }

    // ─── MISSION DATA 行 ─────────────────────────────────────────────

    private static rowStageNum(): string {
        const stage = StageCreationManager.instance.stageNumber;
        return `
            <div class="rs-stat-row">
                <span class="rs-stat-label">STAGE</span>
                <span class="rs-stat-value">${String(stage).padStart(2, '0')}</span>
            </div>`;
    }

    private static rowTime(): string {
        const ms    = ResultManager.instance.totalElapsedMs;
        const total = Math.floor(ms / 1000);
        const mm    = Math.floor(total / 60).toString().padStart(2, '0');
        const ss    = (total % 60).toString().padStart(2, '0');
        return `
            <div class="rs-stat-row">
                <span class="rs-stat-label">TOTAL TIME</span>
                <span class="rs-stat-value">${mm}:${ss}</span>
            </div>`;
    }

    private static rowDefeatEnemy(): string {
        const total = ResultManager.instance.records.filter(
            r => !isPlayerType(r.victimType),
        ).length;
        return `
            <div class="rs-stat-row">
                <span class="rs-stat-label">TOTAL KILLS</span>
                <span class="rs-stat-value">${total}</span>
            </div>`;
    }

    // ─── 個別セクション ──────────────────────────────────────────────

    /** 敵タンク種別ごとの撃破数（Solo 用 BREAKDOWN） */
    private static sectionEnemySort(): string {
        const enemyKills = ResultManager.instance.records.filter(
            r => !isPlayerType(r.victimType),
        );
        const countByType = new Map<TankType, number>();
        for (const r of enemyKills) {
            countByType.set(r.victimType, (countByType.get(r.victimType) ?? 0) + 1);
        }
        const rows = [...countByType.entries()]
            .filter(([type]) => type !== 'godofall')
            .sort(([a], [b]) => {
                const oa = ENEMY_SORT_ORDER.get(a) ?? 999;
                const ob = ENEMY_SORT_ORDER.get(b) ?? 999;
                return oa - ob;
            })
            .map(([type, count]) => {
                const color    = ENEMY_COLORS[type as EnemyType];
                const cssColor = color ? '#' + color.main.toString(16).padStart(6, '0') : '#76c8de';
                return `
                <div class="rs-kill-row">
                    <span class="rs-kill-name">
                        <span class="rs-kill-icon" style="background-color:${cssColor};"></span>
                        <span class="rs-kill-label">${type.toUpperCase()}</span>
                    </span>
                    <span class="rs-kill-value">${count}</span>
                </div>`;
            })
            .join('');
        return `
            <div class="rs-divider">BREAKDOWN</div>
            <div class="rs-kills">
                ${rows || '<div class="rs-kill-row"><span class="rs-kill-label">NO KILLS</span></div>'}
            </div>`;
    }

    /** MVP（仮表示） */
    private static sectionMVP(): string {
        return `
            <div class="rs-divider">MVP</div>
            <div class="rs-stats">
                <div class="rs-stat-row">
                    <span class="rs-stat-label">MVP</span>
                    <span class="rs-stat-value">---</span>
                </div>
            </div>`;
    }

    /** プレイヤーごとの敵撃破合計（Team / Race 用） */
    private static sectionPlayerDefeatEnemy(): string {
        const records = ResultManager.instance.records;
        const rows = ALL_PLAYERS.map(p => {
            const count = records.filter(
                r => r.attackerType === p && !isPlayerType(r.victimType),
            ).length;
            if (count === 0) return '';
            return `
                <div class="rs-kill-row">
                    <span class="rs-kill-label">${p.toUpperCase()}</span>
                    <span class="rs-kill-value">${count}</span>
                </div>`;
        }).join('');
        return `
            <div class="rs-divider">KILLS BY PLAYER</div>
            <div class="rs-kills">
                ${rows || '<div class="rs-kill-row"><span class="rs-kill-label">NO KILLS</span></div>'}
            </div>`;
    }

    /** 勝者を大きく表示（Race: 敵撃破最多 / Battle: プレイヤー撃破最多） */
    private static sectionWinner(): string {
        const mode   = GameModeManager.instance.currentMode;
        const winner = mode === 'Battle'
            ? ResultView.pickWinnerByPlayerKills()
            : ResultView.pickWinnerByEnemyKills();
        return `
            <div class="rs-winner">
                <div class="rs-winner-label">WINNER</div>
                <div class="rs-winner-name">${winner?.toUpperCase() ?? '---'}</div>
            </div>`;
    }

    /** プレイヤーごとのプレイヤー撃破数（Battle 用） */
    private static sectionPlayerDefeatPlayer(): string {
        const records = ResultManager.instance.records;
        const rows = ALL_PLAYERS.map(p => {
            const count = records.filter(
                r => r.attackerType === p && isPlayerType(r.victimType),
            ).length;
            if (count === 0) return '';
            return `
                <div class="rs-kill-row">
                    <span class="rs-kill-label">${p.toUpperCase()}</span>
                    <span class="rs-kill-value">${count}</span>
                </div>`;
        }).join('');
        return `
            <div class="rs-divider">PLAYER KILLS</div>
            <div class="rs-kills">
                ${rows || '<div class="rs-kill-row"><span class="rs-kill-label">NO KILLS</span></div>'}
            </div>`;
    }

    // ─── 勝者決定ヘルパー ────────────────────────────────────────────

    private static pickWinnerByEnemyKills(): PlayerType | null {
        const records = ResultManager.instance.records;
        let maxCount = 0;
        let winner: PlayerType | null = null;
        for (const p of ALL_PLAYERS) {
            const count = records.filter(
                r => r.attackerType === p && !isPlayerType(r.victimType),
            ).length;
            if (count > maxCount) { maxCount = count; winner = p; }
        }
        return winner;
    }

    private static pickWinnerByPlayerKills(): PlayerType | null {
        const records = ResultManager.instance.records;
        let maxCount = 0;
        let winner: PlayerType | null = null;
        for (const p of ALL_PLAYERS) {
            const count = records.filter(
                r => r.attackerType === p && isPlayerType(r.victimType),
            ).length;
            if (count > maxCount) { maxCount = count; winner = p; }
        }
        return winner;
    }
}
