import type * as THREE from 'three';
import type { Tank } from '../../../../../object/tank/Tank';
import type { ShootingDecision, PlayerDecision } from '../../Decision/DecisionTypes';

export interface ShotPattern {
    update(
        tank:           Tank,
        playerTank:     Tank | null,
        target:         THREE.Vector3,
        aimMode:        'direct' | 'reflect',
        decisionShoot:  ShootingDecision,
        playerDecision: PlayerDecision | null,
        delta:          number,
    ): void;
}
