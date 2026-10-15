import * as THREE from 'three';
import type { Tank } from '../object/tank/Tank';

// ─── 方向転換パラメータ ─────────────────────────────────────────────
const DEG = Math.PI / 180;


/** 車体の角速度（ラジアン/秒） */
const ROTATE_SPEED = 120 * DEG;
/** 目標方向との角度差がこれ以下になったら移動開始（ラジアン） */
const MOVE_WHEN_ALIGNED = 15 * DEG;
/** 入力方向が前方との差 ≥ この角度なら即後退（ラジアン） */
const REAR_IMMEDIATE = 150 * DEG;
/** ReverseAlign モードに入る下限（ラジアン） */
const REVERSE_LOWER = 110 * DEG;
/** ReverseAlign モードに入る上限（ラジアン） */
const REVERSE_UPPER = 150 * DEG;
/** ReverseAlign から ForwardAlign に戻るときのヒステリシス（ラジアン） */
const HYSTERESIS = 20 * DEG;

// ─────────────────────────────────────────────────────────────────────

type MoveMode = 'ForwardAlign' | 'ReverseAlign' | 'ImmediateReverse';

/**
 * タンク操縦の共通ロジック。
 * プレイヤー・敵 AI 両方から利用できる。
 * Tank を外から受け取るため、どの種類のタンクにも適用できる。
 */
export class TankDriver {
    private readonly tank: Tank;
    private moveMode: MoveMode = 'ForwardAlign';

    // 毎フレーム new THREE.Vector3() を避けるキャッシュ
    private readonly _inputDir = new THREE.Vector3();
    private readonly _forward  = new THREE.Vector3();
    private readonly _tempDir  = new THREE.Vector3();
    private static readonly _Y_AXIS = new THREE.Vector3(0, 1, 0);

    constructor(tank: Tank) {
        this.tank = tank;
    }

    /**
     * 方向転換と移動。3 モードで挙動を切り替える。
     *
     * ForwardAlign    ─ 入力方向へ車体を向けながら前進。
     * ReverseAlign    ─ 入力が斜め後ろなら、後ろ向きに回しながら後退（バックターン）。
     * ImmediateReverse─ 入力が真後ろなら、回転せず即後退。
     */
    applyMovement(dx: number, dz: number, delta: number): void {
        if (dx === 0 && dz === 0) return;

        this._inputDir.set(dx, 0, dz).normalize();
        const inputDir  = this._inputDir;
        const bodyAngle = this.tank.movement.rotationY;
        this._forward.set(-Math.sin(bodyAngle), 0, -Math.cos(bodyAngle));
        const forward   = this._forward;

        // 入力方向と前方のなす角（ラジアン）
        const dot      = Math.max(-1, Math.min(1, forward.dot(inputDir)));
        const angleToD = Math.acos(dot);

        // ── モード更新 ─────────────────────────────────────────────────
        if (this.moveMode !== 'ReverseAlign') {
            if (angleToD >= REAR_IMMEDIATE)
                this.moveMode = 'ImmediateReverse';
            else if (angleToD >= REVERSE_LOWER && angleToD <= REVERSE_UPPER)
                this.moveMode = 'ReverseAlign';
            else
                this.moveMode = 'ForwardAlign';
        } else {
            // ReverseAlign 解除はヒステリシスで安定させる
            if (angleToD < REVERSE_LOWER - HYSTERESIS)
                this.moveMode = 'ForwardAlign';
        }

        // ── モード別挙動 ──────────────────────────────────────────────
        const maxStep = ROTATE_SPEED * delta;

        switch (this.moveMode) {

            case 'ImmediateReverse':
                // 車体を回さず現在の後方へ移動
                this.tank.movement.move(this._tempDir.copy(forward).negate(), delta);
                break;

            case 'ReverseAlign': {
                // 後ろ向き（-inputDir）に車体を向けながら後退
                const targetAngle = dirToBodyAngle(this._tempDir.copy(inputDir).negate());
                const remain      = angleDiff(bodyAngle, targetAngle);
                const newAngle    = rotateTowards(bodyAngle, targetAngle, maxStep);
                this.tank.movement.setRotation(newAngle);
                if (remain <= MOVE_WHEN_ALIGNED) {
                    this.tank.movement.move(this._tempDir.set(Math.sin(newAngle), 0, Math.cos(newAngle)), delta);
                }
                break;
            }

            case 'ForwardAlign':
            default: {
                // inputDir に車体を向けながら前進
                const targetAngle = dirToBodyAngle(inputDir);
                const remain      = angleDiff(bodyAngle, targetAngle);
                const newAngle    = rotateTowards(bodyAngle, targetAngle, maxStep);
                this.tank.movement.setRotation(newAngle);
                if (remain <= MOVE_WHEN_ALIGNED) {
                    this.tank.movement.move(this._tempDir.set(-Math.sin(newAngle), 0, -Math.cos(newAngle)), delta);
                }
                break;
            }
        }
    }

    /**
     * 砲塔を照準目標に向ける。
     * ターレットはボディの子なので local 角度 = world 目標角 - body 角 を設定する。
     */
    applyTurret(aimTarget: THREE.Vector3 | null): void {
        if (!aimTarget) return;
        const pos = this.tank.movement.position;
        const dx  = aimTarget.x - pos.x;
        const dz  = aimTarget.z - pos.z;
        if (dx * dx + dz * dz < 0.001) return;

        const worldAimAngle = Math.atan2(-dx, -dz); // dirToBodyAngle の展開（normalize 不要）
        const localAngle    = worldAimAngle - this.tank.movement.rotationY;
        this.tank.turret.rotateTo(localAngle);
    }

    /**
     * 発砲。
     * 砲塔のワールド角度（車体 + 砲塔 local）方向へ弾を打ち出す。
     * 発射位置は MuzzlePoint ノードがあればその座標、なければ砲塔中心にフォールバックする。
     */
    shoot(): void {
        const worldTurretAngle = this.tank.movement.rotationY + this.tank.turret.angle;
        this._tempDir.set(-Math.sin(worldTurretAngle), 0, -Math.cos(worldTurretAngle))
            .applyAxisAngle(TankDriver._Y_AXIS, -Math.PI / 2);
        const direction = this._tempDir;
        const origin = this.tank.turret.muzzleWorldPosition;
        this.tank.shot.shoot(origin, direction);
    }

    /** 現在位置に地雷を設置する */
    placeMine(): void {
        this.tank.placeMine();
    }
}

// ─── ユーティリティ ────────────────────────────────────────────────────

/**
 * 前方ベクトルから車体の Y 回転角を求める。
 * (-sinθ, 0, -cosθ) = dir より θ = atan2(-dir.x, -dir.z)
 */
function dirToBodyAngle(dir: THREE.Vector3): number {
    return Math.atan2(-dir.x, -dir.z);
}

/**
 * 2 つの角度（ラジアン）の絶対差を [0, π] に正規化して返す。
 */
function angleDiff(a: number, b: number): number {
    const d = Math.abs(a - b) % (2 * Math.PI);
    return d > Math.PI ? 2 * Math.PI - d : d;
}

/**
 * current から target の最短経路で maxStep 以内だけ回転し、
 * 結果を [-π, π] に正規化して返す。
 */
function rotateTowards(current: number, target: number, maxStep: number): number {
    let diff = target - current;
    while (diff >  Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    let result = Math.abs(diff) <= maxStep
        ? target
        : current + Math.sign(diff) * maxStep;

    while (result >  Math.PI) result -= 2 * Math.PI;
    while (result < -Math.PI) result += 2 * Math.PI;
    return result;
}
