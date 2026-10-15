// 各種判断の条件を設定する
import * as THREE from 'three';
import type { SensorData } from '../enemy/individual/function/Detector/Sensor';
import type { Tank } from '../object/tank/Tank';
import { StageObjectManager } from '../managers/StageObjectManager';

import { SHELL_STATS } from './ShellDefinition';

// これは各エネミーにつけるための純粋関数群

// まず、各種判断を設置する条件
export class PrerequisiteAI {
    /** 地雷設置判断の前提条件：地雷タイプが none でないこと */
    static canEvaluateMinePlacement(tank: Tank): boolean {
        return tank.minePlacer.mineType !== 'none';
    }

    /** 移動、回避判断の前提条件：移動速度が０でないこと */
    static canEvaluateMovement(tank: Tank): boolean {
        return tank.movement.speed !== 0;
    }

    /**
     * 自タンクの周囲 4 セル以内に他の敵タンクがいなければ true を返す（地雷設置許可の前提条件）。
     */
    static isNoEnemyNearby(tank: Tank, cellSize: number): boolean {
        const pos       = tank.movement.position;
        const threshold = 4 * cellSize;
        for (const enemy of StageObjectManager.instance.enemyTanks) {
            if (enemy === tank) continue;
            if (!enemy.isAlive)  continue;
            const ep   = enemy.movement.position;
            const dx   = ep.x - pos.x;
            const dz   = ep.z - pos.z;
            if (dx * dx + dz * dz < threshold * threshold) return false;
        }
        return true;
    }

    /**
     * タンクの現在位置が、フィールド上のいずれの地雷の爆発範囲 + 2.5 セルからも
     * 十分離れていれば true を返す（地雷設置許可の優先判定）。
     */
    static isFarEnoughFromAnyMine(tank: Tank, cellSize: number): boolean {
        const pos = tank.movement.position;
        for (const { mine } of StageObjectManager.instance.allMines) {
            const mp        = mine.object.position;
            const dx        = mp.x - pos.x;
            const dz        = mp.z - pos.z;
            const distSq    = dx * dx + dz * dz;
            const threshold = 6 * cellSize;
            if (distSq < threshold * threshold) return false;
        }
        return true;
    }
}

// DecisionMovement.ts
export class EvasionCondition {
    /** ZoneAvoidに弾が侵入したとき */
    static shouldDodge(perception: SensorData): boolean {
        return perception.zoneAvoid.length > 0;
    }
}
export class MineDetection {
    /** 地雷を検知 */
    static MineDetection(perception: SensorData): boolean {
        return perception.frontMines.length > 0;
    }
    /** 新しく地雷を検知したとき */
    static MineNewDetection(perception: SensorData, mineCount: number): boolean {
        return perception.frontMines.length > mineCount;
    }
}
export class MovementCondition {
    /** 目的地に到達したか */
    static hasReachedDestination(distanceToGoal: number, threshold = 0.1): boolean {
        return distanceToGoal <= threshold;
    }
    /** ルート再計算が必要か */
    static shouldRecalculateRoute(
        hasRoute: boolean,
        reachedGoal: boolean,
    ): boolean {
        return !hasRoute || reachedGoal;
    }
    /** 受け取れるウェイポイント数を制限する */
    static routeLimit(routeLength: number, ratio: number): number {
        return Math.max(1, Math.ceil(routeLength * ratio));
    }
}

// DecisionShoot.ts
export class ShootingCondition {
    // ZoneOffset侵入時
    static shouldOffset(perception: SensorData): boolean {
        return perception.zoneOffset.length > 0;
    }
    // リロード完了したか
    static isReloadComplete(tank: Tank): boolean {
        return tank.shot.canShoot();
    }

    static allowBreakWallShot(tank: Tank): boolean {
        const type = tank.shot.bulletType;
        return type === 'CoreBreaker' || type === 'CoreBreaker_Spread';
    }
        /**
     * shotPatternによる発砲可否判定：
     * @param hasWallBetween          wallがあるか
     * @param hasBreakableWallBetween breakwallがあるか
     * @param allowBreakWallShot      CoreBreakerかCoreBreaker_Spreadのときbreakwallならtrue
     * @returns
     */
    static isDirectLineClear(
        hasWallBetween: boolean,
        hasBreakableWallBetween: boolean,
        allowBreakWallShot: boolean,
    ) : boolean {
        if (hasWallBetween) return false;
        if (hasBreakableWallBetween) return allowBreakWallShot;
        return true;
    }

