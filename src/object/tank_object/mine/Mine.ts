import * as THREE from 'three';
import type { IHitDetection } from '../../IHitDetction';
import type { MineInformation } from './MineInformation';
import type { Tank } from '../../tank/Tank';
import type { Shell } from '../shell/Shell';
import { OnHit } from '../../OnHit';
import { Detonator } from './function/Detonator';
import { MineEffect } from './MineEffect';
import { CubeEffect } from '../../stage_object/CubeEffect';
import { StageObjectManager } from '../../../managers/StageObjectManager';
import { ResultManager } from '../../../managers/ResultManager';
import { SoundManager } from '../../../managers/SoundManager';
import { SE } from '../../../Definition/SoundList';

export class Mine implements IHitDetection {
    readonly info: MineInformation;
    readonly object: THREE.Object3D;
    readonly onHit: OnHit;

    private readonly detonator: Detonator;
    private effect: MineEffect | null = null;
    private exploding = false;

    private ringTime = 0;

    // 起爆カウントダウン警告用：Mat_Warning マテリアルの参照と元色
    private readonly warningMaterials: THREE.MeshStandardMaterial[] = [];
    private readonly WARNING_SECONDS = 5;
    private warningTime = 0;
    private warningIsRed = false;

    constructor(
        info: MineInformation,
        object: THREE.Object3D,
        onDestroy: () => void,
    ) {
        this.info = info;
        this.object = object;
        this.onHit = new OnHit(onDestroy);

        this.detonator = new Detonator(
            info.stats.explosionTime,
            info.stats.explosionRange, // タンクトリガー = 爆発範囲と同等
            (center, tanks, mines, shells) => this.explode(center, tanks, mines, shells),
            info.type !== 'select', // select 型は弾による起爆なし
        );

        // Mat_Warning マテリアルを収集して点滅制御に使う
        this.object.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            for (const mat of mats) {
                if (mat instanceof THREE.MeshStandardMaterial && mat.name === 'Mat_Warning') {
                    this.warningMaterials.push(mat);
                }
            }
        });
    }

    getBoundingBox(target = new THREE.Box3()): THREE.Box3 {
        return target.setFromObject(this.object);
    }

    /** 爆発エフェクト実行中か */
    get isExploding(): boolean { return this.exploding; }

    /**
     * ゲームループから毎フレーム呼ぶ。
     * @param delta   フレーム経過時間（秒）
     * @param tanks   フィールド上の生存タンク
     * @param shells  フィールド上の全弾
     * @param mines   フィールド上の全地雷（誘爆判定用）
     */
    update(delta: number, tanks: Tank[], shells: Shell[], mines: Mine[]): void {
        if (this.exploding) {
            this.effect?.update(delta);
            if (this.effect?.isComplete) {
                this.onHit.hit();
            }
            return;
        }

        this.ringTime += delta;

        // 起爆5秒前：Mat_Warning を元色↔赤でトグル点滅
        const remaining = this.detonator.remainingTime;
        if (remaining <= this.WARNING_SECONDS && this.warningMaterials.length > 0) {
            this.warningTime += delta;
            // 残り時間が少ないほど速くなる（1Hz→4Hz）
            const blinkHz  = 1 + (1 - remaining / this.WARNING_SECONDS) * 3;
            const isRed    = Math.sin(this.warningTime * Math.PI * 2 * blinkHz) > 0;
            if (isRed !== this.warningIsRed) {
                this.warningIsRed = isRed;
                for (const mat of this.warningMaterials) {
                    if (isRed) {
                        mat.color.setHex(0xff0000);
                        mat.emissive.setHex(0xff0000);
                    } else {
                        mat.color.setHex(this.info.stats.effectColor);
                        mat.emissive.setHex(this.info.stats.effectColor);
                    }
                }
            }
        }

        this.detonator.update(delta, this.object.position, tanks, shells, mines);
    }

    /**
     * 他の地雷の爆発に巻き込まれて誘爆する。
     * すでに爆発中の場合は何もしない（循環防止）。
     * hitTankIds / hitShellIds / hitCubeIds は連鎖爆発内での二重ヒット防止セット。
     */
    triggerByChainExplosion(
        tanks:       Tank[],
        mines:       Mine[],
        shells:      Shell[],
        hitTankIds:  Set<string>,
        hitShellIds: Set<string>,
        hitCubeIds:  Set<string>,
    ): void {
        if (this.exploding) return;
        if (this.info.type === 'select') return; // select 型は誘爆しない
        this.explode(this.object.position, tanks, mines, shells, hitTankIds, hitShellIds, hitCubeIds);
    }

    // ─── 起爆 ─────────────────────────────────────────────────────────

    private explode(
        center:      THREE.Vector3,
        tanks:       Tank[],
        mines:       Mine[],
        shells:      Shell[],
        hitTankIds  = new Set<string>(),
        hitShellIds = new Set<string>(),
        hitCubeIds  = new Set<string>(),
    ): void {
        this.exploding = true;
        this.object.visible = false; // 本体を非表示
        SoundManager.instance.playSE(SE.EXPLODE);

        // ジャミングエフェクトをシーン（地雷と同じ親）に追加
        if (this.object.parent) {
            this.effect = new MineEffect(center, this.info.stats, this.object.parent);
        }

        // 爆発範囲内のタンクにダメージ
        this.applyExplosionDamage(center, tanks, shells, hitTankIds, hitShellIds);

        // 爆発範囲内の他の地雷を誘爆（連鎖爆発）
        this.applyChainDetonation(center, mines, tanks, shells, hitTankIds, hitShellIds, hitCubeIds);

        // 爆発範囲内の破壊可能な壁を消滅させる
        this.applyExplosionToCubes(center, hitCubeIds);
    }

    private applyExplosionToCubes(center: THREE.Vector3, hitCubeIds: Set<string>): void {
        const range = this.info.stats.explosionRange;
        const r2    = range * range;
        const mgr   = StageObjectManager.instance;
        const scene = this.object.parent;

        for (const cubeEntry of mgr.allCubes) {
            if (hitCubeIds.has(cubeEntry.id)) continue; // 連鎖内で処理済み

            // mine で破壊できるキューブのみ対象
            if (!cubeEntry.cube.info.stats.breakBy?.includes('mine')) continue;

            const pos = cubeEntry.cube.object.position;
            const dx  = pos.x - center.x;
            const dz  = pos.z - center.z;
            if (dx * dx + dz * dz > r2) continue;

            hitCubeIds.add(cubeEntry.id);

            // キューブ中心でジャミングエフェクトを生成
            if (scene) {
                const effectCenter = new THREE.Vector3(pos.x, 0.5, pos.z);
                const effect = new CubeEffect(effectCenter, scene);
                mgr.registerCubeEffect(effect);
            }

            cubeEntry.cube.onHit.hit();
        }
    }

    private applyExplosionDamage(
        center:      THREE.Vector3,
        tanks:       Tank[],
        shells:      Shell[],
        hitTankIds:  Set<string>,
        hitShellIds: Set<string>,
    ): void {
        const range = this.info.stats.explosionRange;
        const r2 = range * range;

        for (const tank of tanks) {
            if (hitTankIds.has(tank.info.id)) continue; // 連鎖内で処理済み
            const pos = tank.movement.position;
            const dx = pos.x - center.x;
            const dz = pos.z - center.z;
            if (dx * dx + dz * dz <= r2) {
                hitTankIds.add(tank.info.id);
                const mgr       = StageObjectManager.instance;
                const mineEntry = mgr.getMine(this.info.id);
                const ownerInfo = mineEntry ? mgr.getTank(mineEntry.ownerTankId)?.info ?? null : null;
                ResultManager.instance.recordKill(
                    tank.info,
                    { kind: 'mine', type: this.info.type },
                    ownerInfo,
                );
                tank.onHit.hit();
            }
        }

        for (const shell of shells) {
            if (hitShellIds.has(shell.info.id)) continue; // 連鎖内で処理済み
            const pos = shell.object.position;
            const dx = pos.x - center.x;
            const dz = pos.z - center.z;
            // 「弾用起爆範囲」ではなく、広い方の「爆発範囲」で判定
            if (dx * dx + dz * dz <= r2) {
                hitShellIds.add(shell.info.id);
                shell.takeDamage(2); // 地雷爆発で -2 耐久
            }
        }
    }

    private applyChainDetonation(
        center:      THREE.Vector3,
        mines:       Mine[],
        tanks:       Tank[],
        shells:      Shell[],
        hitTankIds:  Set<string>,
        hitShellIds: Set<string>,
        hitCubeIds:  Set<string>,
    ): void {
        const range = this.info.stats.explosionRange;
        const r2 = range * range;

        for (const mine of mines) {
            if (mine === this || mine.exploding) continue;

            const pos = mine.object.position;
            const dx = pos.x - center.x;
            const dz = pos.z - center.z;
            if (dx * dx + dz * dz <= r2) {
                mine.triggerByChainExplosion(tanks, mines, shells, hitTankIds, hitShellIds, hitCubeIds);
            }
        }
    }
}
