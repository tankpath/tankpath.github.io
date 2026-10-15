import type * as THREE from 'three';
import type { Tank } from '../../../../../object/tank/Tank';
import type { ShootingDecision, PlayerDecision } from '../../Decision/DecisionTypes';
import type { TurretBehavior } from '../../Movement/TurretBehavior';
import type { ShootBehavior } from '../../Weapon/ShootBehavior';
import type { ShotPattern } from './ShotPattern';
import { AimHelper } from './AimHelper';
import { targetingReloadTime } from '../ShootingController';

/**
 * 速射パターン：照準が合い次第発砲する。
 * 照準リロード: 0.1s
 */
export class RapidPattern implements ShotPattern {
    private readonly _shoot:         ShootBehavior;
    private readonly _searchReflect: (tank: Tank, target: THREE.Vector3) => THREE.Vector3 | null;
    private readonly _aim:           AimHelper;

    constructor(
        turretBehavior:  TurretBehavior,
        shoot:           ShootBehavior,
        searchReflect:   (tank: Tank, target: THREE.Vector3) => THREE.Vector3 | null,
        maxX:            number,
        maxZ:            number,
        reloadMultiplier = 1.0,
    ) {
        this._shoot         = shoot;
        this._searchReflect = searchReflect;
        this._aim           = new AimHelper(turretBehavior, maxX, maxZ, reloadMultiplier);
    }

    update(
        tank:            Tank,
        _playerTank:     Tank | null,
        target:          THREE.Vector3,
        aimMode:         'direct' | 'reflect',
        decisionShoot:   ShootingDecision,
        _playerDecision: PlayerDecision | null,
        delta:           number,
    ): void {
        const lead = this._aim.leadTarget(tank, target, delta);

        if (aimMode === 'direct') {
            if (!decisionShoot.directlineClear) {
                this._aim.aimAt(tank, lead);
                return;
            }
            const aligned = this._aim.directAim(tank, lead, delta, targetingReloadTime.rapid);
            if (aligned && !this._aim.isLeadObstructed(tank, lead)) this._shoot.tryShoot(tank, lead);
        } else {
            const firePos = this._aim.reflectAim(tank, lead, delta, targetingReloadTime.rapid, this._searchReflect);
            if (firePos) {
                this._shoot.tryShoot(tank, firePos);
            } else {
                this._aim.aimAt(tank, lead);
            }
        }
    }
}
