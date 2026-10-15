import * as THREE from 'three';
import { Tank } from '../../object/tank/Tank';
import type { BattleFieldConfig } from '../../scene/battle/BattleField';
import type { ResolvedCharacter } from '../master/function/DecideCharacter';
import { EnemyMaster } from '../master/EnemyMaster';
import { ObservationEquipment } from '../master/function/ObservationEquipment';
import { Sensor } from './function/Detector/Sensor';
import type { SensorData } from './function/Detector/Sensor';
import { Navigator } from './function/Detector/Navigator';
import { DodgeBehavior } from './function/Movement/DodgeBehavior';
import { MoveBehavior } from './function/Movement/MoveBehavior';
import { TurretBehavior } from './function/Movement/TurretBehavior';
import { ShootBehavior } from './function/Weapon/ShootBehavior';
import { MineBehavior } from './function/Weapon/MineBehavior';
import { MineController } from './function/Assistance/MineController';
import { DecisionMovement } from './function/Decision/DecisionMovement';
import { PrerequisiteAI } from '../../Definition/PrerequisiteAI';
import { DecisionShoot } from './function/Decision/DecisionShoot';
import { DecisionPlayer } from './function/Decision/DecisionPlayer';
import { DecisionMinePlace } from './function/Decision/DecisionMinePlace';
import type { MineEnemyType } from '../../Definition/EnemyDefinition';
import { ENEMY_MINE_PLACEMENT } from '../../Definition/EnemyDefinition';
import { StaticMineCul } from './function/Static/StaticMineCul';
import { MovementController } from './function/Assistance/MovementController';
import { ShootingController } from './function/Assistance/ShootingController';
import { SoundManager } from '../../managers/SoundManager';

export class Enemy {
    private readonly _tank:               Tank;
    private readonly _character:          ResolvedCharacter;
    private readonly _sensor:             Sensor;
    private readonly _navigator:          Navigator;
    private readonly _decisionMovement:   DecisionMovement;
    private readonly _decisionShoot:      DecisionShoot;
    private readonly _decisionPlayer:     DecisionPlayer;
    private readonly _decisionMine:       DecisionMinePlace;
    private readonly _dodgeBehavior:      DodgeBehavior;
    private readonly _moveBehavior:       MoveBehavior;
    private readonly _turretBehavior:     TurretBehavior;
    private readonly _shootBehavior:      ShootBehavior;
    private readonly _movementController: MovementController;
    private readonly _mineController:     MineController;
    private readonly _shootingController: ShootingController;

    private readonly _cellSize:           number;
    private _gameElapsedSec        = 0;
    private _updaterFn:            ((delta: number) => void) | null = null;

    private _reachedGoal       = true;   // 初回フレームでルート取得を促す
    private _active            = false;  // start() が呼ばれるまで更新しない

    // ─── センサースロットル（敵ごとにタイミングをずらして負荷を分散） ──
    private static readonly _SENSOR_INTERVAL = 0.05; // 20Hz（60fps で約3フレームに1回）
    private _sensorTimer = Math.random() * Enemy._SENSOR_INTERVAL;

    // ─── 知覚キャッシュ（センサー更新時のみ書き換え） ──────────────────
    private _perception: SensorData = {
        zoneOffset: [],
        zoneAvoid: [],
        frontMines: [],
        inMineExplosionRange: false,
        touchingEnemyTanks: [],
        zonePlayer: [],
    };

    /**
     * @param tank        制御するエネミータンク（EnemyMaster.registerEnemy 済みであること）
     * @param config      フィールド設定（cellSize を取得するために使用）
     * @param _debugScene デバッグ用シーン（将来の可視化用。現在は未使用）
     */
    constructor(tank: Tank, config: BattleFieldConfig, _debugScene: THREE.Scene) {
        this._tank      = tank;
        this._character = EnemyMaster.instance.getCharacter(tank.info.id)!;
        const cellSize  = config.cellSize;
        this._cellSize  = cellSize;

        const aiLevel           = EnemyMaster.instance.getAILevel(tank.info.id) ?? 1;

        this._sensor            = new Sensor(tank.info.id, cellSize);
        this._navigator         = new Navigator(cellSize);

        this._decisionMovement  = new DecisionMovement(this._character);
        this._decisionShoot     = new DecisionShoot();
        this._decisionPlayer    = new DecisionPlayer();
        this._decisionMine      = new DecisionMinePlace();

        this._dodgeBehavior     = new DodgeBehavior();
        this._moveBehavior      = new MoveBehavior(aiLevel);
        this._turretBehavior    = new TurretBehavior();
        this._shootBehavior     = new ShootBehavior(this._turretBehavior, aiLevel);

        this._movementController = new MovementController(this._moveBehavior, this._dodgeBehavior, cellSize, aiLevel);
        this._mineController     = new MineController(new MineBehavior(), ENEMY_MINE_PLACEMENT[tank.info.type as MineEnemyType] ?? 'positive');
        this._shootingController = new ShootingController(tank.info.id, this._turretBehavior, this._shootBehavior, this._character, config, aiLevel);
    }