    /**
     * タンク→プレイヤー間の直線上に wall/break_wall が存在するか走査する。
     * Ray と Box3 の交差判定を使用し、壁の中心点だけでなく壁全体の形状で判定する。
     * @param tank   自タンク
     * @param player プレイヤータンク
     * @returns { hasWallBetween, hasBreakableWallBetween }
     */
    static scanObstaclesOnDirectLine(
        tank:   Tank,
        player: Tank,
    ): { hasWallBetween: boolean; hasBreakableWallBetween: boolean } {
        const tankPos   = tank.movement.position;
        const playerPos = player.movement.position;

        const origin = new THREE.Vector3(tankPos.x, 0, tankPos.z);
        const toPlayer = new THREE.Vector3(
            playerPos.x - tankPos.x,
            0,
            playerPos.z - tankPos.z,
        );
        const playerDist = toPlayer.length();
        if (playerDist === 0) return { hasWallBetween: false, hasBreakableWallBetween: false };

        const shellRadius = SHELL_STATS[tank.shot.bulletType].radius;
        const ray    = new THREE.Ray(origin, toPlayer.clone().divideScalar(playerDist));
        const target = new THREE.Vector3();

        let hasWallBetween          = false;
        let hasBreakableWallBetween = false;

        for (const { cube } of StageObjectManager.instance.allCubes) {
            const type = cube.info.type;
            if (type !== 'wall' && type !== 'break_wall') continue;

            const box = cube.getBoundingBox();
            // XZ 平面での 2D 判定：Y 範囲を水平レイが通過できるよう平坦化
            box.min.y = -1;
            box.max.y =  1;
            // 弾の半径分だけボックスを拡張して当たり判定を正確にする
            box.expandByScalar(shellRadius);

            if (!ray.intersectBox(box, target)) continue;
            if (origin.distanceTo(target) >= playerDist) continue;

            if (type === 'wall') {
                hasWallBetween = true;
                break; // wall が見つかれば結果は確定（isDirectLineClear は常に false）
            }
            hasBreakableWallBetween = true;
        }

        return { hasWallBetween, hasBreakableWallBetween };
    }

    /**
     * タンク→任意座標間の直線上に wall/break_wall が存在するか走査する。
     * leadTarget（予測移動先）への経路チェックに使用する。
     */
    static scanObstaclesToPos(
        tank:      Tank,
        targetPos: THREE.Vector3,
    ): { hasWallBetween: boolean; hasBreakableWallBetween: boolean } {
        const tankPos  = tank.movement.position;
        const origin   = new THREE.Vector3(tankPos.x, 0, tankPos.z);
        const toTarget = new THREE.Vector3(
            targetPos.x - tankPos.x,
            0,
            targetPos.z - tankPos.z,
        );
        const dist = toTarget.length();
        if (dist === 0) return { hasWallBetween: false, hasBreakableWallBetween: false };

        const shellRadius = SHELL_STATS[tank.shot.bulletType].radius;
        const ray    = new THREE.Ray(origin, toTarget.clone().divideScalar(dist));
        const hit    = new THREE.Vector3();

        let hasWallBetween          = false;
        let hasBreakableWallBetween = false;

        for (const { cube } of StageObjectManager.instance.allCubes) {
            const type = cube.info.type;
            if (type !== 'wall' && type !== 'break_wall') continue;

            const box = cube.getBoundingBox();
            box.min.y = -1;
            box.max.y =  1;
            box.expandByScalar(shellRadius);

            if (!ray.intersectBox(box, hit)) continue;
            if (origin.distanceTo(hit) >= dist) continue;

            if (type === 'wall') {
                hasWallBetween = true;
                break;
            }
            hasBreakableWallBetween = true;
        }

        return { hasWallBetween, hasBreakableWallBetween };
    }
}
export class TurrretCondition {
    /** 砲塔が回転中か（直前フレームで角度が変化したか） */
    static isTurretRotation(tank: Tank): boolean {
        return tank.turret.isRotating;
    }
    // 照準は保持するか
    static holdAim(): boolean {
        return true;
    }
}

/** DecisionPlayer.ts*/

/** プレイヤーの向きの種別（自タンクに対して） */
export type PlayerFacingDirection = 'vertical' | 'horizontal' | 'diagonal';

