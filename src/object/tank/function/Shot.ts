// 発砲
import * as THREE from 'three';
import type { ShellType } from '../../../Definition/ShellDefinition';
import { StageObjectManager } from '../../../managers/StageObjectManager';
import { Shell } from '../../tank_object/shell/Shell';
import { ShellInformation } from '../../tank_object/shell/ShellInfomation';
import { SoundManager } from '../../../managers/SoundManager';
import { SE, type SEKey } from '../../../Definition/SoundList';

const SE_FOR_SHOT: Partial<Record<ShellType, SEKey>> = {
    ShockPulse:         SE.FIRE_SP,
    ShockPulse_HV:      SE.FIRE_SP_HV,
    ClusterBolt:        SE.FIRE_SP_HV,
    CoreBreaker:        SE.FIRE_CB,
    CoreBreaker_Spread: SE.FIRE_CB,
};

/** 全タンク共通の弾飛行高さ（Y 固定値）。タンク種別によるモデル高さの差を吸収する */
const SHELL_Y = 0.5;
/** 発射位置を射出方向へずらすオフセット（セル単位）。弾がタンク内部でスポーンするのを防ぐ */
const SPAWN_OFFSET = 1;

/** reloadTime=0 のときに設定する最小リロード時間（秒）。60fps で約 3 フレーム分 */
const MIN_RELOAD = 3 / 60;

export class Shot {
    readonly bulletType:   ShellType;
    readonly maxBullets:   number;
    readonly reflectCount: number;
    readonly reloadTime:   number;

    private readonly ownerTankId:  string;
    private readonly shellFactory: (bulletType: ShellType) => THREE.Object3D;

    private activeBullets: number = 0;
    private reloadTimer:   number = 0;

    /**
     * @param shellFactory  弾の 3D オブジェクトを生成してシーンに追加する関数。
     *                      Factory.createShellFactory() が返すクロージャを渡す。
     */
    constructor(
        bulletType:   ShellType,
        maxBullets:   number,
        reflectCount: number,
        reloadTime:   number,
        ownerTankId:  string,
        shellFactory: (bulletType: ShellType) => THREE.Object3D,
    ) {
        this.bulletType   = bulletType;
        this.maxBullets   = maxBullets;
        this.reflectCount = reflectCount;
        this.reloadTime   = reloadTime;
        this.ownerTankId  = ownerTankId;
        this.shellFactory = shellFactory;
    }

    canShoot(): boolean {
        return this.activeBullets < this.maxBullets && this.reloadTimer <= 0;
    }

    /**
     * 発砲する。発射できない場合は null を返す。
     * シーンへの追加は shellFactory が行うため、呼び出し側の追加作業は不要。
     */
    shoot(origin: THREE.Vector3, direction: THREE.Vector3): Shell | null {
        if (!this.canShoot()) return null;
        this.activeBullets++;
        this.reloadTimer = Math.max(MIN_RELOAD, this.reloadTime);
        return this._spawnShell(origin, direction);
    }

    /**
     * リロードタイマーを無視して発砲する。在弾数上限（maxBullets）のみチェック。
     * 連射パターンの発射シーケンス専用。
     */
    shootIgnoreReload(origin: THREE.Vector3, direction: THREE.Vector3): Shell | null {
        if (this.activeBullets >= this.maxBullets) return null;
        this.activeBullets++;
        this.reloadTimer = MIN_RELOAD; // 同フレーム二重発射防止のみ
        return this._spawnShell(origin, direction);
    }

    private _spawnShell(origin: THREE.Vector3, direction: THREE.Vector3): Shell | null {
        const mgr    = StageObjectManager.instance;
        const id     = mgr.generateBulletId();
        const info   = new ShellInformation(id, this.bulletType);
        const object = this.shellFactory(this.bulletType);
        object.position.copy(origin).addScaledVector(direction.normalize(), SPAWN_OFFSET);
        object.position.y = SHELL_Y; // タンク種別の高さ差を吸収するため Y を固定

        const shell = new Shell(
            info, object, direction, this.reflectCount,
            () => mgr.removeBullet(id),
        );

        mgr.registerBullet({ id, ownerTankId: this.ownerTankId, isSplit: false, shell });

        const seKey = SE_FOR_SHOT[this.bulletType];
        if (seKey) SoundManager.instance.playSE(seKey);

        // スポーン位置が shellBlocker な壁の内側なら即消滅
        const spawnBox = shell.getBoundingBox();
        const insideWall = mgr.allCubes.some(
            entry => entry.cube.info.stats.shellBlocker
                  && spawnBox.intersectsBox(entry.cube.getBoundingBox()),
        );
        if (insideWall) {
            shell.onHit.hit();
            return null;
        }

        console.log(`[Shot] tank=${this.ownerTankId} fired bullet=${id} type=${this.bulletType}`);
        return shell;
    }

    /** 現在発射可能な残弾数（同時在弾上限 - 現在飛行中） */
    get remainingShots(): number { return this.maxBullets - this.activeBullets; }

    /** 弾が消滅したときに呼ぶ（在弾数を戻す） */
    onBulletDestroyed(): void {
        if (this.activeBullets > 0) this.activeBullets--;
    }

    update(delta: number): void {
        if (this.reloadTimer > 0) {
            this.reloadTimer = Math.max(0, this.reloadTimer - delta);
        }
    }
}
