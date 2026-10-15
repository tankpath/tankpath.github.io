// プレイヤー、敵、共通の仕様
import * as THREE from 'three';
import { TankInformation } from './TankInfomation';
import { Movement }    from './function/Movement';
import { TurretMove }  from './function/TurretMove';
import { Shot }        from './function/Shot';
import { OnHit }       from '../OnHit';
import { Destruction } from './function/Destruction';
import { MinePlacer }  from './function/MinePlacer';
import type { IHitDetection } from '../IHitDetction';
import type { ShellType } from '../../Definition/ShellDefinition';
import type { MineType } from '../../Definition/MineDefinition';
import { ENEMY_MODEL_MAP } from '../../Definition/EnemyDefinition';
import type { EnemyType } from '../../Definition/EnemyDefinition';

/** タンクの固定当たり判定サイズ（OBB の各辺長） */
export const HIT_BOX = new THREE.Vector3(0.7, 0.7, 0.7);
/** 当たり判定の Y 方向中心オフセット（地面から中心まで） */
export const HIT_BOX_Y_OFFSET = 0.5;

export class Tank implements IHitDetection {
    readonly info:        TankInformation;
    readonly object:      THREE.Object3D;

    readonly movement:    Movement;
    readonly turret:      TurretMove;
    readonly shot:        Shot;
    readonly onHit:       OnHit;
    readonly destruction: Destruction;
    readonly minePlacer:  MinePlacer;

    /**
     * @param shellFactory  弾の 3D オブジェクトを生成してシーンに追加する関数。
     * @param mineFactory   地雷を生成・登録する関数。地雷を持たない場合は null。
     */
    constructor(
        info:         TankInformation,
        object:       THREE.Object3D,
        shellFactory: (bulletType: ShellType) => THREE.Object3D,
        mineFactory:  ((mineType: MineType, position: THREE.Vector3, ownerTankId: string) => void) | null = null,
    ) {
        this.info   = info;
        this.object = object;

        const { stats } = info;

        this.destruction = new Destruction(object);
        this.movement    = new Movement(object, stats.speed);
        const enemyModel = !info.isPlayer ? ENEMY_MODEL_MAP[info.type as EnemyType] : null;
        const turretOffset = enemyModel === 'enemy_02' ? Math.PI
            : enemyModel === 'enemy_05'               ? 0
            : Math.PI / 2;
        this.turret      = new TurretMove(object, stats.turretRotationSpeed, turretOffset);
        this.shot        = new Shot(stats.bulletType, stats.bulletCount, stats.reflectCount, stats.reloadTime, info.id, shellFactory);
        this.onHit       = new OnHit(() => this.destruction.destroy());

        // mineFactory を ownerTankId にバインドした形で MinePlacer に渡す
        const boundFactory = mineFactory
            ? (type: MineType, pos: THREE.Vector3) => mineFactory(type, pos, info.id)
            : null;
        this.minePlacer = new MinePlacer(stats.mineType, stats.mineCount, stats.mineDetection, boundFactory);
    }

    /**
     * 車体回転を加味した AABB を返す。
     * OBB（HIT_BOX を rotationY で回転）を軸平行に包む最小ボックス。
     */
    getBoundingBox(target = new THREE.Box3()): THREE.Box3 {
        const pos    = this.movement.position;
        const angle  = this.movement.rotationY;
        const cos    = Math.abs(Math.cos(angle));
        const sin    = Math.abs(Math.sin(angle));
        const halfW  = (HIT_BOX.x * cos + HIT_BOX.z * sin) / 2;
        const halfH  = HIT_BOX.y / 2;
        const halfD  = (HIT_BOX.x * sin + HIT_BOX.z * cos) / 2;
        target.min.set(pos.x - halfW, HIT_BOX_Y_OFFSET - halfH, pos.z - halfD);
        target.max.set(pos.x + halfW, HIT_BOX_Y_OFFSET + halfH, pos.z + halfD);
        return target;
    }

    get isAlive(): boolean {
        return !this.destruction.isDestroyed;
    }

    /** 現在位置に地雷を設置する */
    placeMine(): void {
        this.minePlacer.place(this.movement.position);
    }

    /**
     * ゲームループから毎フレーム呼ぶ。
     * プレイヤーは Player.ts、敵は AI クラスが入力を与えたあとにこれを呼ぶ。
     */
    update(delta: number): void {
        this.shot.update(delta);
        this.turret.update(delta);
    }
}
