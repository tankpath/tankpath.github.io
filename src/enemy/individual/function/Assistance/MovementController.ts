// Enemy.tsを補佐するクラス
import * as THREE from 'three';
import type { Tank } from '../../../../object/tank/Tank';
import type { SensorData } from '../Detector/Sensor';
import type { Navigator } from '../Detector/Navigator';
import type { MovementDecision, PlayerDecision } from '../Decision/DecisionTypes';
import type { PlayerFacingDirection } from '../../../../Definition/PrerequisiteAI';
import type { MoveBehavior } from '../Movement/MoveBehavior';
import type { DodgeBehavior } from '../Movement/DodgeBehavior';
import type { AI_LEVEL } from '../../../../Definition/AILevel';
import { DODGE_CHANCE_BY_LEVEL } from '../../../../Definition/AILevel';
import { EnemyMaster } from '../../../master/EnemyMaster';
import { PlayerBehaviorSelector } from '../Static/StaticMoveCul';



export class MovementController {

    // ─── スタック検知 ────────────────────────────────────────────────────
    private _stuckTimer    = 0;
    private _lastCellKey: string | null = null;

    // ─── 回避状態トラッキング ────────────────────────────────────────────
    private _wasDodging              = false;
    private _dodgeCooldown           = 0;
    private static readonly DODGE_COOLDOWN = 0.5;

    // ─── 地雷爆発範囲侵入トラッキング ────────────────────────────────────
    private _wasInMineExplosionRange = false;

    // ─── 敵タンク衝突回避 ────────────────────────────────────────────────
    private _isAvoidingEnemy = false;

    // ─── プレイヤー追跡タイマー ──────────────────────────────────────────
    private _playerTrackTimer = 0;

    // ─── プレイヤー行動選択 ──────────────────────────────────────────────

    /** 待機終了後の再抽選に使うために検知時の向きを保存する */
    private _selectedFacingDir: PlayerFacingDirection | null = null;
    /** 待機の残り秒数（3〜5秒ランダム） */
    private _waitTimer = 0;

    private readonly _moveBehavior:  MoveBehavior;
    private readonly _dodgeBehavior: DodgeBehavior;
    private readonly _cellSize:      number;
    private readonly _dodgeChance:   number;

    private _isChargeOrder = false;
    private _isZigzag      = false;

    constructor(moveBehavior: MoveBehavior, dodgeBehavior: DodgeBehavior, cellSize: number, aiLevel: AI_LEVEL) {
        this._moveBehavior  = moveBehavior;
        this._dodgeBehavior = dodgeBehavior;
        this._cellSize      = cellSize;
        this._dodgeChance   = DODGE_CHANCE_BY_LEVEL[aiLevel];
    }

    // ────────────────────────────────────────────────────────────────────
    // 公開メソッド
    // ────────────────────────────────────────────────────────────────────

    /**
     * 毎フレーム update() の先頭で呼ぶ。
     * 現在のセル座標が前フレームと同じなら _stuckTimer を加算、
     * 異なれば別セルへ移動したとみなしリセットする。
     */
    updateStuckTimer(tank: Tank, delta: number): void {
        const pos = tank.movement.position;
        const key = `${Math.floor(pos.x / this._cellSize)},${Math.floor(pos.z / this._cellSize)}`;
        if (key === this._lastCellKey) {
            this._stuckTimer += delta;
        } else {
            this._stuckTimer  = 0;
            this._lastCellKey = key;
        }
    }

