import * as THREE from 'three';
import type { Tank } from '../../../../../object/tank/Tank';
import type { ShootingDecision, PlayerDecision } from '../../Decision/DecisionTypes';
import type { TurretBehavior } from '../../Movement/TurretBehavior';
import type { ShootBehavior } from '../../Weapon/ShootBehavior';
import type { ShotPattern } from './ShotPattern';
import { AimHelper } from './AimHelper';
import { targetingReloadTime } from '../ShootingController';

/** 連射の発砲間隔（秒） */
const BURST_INTERVAL = 0.3;

/**
 * 目標点から左右へ広げる弾幕の片側半径（セル単位）。
 * 弾数に関わらず目標付近 (SPREAD_RADIUS×2) セル幅を均等にカバーする。
 */
const SPREAD_RADIUS = 0.5;

/**
 * 連射パターン：弾数マックス かつ 照準一致で発射シーケンス開始。
 * 目標座標を垂直方向にずらした点へ向けて順に発砲するため、
 * 距離によらず目標付近で一定幅（SPREAD_RADIUS×2 セル）の弾幕を形成する。
 * タンクのリロード時間を無視して BURST_INTERVAL 秒ごとに発射する。
 * 照準リロード: 0.7s
 */
export class FanPattern implements ShotPattern {
    private readonly _shoot:         ShootBehavior;
    private readonly _searchReflect: (tank: Tank, target: THREE.Vector3) => THREE.Vector3 | null;
    private readonly _aim:           AimHelper;
    private readonly _cellSize:      number;

    private _isFiring:          boolean             = false;
    private _shotsFired:        number              = 0;
    private _aimTargetPos:      THREE.Vector3 | null = null;
    private _crossAxis:         THREE.Vector3        = new THREE.Vector3();
    private _fireTimer:         number              = 0;
    private readonly _baseDirCache:     THREE.Vector3 = new THREE.Vector3();
    private readonly _spreadTargetCache: THREE.Vector3 = new THREE.Vector3();
    private readonly _dirCache:         THREE.Vector3 = new THREE.Vector3();

    constructor(
        turretBehavior:  TurretBehavior,
        shoot:           ShootBehavior,
        searchReflect:   (tank: Tank, target: THREE.Vector3) => THREE.Vector3 | null,
        maxX:            number,
        maxZ:            number,
        cellSize:        number,
        reloadMultiplier = 1.0,
    ) {
        this._shoot         = shoot;
        this._searchReflect = searchReflect;
        this._aim           = new AimHelper(turretBehavior, maxX, maxZ, reloadMultiplier);
        this._cellSize      = cellSize;
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

        if (this._isFiring) {
            this._fireTimer = Math.max(0, this._fireTimer - delta);
            if (this._fireTimer <= 0) {
                this._continueFiring(tank);
            }
            return;
        }

        const maxBullets = tank.shot.maxBullets;
        const hasMaxAmmo = tank.shot.remainingShots >= maxBullets;

        if (aimMode === 'direct') {
            if (!decisionShoot.directlineClear) {
                this._aim.aimAt(tank, lead);
                return;
            }
            const aligned = this._aim.directAim(tank, lead, delta, targetingReloadTime.fan);
            if (aligned && hasMaxAmmo && !this._aim.isLeadObstructed(tank, lead)) {
                this._startFiring(tank, lead);
            }
        } else {
            const firePos = this._aim.reflectAim(tank, lead, delta, targetingReloadTime.fan, this._searchReflect);
            if (firePos && hasMaxAmmo) {
                this._startFiring(tank, firePos);
            } else if (!firePos) {
                this._aim.aimAt(tank, lead);
            }
        }
    }

    private _startFiring(tank: Tank, aimTarget: THREE.Vector3): void {
        const muzzlePos = tank.turret.muzzleWorldPosition;
        if (!this._aimTargetPos) this._aimTargetPos = new THREE.Vector3();
        this._aimTargetPos.copy(aimTarget);

        // 照準方向に垂直な軸（XZ平面）を計算
        const baseDir = this._baseDirCache.set(
            aimTarget.x - muzzlePos.x,
            0,
            aimTarget.z - muzzlePos.z,
        ).normalize();
        this._crossAxis.set(-baseDir.z, 0, baseDir.x);

        this._isFiring   = true;
        this._shotsFired = 0;
        this._fireTimer  = 0;
    }

    private _continueFiring(tank: Tank): void {
        if (!this._aimTargetPos) return;

        const maxBullets = tank.shot.maxBullets;
        if (this._shotsFired >= maxBullets) {
            this._isFiring = false;
            return;
        }

        // N発を [-R, ..., 0, ..., +R] に均等分布（目標座標を垂直にずらす）
        const halfCount  = (maxBullets - 1) / 2;
        const step       = (maxBullets > 1)
            ? (this._cellSize * SPREAD_RADIUS * 2) / (maxBullets - 1)
            : 0;
        const offsetDist = (this._shotsFired - halfCount) * step;
        const spreadTarget = this._spreadTargetCache.copy(this._aimTargetPos)
            .addScaledVector(this._crossAxis, offsetDist);

        const muzzlePos = tank.turret.muzzleWorldPosition;
        const dir = this._dirCache.set(
            spreadTarget.x - muzzlePos.x,
            0,
            spreadTarget.z - muzzlePos.z,
        ).normalize();

        const fired = this._shoot.shootInDirectionIgnoreReload(tank, dir);
        if (!fired) {
            this._isFiring = false;
            return;
        }

        this._shotsFired++;
        this._fireTimer = BURST_INTERVAL;

        if (this._shotsFired >= maxBullets) {
            this._isFiring = false;
        }
    }
}
