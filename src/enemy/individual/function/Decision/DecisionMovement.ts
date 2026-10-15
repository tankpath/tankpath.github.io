import type { ResolvedCharacter } from '../../../master/function/DecideCharacter';
import type { MovementDecisionInput, MovementDecision } from './DecisionTypes';
import {
    EvasionCondition,
    MineDetection,
    MovementCondition,
    OwnMineZoneCondition,
} from '../../../../Definition/PrerequisiteAI';

export class DecisionMovement {

    private readonly _character: ResolvedCharacter;
    private _routeCooldown    = 0.5;
    private _currentMineCount = 0;

    // ─── 自地雷ゾーン退出トラッキング ───────────────────────────────────
    private _ownMinesCurrentlyInside: Set<string> = new Set();
    private _exitedOwnMines:          Set<string> = new Set();

    constructor(character: ResolvedCharacter) {
        this._character = character;
    }

    decide(input: MovementDecisionInput): MovementDecision {

        const { perception, navigator, reachedGoal, delta, tank } = input;

        this._routeCooldown = Math.max(0, this._routeCooldown - delta);

        // ============================================================
        // ■ 回避判断（ZoneAvoid侵入時）
        // ============================================================

        const shouldDodge = EvasionCondition.shouldDodge(perception);

        // ============================================================
        // ■ 地雷検知
        // ============================================================

        const mineDetected = MineDetection.MineDetection(perception);
        const mineNewDetected = MineDetection.MineNewDetection(perception, this._currentMineCount);
        this._currentMineCount = perception.frontMines.length;

        // ============================================================
        // ■ ルート再計算判断
        // ============================================================

        let shouldRequestRoute = false;

        const needRecalc = MovementCondition.shouldRecalculateRoute(
            navigator.hasRoute,
            reachedGoal,
        );

        if (
            needRecalc &&
            this._routeCooldown <= 0 &&
            this._character.distancePref !== null
        ) {
            shouldRequestRoute = true;
            this._routeCooldown = 2.5;
        }

        // ============================================================
        // ■ 自地雷ゾーン退出トラッキング
        // ============================================================

        OwnMineZoneCondition.trackExitedMines(
            tank.info.id,
            tank.movement.position,
            this._ownMinesCurrentlyInside,
            this._exitedOwnMines,
        );

        // ============================================================

        return {
            shouldDodge,
            shouldRequestRoute,
            mineDetected,
            mineNewDetected,
            exitedOwnMines: this._exitedOwnMines,
        };
    }
}
