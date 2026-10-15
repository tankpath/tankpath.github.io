import { MinePlacementCondition } from '../../../../Definition/PrerequisiteAI';
import type { MinePlacementDecision, MinePlacementDecisionInput } from './DecisionTypes';

export class DecisionMinePlace {

    constructor() {}

    decide(input: MinePlacementDecisionInput): MinePlacementDecision {
        switch (input.pattern) {
            case 'negative': return this._decideNegative(input);
            case 'positive': return this._decidePositive(input);
            case 'passage':  return this._decidePassage(input);
            default:         return this._decidePositive(input);
        }
    }

    // ============================================================
    // ■ negative：初期30秒は設置しない。以降は前回設置からのインターバル
    // ============================================================

    private _decideNegative(input: MinePlacementDecisionInput): MinePlacementDecision {
        const { gameElapsedSec, elapsedSinceLastPlace, cooldown } = input;

        if (gameElapsedSec < cooldown) return { shouldPlace: false };

        return { shouldPlace: MinePlacementCondition.isNegativeReady(elapsedSinceLastPlace, cooldown) };
    }

    // ============================================================
    // ■ positive：既存地雷の誘爆範囲外なら設置
    // ============================================================

    private _decidePositive(input: MinePlacementDecisionInput): MinePlacementDecision {
        const { distSqToNearestMine, nearestMineExplodeRange } = input;

        return { shouldPlace: MinePlacementCondition.isOutsideChainRange(distSqToNearestMine, nearestMineExplodeRange) };
    }

    // ============================================================
    // ■ passage：3マス通路の中央セルにいれば設置
    // ============================================================

    private _decidePassage(input: MinePlacementDecisionInput): MinePlacementDecision {
        const { forwardClear, backwardClear, leftWall, rightWall } = input;

        return { shouldPlace: MinePlacementCondition.isPassageCenter(forwardClear, backwardClear, leftWall, rightWall) };
    }
}