    /**
     * 移動制御のメインエントリ。優先順位に従って Behavior を呼び出す
     */
    execute(
        tank:             Tank,
        navigator:        Navigator,
        perception:       SensorData,
        decisionMovement: MovementDecision | null,
        decisionPlayer:   PlayerDecision   | null,
        playerPos:        THREE.Vector3    | null,
        delta:            number,
    ): void {
        if (!decisionMovement) return;

        const { shouldRequestRoute, shouldDodge, mineNewDetected, exitedOwnMines } = decisionMovement;
        const dangerShell = perception.zoneAvoid[0] ?? null;

        // ── 地雷爆発範囲内（mineNewDetected に関わらず毎フレーム評価） ─────────
        if (perception.inMineExplosionRange) {
            // 新規地雷追加 or 初回侵入時のみルートを再計算（毎フレーム計算を避ける）
            if (mineNewDetected || !this._wasInMineExplosionRange || !navigator.hasRoute || navigator.hasReachedGoal) {
                this._sreachEmergencyRoute(tank, navigator);
            }
            this._wasInMineExplosionRange = true;
            this._moveBehavior.execute(tank, navigator.currentTarget, delta);
            return;
        }
        this._wasInMineExplosionRange = false;

        // ── 爆発範囲外で新規地雷を検知 ──────────────────────────────────────
        if (mineNewDetected) {
            this._sreachRoute(tank, navigator, exitedOwnMines);
            return;
        }

        // ── 危険弾を検知した場合 ────────────────────────────────────────────────
        if (shouldDodge && dangerShell && !mineNewDetected && Math.random() < this._dodgeChance) {
            this._dodgeBehavior.execute(tank, dangerShell, delta);
            this._wasDodging    = true;
            this._dodgeCooldown = MovementController.DODGE_COOLDOWN;
            return;
        }

        // 回避終了直後：クールダウン中はルートに戻らない
        if (this._wasDodging) {
            this._wasDodging = false;
        }
        if (this._dodgeCooldown > 0) {
            this._dodgeCooldown -= delta;
            return;
        }
        // クールダウン完了後：新位置からルートを再計算（初回のみ）
        if (this._dodgeCooldown < 0) {
            this._dodgeCooldown = 0;
            this._sreachRoute(tank, navigator, exitedOwnMines);
        }

        // 敵同士ぶつかったとき：押し出し＋初回のみルート再計算
        if (perception.touchingEnemyTanks.length > 0) {
            PlayerBehaviorSelector.separationPush(tank, perception.touchingEnemyTanks, delta);
            if (!this._isAvoidingEnemy) {
                this._sreachRoute(tank, navigator, exitedOwnMines);
                this._isAvoidingEnemy = true;
            }
            return;
        }
        this._isAvoidingEnemy = false;

        // ── プレイヤーを検知した場合 ──────────────────────────
        if (decisionPlayer?.playerDetected) {

            // 初回検知時のみ行動選択＆特殊ルート計算
            if (this._playerTrackTimer <= 0) {
                this._selectedFacingDir = decisionPlayer.facingDirection;

                const result = PlayerBehaviorSelector.selectOnDetect(decisionPlayer.facingDirection);

                // フラグリセット
                this._isChargeOrder = false;
                this._isZigzag      = false;

                switch (result.mode) {
                    case 'zigzag_retreat':
                        this._isZigzag = true;
                        break;
                    case 'zigzag_charge':
                        this._isZigzag      = true;
                        this._isChargeOrder = true;
                        break;
                    case 'charge':
                        this._isChargeOrder = true;
                        break;
                    case 'wait':
                        this._waitTimer = result.waitTimer ?? 3;
                        break;
                }

                // 特殊ルート再計算
                if (playerPos && result.mode !== 'wait') {
                    this._sreachSpecialRoute(tank, navigator, playerPos, exitedOwnMines);
                }
            }

            // 検知中はタイマーを7秒にリセットし続ける（視界から外れた瞬間から7秒保持）
            this._playerTrackTimer = 5;
        }

        if (this._playerTrackTimer > 0) {
            this._playerTrackTimer -= delta;

            // 待機中はカウントダウンのみ
            if (this._waitTimer > 0) {
                this._waitTimer -= delta;
                // 待機終了 → 再抽選して特殊ルート計算
                if (this._waitTimer <= 0) {
                    const mode = PlayerBehaviorSelector.selectAfterWait(this._selectedFacingDir);
                    this._isChargeOrder = false;
                    this._isZigzag      = false;
                    switch (mode) {
                        case 'zigzag_retreat':
                            this._isZigzag = true;
                            break;
                        case 'zigzag_charge':
                            this._isZigzag      = true;
                            this._isChargeOrder = true;
                            break;
                        case 'charge':
                            this._isChargeOrder = true;
                            break;
                    }
                    if (playerPos) {
                        this._sreachSpecialRoute(tank, navigator, playerPos, exitedOwnMines);
                    }
                }
                return;
            }

            // 目的地到達時は特殊ルートを再計算
            if (shouldRequestRoute && playerPos) {
                this._sreachSpecialRoute(tank, navigator, playerPos, exitedOwnMines);
            }
            this._moveTank(tank, navigator, delta);
            return;
        }

        // ── 例外処理（同じマスに1.5秒以上停滞） ──────────────────────────
        if (this._stuckTimer >= 1.5) {
            this._stuckTimer = 0;
            PlayerBehaviorSelector.handleStuck(tank, delta);
            this._sreachRoute(tank, navigator, exitedOwnMines);
            return;
        }

        // ── ルートがない、ゴールに到達した場合 ─────────────────────────────────────────────────
        if (shouldRequestRoute) {
            this._sreachRoute(tank, navigator, exitedOwnMines);
        }
        // ルートを進む
        this._moveBehavior.execute(tank, navigator.currentTarget, delta);
        return;
    }

    // ────────────────────────────────────────────────────────────────────
    // 非公開メソッド
    // ────────────────────────────────────────────────────────────────────

    // 通常ルート検索
    private _sreachRoute(tank: Tank, navigator: Navigator, exitedOwnMines: Set<string>): void {
        const route = EnemyMaster.instance.requestRoute(tank.info.id, tank.movement.position, exitedOwnMines);
        navigator.setRoute(route);
    }

    // 特殊ルート検索
    private _sreachSpecialRoute(tank: Tank, navigator: Navigator, pos: THREE.Vector3, exitedOwnMines: Set<string>): void {
        const route = EnemyMaster.instance.requestSpecialRoute(
            tank.info.id,
            tank.movement.position,
            this._isChargeOrder,
            this._isZigzag,
            pos,
            exitedOwnMines,
        );
        navigator.setRoute(route);
    }

    // 地雷用緊急脱出ルート検索
    // 最寄りの地雷のない地点へのルート検索
    private _sreachEmergencyRoute(tank: Tank, navigator: Navigator): void {
        const route = EnemyMaster.instance.requestEscapeMineRoute(
            tank.movement.position
        );
        navigator.setRoute(route);
    }

    // 実行処理
    private _moveTank(tank: Tank, navigator: Navigator, delta: number) {
        this._moveBehavior.execute(tank, navigator.currentTarget, delta);
    }

}