export class PlayerCondition {
    /** プレイヤーを感知したか */
    static isPlayerDetected(perception: SensorData): boolean {
        return perception.zonePlayer.length > 0;
    }

    /**
     * プレイヤーの正面が自タンクに対して縦・横・斜めどれか。
     * - vertical  (縦)  : |dot| >= cos(22.5°) ≈ 0.924
     * - horizontal(横)  : |dot| <= cos(67.5°) ≈ 0.383
     * - diagonal  (斜め): それ以外
     */
    static getPlayerFacingDirection(player: Tank, selfTank: Tank): PlayerFacingDirection {
        const playerPos = player.movement.position;
        const selfPos   = selfTank.movement.position;

        const toSelf = new THREE.Vector3(
            selfPos.x - playerPos.x,
            0,
            selfPos.z - playerPos.z,
        ).normalize();

        const rotY          = player.movement.rotationY;
        const playerForward = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));

        const absDot = Math.abs(playerForward.dot(toSelf));

        if (absDot >= 0.924) return 'vertical';
        if (absDot <= 0.383) return 'horizontal';
        return 'diagonal';
    }
}


/** DecisionMovement.ts - 自地雷ゾーン退出トラッキング */
export class OwnMineZoneCondition {
    /**
     * 自地雷ゾーン退出トラッキング。
     * タンクが設置した地雷の爆発範囲内にいる間はIDを追跡し、
     * 一度でも範囲外に出たら exitedOwnMines に記録する（以降は壁として扱う）。
     * @param tankId                 自タンクID
     * @param tankPos                自タンク位置
     * @param ownMinesCurrentlyInside 現在内部にいる自地雷ID（ミュータブル）
     * @param exitedOwnMines          一度でも退出した自地雷ID（ミュータブル）
     */
    static trackExitedMines(
        tankId:                  string,
        tankPos:                 THREE.Vector3,
        ownMinesCurrentlyInside: Set<string>,
        exitedOwnMines:          Set<string>,
    ): void {
        for (const { id, ownerTankId, mine } of StageObjectManager.instance.allMines) {
            if (ownerTankId !== tankId) continue;
            const mp    = mine.object.position;
            const dx    = mp.x - tankPos.x;
            const dz    = mp.z - tankPos.z;
            const range = mine.info.stats.explosionRange;
            if (dx * dx + dz * dz <= range * range) {
                ownMinesCurrentlyInside.add(id);
            } else if (ownMinesCurrentlyInside.has(id)) {
                ownMinesCurrentlyInside.delete(id);
                exitedOwnMines.add(id);
            }
        }
    }
}

/** DecisionMine.ts
 *  negative:地雷を30秒に一度しか置かない。置く場所はランダム
 *  positive:地雷をあるだけ置く。誘爆範囲にはおかない
 *  passage:1〜3マス幅の通路内に置く
 */
export class MinePlacementCondition {

    /**
     * negative 判定：前回設置からのインターバルが経過しているか。
     * @param elapsedSec  前回設置からの経過時間（秒）
     * @param threshold   個体ごとのクールダウン閾値（秒）
     */
    static isNegativeReady(elapsedSec: number, threshold: number): boolean {
        return elapsedSec >= threshold;
    }

    /**
     * positive 判定：候補位置が既存地雷の誘爆範囲外にあるか。
     * @param distSq       候補位置と既存地雷の距離の二乗（セル単位）
     * @param explodeRange 既存地雷の爆発半径（セル単位、MINE_STATS.explosionRange）
     */
    static isOutsideChainRange(distSq: number, explodeRange: number): boolean {
        return distSq > explodeRange * explodeRange;
    }

    /**
     * passage 判定：タンクが通路内にいるか。
     * 通路軸方向の前後 1 マスが通行可能で、垂直軸の両側 1〜3 マス以内に壁があること
     * （1・2・3 マス幅の通路に対応）。
     * @param forwardClear  通路軸方向・前方 1 マスが通行可能か
     * @param backwardClear 通路軸方向・後方 1 マスが通行可能か
     * @param leftWall      垂直軸・左側 1〜3 マス以内に壁があるか
     * @param rightWall     垂直軸・右側 1〜3 マス以内に壁があるか
     */
    static isPassageCenter(
        forwardClear:  boolean,
        backwardClear: boolean,
        leftWall:      boolean,
        rightWall:     boolean,
    ): boolean {
        return forwardClear && backwardClear && leftWall && rightWall;
    }
}

