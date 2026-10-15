// 移動の制御（ルート通り移動するだけ）

import * as THREE from 'three';
import type { Tank } from '../../../../object/tank/Tank';
import type { AI_LEVEL } from '../../../../Definition/AILevel';
import { BODY_ROTATION_SPEED_BY_LEVEL, MOVE_SPEED_MULTIPLIER_BY_LEVEL } from '../../../../Definition/AILevel';

const DEG = Math.PI / 180;

/** 移動開始とみなす角度誤差のしきい値（rad） */
const MOVE_WHEN_ALIGNED = 15 * DEG;
/** 入力方向が前方との差 ≥ この角度なら即後退（ラジアン） */
const REAR_IMMEDIATE    = 150 * DEG;
/** ReverseAlign モードに入る下限（ラジアン） */
const REVERSE_LOWER     = 110 * DEG;
/** ReverseAlign モードに入る上限（ラジアン） */
const REVERSE_UPPER     = 150 * DEG;
/** ReverseAlign から ForwardAlign に戻るときのヒステリシス（ラジアン） */
const HYSTERESIS        = 20 * DEG;

type MoveMode = 'ForwardAlign' | 'ReverseAlign' | 'ImmediateReverse';


export class MoveBehavior {
    private readonly _rotationSpeed:   number;
    private readonly _speedMultiplier: number;
    private _moveMode: MoveMode = 'ForwardAlign';

    // 毎フレーム new THREE.Vector3() を避けるキャッシュ
    private readonly _inputDir = new THREE.Vector3();
    private readonly _forward  = new THREE.Vector3();
    private readonly _tempDir  = new THREE.Vector3();

    constructor(aiLevel: AI_LEVEL) {
        this._rotationSpeed   = BODY_ROTATION_SPEED_BY_LEVEL[aiLevel];
        this._speedMultiplier = MOVE_SPEED_MULTIPLIER_BY_LEVEL[aiLevel];
    }

    /**
     * 毎フレーム、指定した目標位置（Navigator.currentTarget）へ向かって移動する。
     * プレイヤーと同じ 3 モード（ForwardAlign / ReverseAlign / ImmediateReverse）で動作する。
     * target が null のときは何もしない（移動停止）。
     */
    execute(tank: Tank, target: THREE.Vector3 | null, delta: number): void {
        if (!target) return;

        const pos    = tank.movement.position;
        const dx     = target.x - pos.x;
        const dz     = target.z - pos.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < 0.05 * 0.05) return;

        const inv = 1 / Math.sqrt(distSq);
        this._inputDir.set(dx * inv, 0, dz * inv);
        const inputDir = this._inputDir;

        const bodyAngle = tank.movement.rotationY;
        this._forward.set(-Math.sin(bodyAngle), 0, -Math.cos(bodyAngle));
        const forward = this._forward;

        // 入力方向と前方のなす角
        const dot      = Math.max(-1, Math.min(1, forward.dot(inputDir)));
        const angleToD = Math.acos(dot);

        // ── モード更新 ─────────────────────────────────────────────────
        if (this._moveMode !== 'ReverseAlign') {
            if (angleToD >= REAR_IMMEDIATE)
                this._moveMode = 'ImmediateReverse';
            else if (angleToD >= REVERSE_LOWER && angleToD <= REVERSE_UPPER)
                this._moveMode = 'ReverseAlign';
            else
                this._moveMode = 'ForwardAlign';
        } else {
            // ReverseAlign 解除はヒステリシスで安定させる
            if (angleToD < REVERSE_LOWER - HYSTERESIS)
                this._moveMode = 'ForwardAlign';
        }

        // ── モード別挙動 ──────────────────────────────────────────────
        const maxStep = this._rotationSpeed * delta;

        const moveDelta = delta * this._speedMultiplier;

        switch (this._moveMode) {

            case 'ImmediateReverse':
                // 車体を回さず現在の後方へ移動
                tank.movement.move(this._tempDir.copy(forward).negate(), moveDelta);
                break;

            case 'ReverseAlign': {
                // 後ろ向き（-inputDir）に車体を向けながら後退
                const targetAngle = dirToBodyAngle(this._tempDir.copy(inputDir).negate());
                const remain      = angleDiff(bodyAngle, targetAngle);
                const newAngle    = rotateTowards(bodyAngle, targetAngle, maxStep);
                tank.movement.setRotation(newAngle);
                if (remain <= MOVE_WHEN_ALIGNED) {
                    // bodyAngleToDir(newAngle).negate() = (sin, 0, cos)
                    tank.movement.move(this._tempDir.set(Math.sin(newAngle), 0, Math.cos(newAngle)), moveDelta);
                }
                break;
            }

            case 'ForwardAlign':
            default: {
                // inputDir に車体を向けながら前進
                const targetAngle = dirToBodyAngle(inputDir);
                const remain      = angleDiff(bodyAngle, targetAngle);
                const newAngle    = rotateTowards(bodyAngle, targetAngle, maxStep);
                tank.movement.setRotation(newAngle);
                if (remain <= MOVE_WHEN_ALIGNED) {
                    this._tempDir.set(-Math.sin(newAngle), 0, -Math.cos(newAngle));
                    tank.movement.move(this._tempDir, moveDelta);
                }
                break;
            }
        }
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
