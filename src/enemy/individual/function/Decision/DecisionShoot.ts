import { ShootingCondition, TurrretCondition } from '../../../../Definition/PrerequisiteAI';
import type { ShootingDecision, ShootingDecisionInput } from './DecisionTypes';

export class DecisionShoot {

    constructor() {}

    decide(input: ShootingDecisionInput): ShootingDecision {
        const { perception, tank } = input;

        // ============================================================
        // ■ ZoneOffset侵入
        // ============================================================

        const shouldOffset = ShootingCondition.shouldOffset(perception);

        // ============================================================
        // ■ リロード完了
        // ============================================================

        const reloadComplete = ShootingCondition.isReloadComplete(tank);

        // ============================================================
        // ■ break_wall貫通弾か
        // ============================================================

        const allowBreakWallShot = ShootingCondition.allowBreakWallShot(tank);

        // ============================================================
        // ■ 直線上の障害物チェック（タンク→プレイヤー方向 ±2.5°以内）
        // ============================================================

        // Zone_4 内優先、なければ ObservationEquipment 経由のプレイヤーで壁チェック
        const player = perception.zonePlayer[0] ?? input.playerTank;
        const { hasWallBetween, hasBreakableWallBetween } = player
            ? ShootingCondition.scanObstaclesOnDirectLine(tank, player)
            : { hasWallBetween: false, hasBreakableWallBetween: false };

        const directlineClear = ShootingCondition.isDirectLineClear(
            hasWallBetween,
            hasBreakableWallBetween,
            allowBreakWallShot,
        );

        // ============================================================
        // ■ 砲塔回転中か
        // ============================================================

        const isRotate = TurrretCondition.isTurretRotation(tank);

        return {
            shouldOffset,
            reloadComplete,
            directlineClear,
            isRotate,
        };
    }
}