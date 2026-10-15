import * as THREE from 'three';
import type { Tank }  from '../../../tank/Tank';
import type { Shell } from '../../shell/Shell';
import type { Mine }  from '../Mine';

/** 弾（Shell）が地雷を起爆させる検知距離（セル単位）。タンク侵入トリガーとは別。 */
export const SHELL_TRIGGER_RADIUS = 1.0;

/**
 * 地雷の起爆を管理するクラス。
 *
 * 起爆条件:
 *   1. 弾が地雷から SHELL_TRIGGER_RADIUS 以内を通過したとき（即時起爆）
 *      ※ allowShellTrigger が false の場合はスキップ
 *   2. 設置時に爆発範囲外にいた（または外へ出た）タンクが
 *      爆発範囲内に新規侵入したとき（「侵入」でのみ起爆）
 *   3. explosionTime 秒経過後（自動起爆）
 *
 * 設置時にすでに爆発範囲内にいたタンクは、一度外に出て再侵入するまで起爆しない。
 * タンク用起爆半径 = MineStats.explosionRange（爆発範囲と同等）。
 */
export class Detonator {
    private timer:       number;  // 自動起爆カウントダウン（秒）
    private triggered  = false;
    private initialized = false;  // 初回 update で内側タンクを登録済みか

    /** 現在タンクトリガー半径内にいるタンク ID のセット */
    private readonly insideSet = new Set<string>();

    private readonly _tankTriggerRadius: number;
    private readonly allowShellTrigger: boolean;
    private readonly onExplode: (
        center: THREE.Vector3,
        tanks:  Tank[],
        mines:  Mine[],
        shells: Shell[],
    ) => void;

    constructor(
        explosionTime:     number,
        tankTriggerRadius: number,
        onExplode: (
            center: THREE.Vector3,
            tanks:  Tank[],
            mines:  Mine[],
            shells: Shell[],
        ) => void,
        allowShellTrigger = true,
    ) {
        this.timer              = explosionTime;
        this._tankTriggerRadius = tankTriggerRadius;
        this.onExplode          = onExplode;
        this.allowShellTrigger  = allowShellTrigger;
    }

    get hasTriggered(): boolean { return this.triggered; }

    /** 自動起爆までの残り秒数（起爆済みなら 0） */
    get remainingTime(): number { return this.triggered ? 0 : Math.max(0, this.timer); }

    get tankTriggerRadius(): number { return this._tankTriggerRadius; }

    /**
     * ゲームループから毎フレーム呼ぶ。
     * @param delta   フレーム経過時間（秒）
     * @param minePos 地雷のワールド座標
     * @param tanks   フィールド上の生存タンク
     * @param shells  フィールド上の全弾
     * @param mines   フィールド上の全地雷（コールバックへ転送）
     */
    update(delta: number, minePos: THREE.Vector3, tanks: Tank[], shells: Shell[], mines: Mine[]): void {
        if (this.triggered) return;

        // ── 自動起爆タイマー ─────────────────────────────────────────
        this.timer -= delta;
        if (this.timer <= 0) {
            this.trigger(minePos, tanks, mines, shells);
            return;
        }

        // ── 弾トリガー（侵入検知不要・通過で即起爆） ─────────────────
        if (this.allowShellTrigger) {
            const sr2 = SHELL_TRIGGER_RADIUS * SHELL_TRIGGER_RADIUS;
            for (const shell of shells) {
                const sPos = shell.object.position;
                const sdx  = sPos.x - minePos.x;
                const sdz  = sPos.z - minePos.z;
                if (sdx * sdx + sdz * sdz <= sr2) {
                    this.trigger(minePos, tanks, mines, shells);
                    return;
                }
            }
        }

        // ── タンク侵入トリガー（爆発範囲と同等、新規侵入のみ起爆） ──────
        const tx  = minePos.x;
        const tz  = minePos.z;
        const tr2 = this._tankTriggerRadius * this._tankTriggerRadius;

        if (!this.initialized) {
            // 初回：現在範囲内にいるタンクを「すでに内側」として登録（起爆しない）
            for (const tank of tanks) {
                const pos = tank.movement.position;
                const dx  = pos.x - tx;
                const dz  = pos.z - tz;
                if (dx * dx + dz * dz <= tr2) {
                    this.insideSet.add(tank.info.id);
                }
            }
            this.initialized = true;
            return;
        }

        // 侵入検知
        const currentlyInside = new Set<string>();

        for (const tank of tanks) {
            const pos = tank.movement.position;
            const dx  = pos.x - tx;
            const dz  = pos.z - tz;

            if (dx * dx + dz * dz <= tr2) {
                currentlyInside.add(tank.info.id);
                // insideSet に登録されていない = 外から侵入した → 起爆
                if (!this.insideSet.has(tank.info.id)) {
                    this.trigger(minePos, tanks, mines, shells);
                    return;
                }
            }
        }

        // insideSet を今フレームの内側タンクで更新（外へ出たタンクは自動的に削除）
        this.insideSet.clear();
        for (const id of currentlyInside) {
            this.insideSet.add(id);
        }
    }

    private trigger(center: THREE.Vector3, tanks: Tank[], mines: Mine[], shells: Shell[]): void {
        this.triggered = true;
        this.onExplode(center.clone(), tanks, mines, shells);
    }
}
