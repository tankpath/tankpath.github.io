import * as THREE from 'three';
import type { IHitDetection } from '../../IHitDetction';
import { ShellInformation } from './ShellInfomation';
import { UniformLinearMotion } from './function/UniformLinearMotion';
import { Reflect } from './function/Reflect';
import { OnHit } from '../../OnHit';
import { ShellEffect } from './ShellEffect';
import { ShellDestructionEffect } from './ShellEffect_sec';
import { CurvedMotion } from './function/CurvedMotion';

/** 弾の最大生存時間（秒） */
const MAX_LIFETIME = 15;

export class Shell implements IHitDetection {
    readonly info:   ShellInformation;
    readonly object: THREE.Object3D;

    readonly motion:  UniformLinearMotion;
    readonly reflect: Reflect;
    readonly onHit:   OnHit;
    readonly effect:  ShellEffect;

    private lifeTime      = MAX_LIFETIME;
    private _breakCount:  number;
    private _immunityTime = 0;
    private _curvedMotion: CurvedMotion | null = null;

    /**
     * @param info              ShellInformation（id・type・stats）
     * @param object            3D オブジェクト
     * @param direction         初期進行方向
     * @param remainingReflects 反射残回数（ShotRequest.reflectCount をそのまま渡す）
     * @param onDestroy         被弾・消滅時に呼ぶコールバック（StageObjectManager.removeBullet など）
     */
    constructor(
        info:              ShellInformation,
        object:            THREE.Object3D,
        direction:         THREE.Vector3,
        remainingReflects: number,
        onDestroy:         () => void,
    ) {
        this.info        = info;
        this.object      = object;
        this.motion      = new UniformLinearMotion(object, direction, info.stats.speed);
        this.reflect     = new Reflect(remainingReflects);
        this.effect      = new ShellEffect(object, info.type);
        this.onHit       = new OnHit(() => { this.effect.dispose(); onDestroy(); });
        this._breakCount = info.stats.breakCount;
    }

    /** 現在の耐久値 */
    get breakCount(): number { return this._breakCount; }

    /** スポーン直後の無敵時間が残っているか（弾同士の相殺スキップに使用） */
    get isImmune(): boolean { return this._immunityTime > 0; }

    /** スポーン直後の無敵時間を設定する */
    setImmunity(seconds: number): void { this._immunityTime = seconds; }

    /** 曲線運動を設定する（設定後は通常の直線運動を上書きする） */
    setCurvedMotion(cm: CurvedMotion): void { this._curvedMotion = cm; }

    /**
     * ダメージを与え、耐久値が 0 以下になれば onHit.hit() を呼んで破壊する。
     * @returns 破壊されたなら true
     */
    takeDamage(amount: number): boolean {
        this._breakCount -= amount;
        if (this._breakCount <= 0) {
            this.onHit.hit();
            return true;
        }
        return false;
    }

    /**
     * 破壊時の波紋エフェクトを生成して返す。
     * Shell がシーンから除去される前（object.parent が有効な間）に呼ぶこと。
     */
    createDestructionEffect(): ShellDestructionEffect | null {
        const scene = this.object.parent;
        if (!scene) return null;
        // Shell モデルの +Y 軸が進行方向に揃えられているのでクォータニオンから復元
        const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(this.object.quaternion);
        return new ShellDestructionEffect(
            this.object.position.clone(),
            dir,
            this.info.stats.aroundColor,
            scene,
        );
    }

    getBoundingBox(target = new THREE.Box3()): THREE.Box3 {
        return target.setFromObject(this.object);
    }

    /** ゲームループから毎フレーム呼ぶ */
    update(delta: number): void {
        if (this._curvedMotion) {
            this._curvedMotion.update(delta);
        } else {
            this.motion.update(delta);
        }
        this.effect.update(delta);

        if (this._immunityTime > 0) this._immunityTime -= delta;

        this.lifeTime -= delta;
        if (this.lifeTime <= 0) {
            this.onHit.hit();
        }
    }
}