    /** AI を起動する。EnemyMaster に更新コールバックを登録する */
    start(): void {
        this._active = true;
        this._updaterFn = (delta) => this.update(delta);
        EnemyMaster.instance.registerEnemyUpdater(this._updaterFn);
    }

    /** AI を停止する（update は即座に何もしなくなる） */
    dispose(): void {
        this._active = false;
        SoundManager.instance.notifyMoving(this._tank.info.id, false);
        if (this._updaterFn) {
            EnemyMaster.instance.unregisterEnemyUpdater(this._updaterFn);
            this._updaterFn = null;
        }
    }

    /** EnemyMaster.update(delta) から毎フレーム呼ばれる */
    update(delta: number): void {
        if (!this._active || !this._tank.isAlive) return;

        this._gameElapsedSec += delta;

        // ─── 1. Detector 系から状態取得 ──────────────────────────────
        this._sensorTimer -= delta;
        if (this._sensorTimer <= 0) {
            this._sensorTimer += Enemy._SENSOR_INTERVAL;
            this._perception = this._sensor.detect(this._tank);
        }
        this._navigator.update(this._tank.movement.position);
        if (this._navigator.hasReachedGoal) {
            this._reachedGoal = true;
        }

        // ─── 2. スタックタイマー更新 ────────────────────────────────
        this._movementController.updateStuckTimer(this._tank, delta);

        // ─── 3. プレイヤー位置取得（感知内: perception / 感知外: ObservationEquipment） ────
        const detectedPlayer = this._perception.zonePlayer[0]
            ?? ObservationEquipment.instance.playerTanks.find(p => p.isAlive)
            ?? null;
        const playerPos = detectedPlayer?.movement.position ?? null;

        // ─── 4-1. DecisionMovement で移動判断 ──────────────────────────
        const canMove = PrerequisiteAI.canEvaluateMovement(this._tank);
        const decisionMovement = canMove
            ? this._decisionMovement.decide({
                perception:        this._perception,
                navigator:         this._navigator,
                reachedGoal:       this._reachedGoal,
                delta,
                character:         this._character,
                tank:              this._tank,
            })
            : null;

        // ─── 4-2. DecisionShoot で発砲判断
        const decisionShoot = this._decisionShoot.decide({
            perception: this._perception,
            tank:       this._tank,
            delta,
            playerTank: detectedPlayer,
        });

        // ─── 4-3. DecisionPlayer でプレイヤー判断
        //    playerFired は射撃パターンでも使用するため、speed=0 のタンクでも常に計算する
        const decisionPlayer = this._decisionPlayer.decide({
            perception: this._perception,
            tank:       this._tank,
            playerTank: detectedPlayer,
        });

        // ─── 4-4. DecisionMinePlace で地雷設置判断
        const decisionMine = PrerequisiteAI.canEvaluateMinePlacement(this._tank)
            && PrerequisiteAI.isNoEnemyNearby(this._tank, this._cellSize)
            && PrerequisiteAI.isFarEnoughFromAnyMine(this._tank, this._cellSize)
            ? this._decisionMine.decide({
                pattern:                 ENEMY_MINE_PLACEMENT[this._tank.info.type as MineEnemyType],
                gameElapsedSec:          this._gameElapsedSec,
                elapsedSinceLastPlace:   this._mineController.elapsedSinceLastPlace,
                cooldown:                this._mineController.cooldown,
                distSqToNearestMine:     StaticMineCul.distSqToNearestMine(this._tank),
                nearestMineExplodeRange: StaticMineCul.nearestMineExplodeRange(this._tank, this._cellSize),
                ...StaticMineCul.checkPassage(this._tank, this._cellSize),
            })
            : null;

        // ─── 5. 移動、地雷設置の制御 ────────────────────────────────────────
        if (canMove) {
            this._movementController.execute(
                this._tank, this._navigator, this._perception,
                decisionMovement, decisionPlayer, playerPos, delta,
            );
            this._mineController.execute(this._tank, decisionMine, delta);
        }

        // ─── 6. 砲塔回転、発砲の制御 ────────────────────────────────────────
        if (!this._perception.inMineExplosionRange) {
            this._shootingController.execute(
                this._tank, this._perception, decisionShoot,
                decisionPlayer, playerPos, delta,
            );
        }


        // ─── 7. タンク自身の更新（リロードタイマー等） ─────────────
        this._tank.update(delta);

        // ─── 8. 移動音の通知 ───────────────────────────────────────
        SoundManager.instance.notifyMoving(this._tank.info.id, this._tank.movement.consumeMovedFlag());
    }
}

