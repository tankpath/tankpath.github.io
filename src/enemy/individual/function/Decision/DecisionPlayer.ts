import { PlayerCondition } from '../../../../Definition/PrerequisiteAI';
import type { Tank } from '../../../../object/tank/Tank';
import type { PlayerDecision, PlayerDecisionInput } from './DecisionTypes';

export class DecisionPlayer {
    private _lastPlayerRemainingShots: number | null = null;

    constructor() {}

    decide(input: PlayerDecisionInput): PlayerDecision {
        const { perception, tank, playerTank } = input;

        // ============================================================
        // ■ プレイヤーを感知したか
        // ============================================================

        const playerDetected = PlayerCondition.isPlayerDetected(perception);

        // ============================================================
        // ■ プレイヤーの向き（縦・横・斜め）
        // Zone_4 内のみ有効（近距離で向きが意味を持つ）
        // ============================================================

        const zonePlayer = perception.zonePlayer[0];
        const facingDirection = zonePlayer
            ? PlayerCondition.getPlayerFacingDirection(zonePlayer, tank)
            : null;

        // ============================================================
        // ■ プレイヤーが発砲したか（残弾数の減少で検知）
        // Zone_4外でも playerTank 経由で検知する
        // ============================================================

        const fireTarget = zonePlayer ?? playerTank;
        const playerFired = fireTarget
            ? this._detectPlayerFired(fireTarget)
            : false;

        return {
            playerDetected,
            facingDirection,
            playerFired,
        };
    }

    private _detectPlayerFired(player: Tank): boolean {
        const current = player.shot.remainingShots;
        const fired   = this._lastPlayerRemainingShots !== null
            && current < this._lastPlayerRemainingShots;
        this._lastPlayerRemainingShots = current;
        return fired;
    }
}
