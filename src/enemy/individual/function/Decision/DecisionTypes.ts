import type { SensorData } from '../Detector/Sensor';
import type { Navigator } from '../Detector/Navigator';
import type { ResolvedCharacter } from '../../../master/function/DecideCharacter';
import type { Tank } from '../../../../object/tank/Tank';
import type { PlayerFacingDirection } from '../../../../Definition/PrerequisiteAI';
import type { MinePlacementPattern } from '../../../../Definition/MineDefinition';

export interface MovementDecisionInput {
    perception:        SensorData;
    navigator:         Navigator;
    reachedGoal:       boolean;
    delta:             number;
    character:         ResolvedCharacter;
    tank:              Tank;
}

export interface MovementDecision {
    shouldDodge:        boolean;
    shouldRequestRoute: boolean;
    mineDetected:       boolean;
    mineNewDetected:    boolean;
    exitedOwnMines:     Set<string>;
}

export interface ShootingDecisionInput {
    perception:         SensorData;
    tank:               Tank;
    delta:              number;
    /** Zone_4外でも壁チェックに使用するプレイヤータンク（ObservationEquipment経由も可） */
    playerTank:         Tank | null;
}

export interface ShootingDecision {
    shouldOffset:       boolean;
    reloadComplete:     boolean;
    directlineClear:    boolean;
    isRotate:           boolean;
}

export interface PlayerDecisionInput {
    perception:  SensorData;
    tank:        Tank;
    /** Zone_4外でも playerFired 検知に使用するプレイヤータンク（ObservationEquipment経由も可） */
    playerTank:  Tank | null;
}

export interface PlayerDecision {
    playerDetected:  boolean;
    facingDirection: PlayerFacingDirection | null;
    playerFired:     boolean;
}

export interface MinePlacementDecisionInput {
    pattern:                 MinePlacementPattern;
    // negative
    gameElapsedSec:          number;
    elapsedSinceLastPlace:   number;
    cooldown:                number;  // 個体ごとのクールダウン秒数（negativeの閾値に使用）
    // positive
    distSqToNearestMine:     number;
    nearestMineExplodeRange: number;
    // passage
    forwardClear:            boolean;
    backwardClear:           boolean;
    leftWall:                boolean;
    rightWall:               boolean;
}

export interface MinePlacementDecision {
    shouldPlace: boolean;
}