import * as THREE from 'three';
import { StageObjectManager } from '../../managers/StageObjectManager';
import { ResultManager } from '../../managers/ResultManager';
import type { Tank }      from '../../object/tank/Tank';
import { WallRippleEffect } from '../../object/stage_object/WallRippleEffect';
import { WallCache } from './WallCache';
import type { UnifiedWallGroup } from './WallCache';
//import type { CubeEntry } from '../../managers/StageObjectManager';

export class CollisionSystem {

    // ─── フレーム間で再利用するコンテナ（毎フレーム new を避ける） ──────
    private readonly _shellBoxCache   = new Map<string, THREE.Box3>();
    private readonly _cubeBoxCache    = new Map<string, THREE.Box3>();
    private readonly _tankBoxCache    = new Map<Tank,   THREE.Box3>();
    private readonly _destroyedShells = new Set<string>();
    private readonly _tmpBox          = new THREE.Box3();

    // ─── 壁当たり判定集約キャッシュ ────────────────────────────────
    private readonly _wallCache = new WallCache();
    private _wallCacheDirty     = true;

    // ─── デバッグ可視化 ────────────────────────────────────────────
    private _debugScene:   THREE.Scene | null    = null;
    private _debugHelpers: THREE.Box3Helper[]    = [];

    constructor() {
        StageObjectManager.instance.onCubeChanged(() => { this._wallCacheDirty = true; });
    }

    /**
     * 壁の当たり判定を Three.js シーンにワイヤーフレームで表示する。
     * - シアン: break_wall を含まないグループ（wall / 外壁）
     * - 黄色:  break_wall を含むグループ
     * rebuild のたびに自動更新される。hideDebugVisualization() で消す。
     */
    showDebugVisualization(scene: THREE.Scene): void {
        this._debugScene = scene;
        this._refreshDebugHelpers();
    }

    hideDebugVisualization(): void {
        this._clearDebugHelpers();
        this._debugScene = null;
    }

    get isDebugVisible(): boolean { return this._debugScene !== null; }

    private _clearDebugHelpers(): void {
        for (const h of this._debugHelpers) h.removeFromParent();
        this._debugHelpers = [];
    }

    private _refreshDebugHelpers(): void {
        if (!this._debugScene) return;
        this._clearDebugHelpers();

        // デバッグ用に Y 軸を実際の壁（0-1）より大きく拡張して視認性を上げる
        const VIS_Y_MIN = -0.5;
        const VIS_Y_MAX =  3.0;
        const expand = (src: THREE.Box3) => new THREE.Box3(
            new THREE.Vector3(src.min.x, VIS_Y_MIN, src.min.z),
            new THREE.Vector3(src.max.x, VIS_Y_MAX, src.max.z),
        );

        for (const group of this._wallCache.wallGroups) {
            const hasBreakWall = group.entries.some(e => e.cube.info.type === 'break_wall');
            const color = hasBreakWall ? new THREE.Color(0xffff00) : new THREE.Color(0x00ffff);
            const h = new THREE.Box3Helper(expand(group.box), color);
            this._debugScene.add(h);
            this._debugHelpers.push(h);
        }
    }

    /** ゲームループから毎フレーム呼ぶ */
    update(): void {
        const mgr    = StageObjectManager.instance;
        const shells = mgr.allBullets;   // スナップショット
        const tanks  = mgr.aliveTanks;
        const cubes  = mgr.allCubes;     // スナップショット

        if (this._wallCacheDirty) {
            this._wallCache.rebuild(cubes);
            this._wallCacheDirty = false;
            this._refreshDebugHelpers();
        }

        // ─── BoundingBox キャッシュ ──────────────────────────────────
        // 弾・壁はこのフレーム内で位置が変わらないため先頭で一括計算する。
        // タンクはプッシュバック処理で位置が変わるため、弾との判定のみキャッシュを使い
        // 押し戻しセクションでは getBoundingBox() を都度呼び出す（後述）。
        this._shellBoxCache.clear();
        for (const e of shells) {
            let box = this._shellBoxCache.get(e.id);
            if (!box) { box = new THREE.Box3(); this._shellBoxCache.set(e.id, box); }
            e.shell.getBoundingBox(box);
        }
        const shellBoxCache = this._shellBoxCache;

        this._cubeBoxCache.clear();
        for (const e of cubes) {
            if (e.cube.info.type !== 'penetrate_wall') continue; // penetrate_wall のみ個別キャッシュ
            let box = this._cubeBoxCache.get(e.id);
            if (!box) { box = new THREE.Box3(); this._cubeBoxCache.set(e.id, box); }
            e.cube.getBoundingBox(box);
        }
        const cubeBoxCache = this._cubeBoxCache;

        this._tankBoxCache.clear();
        for (const t of tanks) {
            let box = this._tankBoxCache.get(t);
            if (!box) { box = new THREE.Box3(); this._tankBoxCache.set(t, box); }
            t.getBoundingBox(box);
        }
        const tankBoxCache = this._tankBoxCache;

        /** このフレームで既に消滅した弾の ID セット */
        this._destroyedShells.clear();
        const destroyedShells = this._destroyedShells;

        // ─── 弾 × 弾（相殺・貫徹）──────────────────────────────────
        // 陣営を問わずすべての弾が相互に相殺・貫徹する。
        // breakCount が大きい弾が相手を貫徹して生き残る。等値なら両者消滅。
        for (let i = 0; i < shells.length; i++) {
            if (destroyedShells.has(shells[i].id)) continue;
            const boxA = shellBoxCache.get(shells[i].id)!;

            for (let j = i + 1; j < shells.length; j++) {
                if (destroyedShells.has(shells[j].id)) continue;

                // 両方がスポーン直後の免疫状態なら相殺をスキップ
                if (shells[i].shell.isImmune && shells[j].shell.isImmune) continue;

                if (boxA.intersectsBox(shellBoxCache.get(shells[j].id)!)) {
                    // お互いの breakCount を先に取得してから同時にダメージ適用
                    // breakCount が大きい方が相手を貫徹して生き残る
                    const countA = shells[i].shell.breakCount;
                    const countB = shells[j].shell.breakCount;
                    if (shells[i].shell.takeDamage(countB)) destroyedShells.add(shells[i].id);
                    if (shells[j].shell.takeDamage(countA)) destroyedShells.add(shells[j].id);
                    break;
                }
            }
        }

        // ─── CoreBreaker_Spread × タンク（前方コーン検知→分裂）──────
        const CONE_COS   = Math.cos(Math.PI / 8);  // ±22.5°（計 45°）
        const CONE_RANGE = 5.0;                     // 検知距離（セル）
        const CONV_DIST  = 8.0;                     // 分裂弾の収束距離（セル）
        const SPREAD_STEP = 1.25;                   // 横変位ステップ（合計幅 5 セル / 4 区間）

        for (const entry of shells) {
            if (destroyedShells.has(entry.id)) continue;
            if (entry.shell.info.type !== 'CoreBreaker_Spread') continue;

            const shell   = entry.shell;
            const shellPos = shell.object.position;
            // XZ 平面上の前進方向
            const fwd = new THREE.Vector3(
                shell.motion.direction.x, 0, shell.motion.direction.z,
            ).normalize();

            let detected = false;
            for (const tank of tanks) {
                if (tank.info.id === entry.ownerTankId) continue;  // 自タンク除外
                const tp = tank.movement.position;
                const dx = tp.x - shellPos.x;
                const dz = tp.z - shellPos.z;
                const distSq = dx * dx + dz * dz;
                if (distSq > CONE_RANGE * CONE_RANGE) continue;

                const dist = Math.sqrt(distSq);
                if (dist < 0.001) continue;

                // 前方にいるか（前進成分が正）かつ角度が範囲内
                const fwdDot = (dx * fwd.x + dz * fwd.z) / dist;
                if (fwdDot >= CONE_COS) { detected = true; break; }
            }

            if (!detected) continue;

            // 分裂：CoreBreaker_Spread を消し、5 発の曲線弾を生成
            shell.onHit.hit();
            destroyedShells.add(entry.id);

            const spawnPos = shellPos.clone();
            // lateralFactor: -2, -1, 0, 1, 2 → 横変位: -2.5, -1.25, 0, 1.25, 2.5 セル
            for (let fi = -2; fi <= 2; fi++) {
                mgr.spawnCurvedShell(
                    'CoreBreaker_Spread_Child',
                    spawnPos,
                    fwd,
                    fi * SPREAD_STEP,
                    CONV_DIST,
                    0.7,              // 少し小さく
                    0.3,              // immunity
                    entry.ownerTankId,
                );
            }
        }

        // ─── 弾 × タンク ────────────────────────────────────────────
        for (const entry of shells) {
            if (destroyedShells.has(entry.id)) continue;

            const shellBox = shellBoxCache.get(entry.id)!;

            for (const tank of tanks) {
                if (shellBox.intersectsBox(tankBoxCache.get(tank)!)) {
                    const ownerInfo = mgr.getTank(entry.ownerTankId)?.info ?? null;
                    ResultManager.instance.recordKill(
                        tank.info,
                        { kind: 'shell', type: entry.shell.info.type },
                        ownerInfo,
                    );
                    tank.onHit.hit();                          // タンクを破壊
                    if (entry.shell.takeDamage(1))             // 弾は -1 耐久
                        destroyedShells.add(entry.id);
                    break;
                }
            }
        }

        // ─── 弾 × 壁 ────────────────────────────────────────────────
        for (const entry of shells) {
            if (destroyedShells.has(entry.id)) continue;

            const shell    = entry.shell;
            const shellBox = shellBoxCache.get(entry.id)!;

            // CoreBreaker 系は break_wall を破壊した時のみ貫徹する（wall は通れない）
            const penetratesBreakWall =
                shell.info.type === 'CoreBreaker' ||
                shell.info.type === 'CoreBreaker_Spread' ||
                shell.info.type === 'CoreBreaker_Spread_Child';

            // 統合壁グループ（wall + break_wall）でブロードフェーズ → マージ Box で精密判定
            let hitGroup:  UnifiedWallGroup | null = null;
            let hitBox:    THREE.Box3 | null        = null;
            let hitNormal: THREE.Vector3 | null     = null;
            let minDepth   = Infinity;

            for (const group of this._wallCache.wallGroups) {
                if (!shellBox.intersectsBox(group.box)) continue;

                for (const mergedBox of group.merged) {
                    if (!shellBox.intersectsBox(mergedBox)) continue;

                    const n = CollisionSystem.calcWallNormal(shellBox, mergedBox);
                    if (shell.motion.direction.dot(n) >= 0) continue;

                    const depth = CollisionSystem.calcPenetrationDepth(shellBox, mergedBox, n);
                    if (depth < shell.info.stats.radius) continue;
                    if (depth < minDepth) {
                        minDepth  = depth;
                        hitGroup  = group;
                        hitBox    = mergedBox;
                        hitNormal = n.clone();
                    }
                }
            }

            if (!hitBox || !hitNormal) continue;

            // ヒットしたグループの entries から最近接 break_wall セルを特定する
            let hitCubeEntry: typeof cubes[0] | null = null;
            if (hitGroup !== null && hitGroup.entries.length > 0) {
                const sp = shell.object.position;
                let nearestDistSq = Infinity;
                for (const e of hitGroup.entries) {
                    if (e.cube.info.type !== 'break_wall') continue;
                    e.cube.getBoundingBox(this._tmpBox);
                    const cx = (this._tmpBox.min.x + this._tmpBox.max.x) * 0.5;
                    const cz = (this._tmpBox.min.z + this._tmpBox.max.z) * 0.5;
                    const dSq = (sp.x - cx) ** 2 + (sp.z - cz) ** 2;
                    if (dSq < nearestDistSq) { nearestDistSq = dSq; hitCubeEntry = e; }
                }
            }

            // 壁の破壊チェック（break_wall のみ）
            const wallBroken = hitCubeEntry !== null &&
                !!(hitCubeEntry.cube.info.stats.breakBy?.includes(shell.info.type));
            if (wallBroken) hitCubeEntry!.cube.onHit.hit();

            // CoreBreaker 系は break_wall を壊した場合のみ貫徹（wall には跳ね返される）
            if (penetratesBreakWall && wallBroken) continue;

            // 壁ヒット波紋エフェクト（break_wall 破壊時を除く）
            if (!wallBroken) {
                const hitPoint = shell.object.position.clone();
                if      (Math.abs(hitNormal.x) > 0.5) hitPoint.x = hitNormal.x > 0 ? hitBox.max.x : hitBox.min.x;
                else if (Math.abs(hitNormal.z) > 0.5) hitPoint.z = hitNormal.z > 0 ? hitBox.max.z : hitBox.min.z;
                else                                   hitPoint.y = hitNormal.y > 0 ? hitBox.max.y : hitBox.min.y;
                const scene = (hitCubeEntry ?? cubes.find(e => e.cube.getScene() !== null))
                    ?.cube.getScene() ?? null;
                if (scene) {
                    const effect = new WallRippleEffect(hitPoint, hitNormal, scene);
                    StageObjectManager.instance.registerWallRippleEffect(effect);
                }
            }

            // ClusterBolt は壁に当たると必ず 4 発に分裂する
            if (shell.info.type === 'ClusterBolt') {
                const n = hitNormal;
                const d = shell.motion.direction;

                shell.onHit.hit();
                destroyedShells.add(entry.id);

                const spawnPos = shell.object.position.clone();
                const yAxis    = new THREE.Vector3(0, 1, 0);

                // ─── 壁面からの入射角で 3 パターンに分岐 ──────────────────
                // surfaceAngle: 壁面に対する角度（0°=完全に平行、90°=垂直）
                // d·n < 0 なので -d·n = sin(surfaceAngle)
                const surfaceAngle = Math.asin(Math.min(1, -d.dot(n)));
                const DEG30 = Math.PI / 6;   // 30°
                const DEG10 = Math.PI / 18;  // 10°

                if (surfaceAngle < DEG10) {
                    // ── 10°未満: 壁法線を基準に ±15°/±45° で 4 発 ──────────
                    const PERP_SPREAD = Math.PI / 4;
                    for (const ratio of [-1, -1 / 3, 1 / 3, 1]) {
                        const dir = n.clone().applyAxisAngle(yAxis, ratio * PERP_SPREAD).normalize();
                        mgr.spawnShell('ClusterBolt_Child', spawnPos, dir, 0.3, entry.ownerTankId);
                    }
                } else {
                    // ── 10°以上: 反射方向を基準に安全な扇を展開 ────────────
                    const reflected  = d.clone().sub(n.clone().multiplyScalar(2 * d.dot(n))).normalize();
                    const rDotN      = Math.max(0, Math.min(1, reflected.dot(n)));
                    const maxSafe    = Math.asin(rDotN);
                    const SAFETY_DEG = 5 * Math.PI / 180;
                    const spread     = Math.min(Math.PI / 4, Math.max(0, maxSafe - SAFETY_DEG));

                    const immunity = surfaceAngle < DEG30 ? 1.0 : 0.3;

                    for (const ratio of [-1, -1 / 3, 1 / 3, 1]) {
                        const dir = reflected.clone().applyAxisAngle(yAxis, ratio * spread).normalize();
                        mgr.spawnShell('ClusterBolt_Child', spawnPos, dir, immunity, entry.ownerTankId);
                    }
                }
                continue;
            }

            // 弾の反射 or 消滅
            if (shell.reflect.canReflect) {
                shell.motion.direction = shell.reflect.reflect(shell.motion.direction, hitNormal);
                shell.motion.alignToDirection();
            } else {
                shell.onHit.hit();
                destroyedShells.add(entry.id);
            }
        }

        // ─── タンク × 壁 ────────────────────────────────────────────
        // タンクはプッシュバックで位置が変わるため getBoundingBox() を都度再取得する。
        for (const tank of tanks) {
            // ① wall / break_wall（統合グループ。外接 Box でブロードフェーズ → マージ Box で押し戻し）
            for (const group of this._wallCache.wallGroups) {
                if (!tank.getBoundingBox().intersectsBox(group.box)) continue;

                for (const mergedBox of group.merged) {
                    const tankBox = tank.getBoundingBox();
                    if (tankBox.intersectsBox(mergedBox)) {
                        CollisionSystem.pushBackTank(tank, tankBox, mergedBox);
                    }
                }
            }

            // ② penetrate_wall（個別キューブ・シェルは通すがタンクは止める）
            for (const cubeEntry of cubes) {
                if (cubeEntry.cube.info.type !== 'penetrate_wall') continue;

                const tankBox = tank.getBoundingBox();
                const cubeBox = cubeBoxCache.get(cubeEntry.id)!;

                if (tankBox.intersectsBox(cubeBox)) {
                    CollisionSystem.pushBackTank(tank, tankBox, cubeBox);
                }
            }
        }

        // ─── タンク × タンク ─────────────────────────────────────────
        for (let i = 0; i < tanks.length; i++) {
            for (let j = i + 1; j < tanks.length; j++) {
                const boxA = tanks[i].getBoundingBox();
                const boxB = tanks[j].getBoundingBox();
                if (boxA.intersectsBox(boxB)) {
                    CollisionSystem.pushBackTankPair(tanks[i], boxA, tanks[j], boxB);
                }
            }
        }
    }

    /**
     * 弾が壁へ侵入している深さを法線方向で計算する。
     * 値が小さいほど直前フレームに衝突した面 → 複数壁が重なるとき正しい面を選ぶために使う。
     */
    private static calcPenetrationDepth(
        shellBox: THREE.Box3,
        cubeBox:  THREE.Box3,
        normal:   THREE.Vector3,
    ): number {
        if (Math.abs(normal.x) > 0.5) {
            return normal.x > 0
                ? cubeBox.max.x - shellBox.min.x   // 弾が壁の +X 面から侵入
                : shellBox.max.x - cubeBox.min.x;  // 弾が壁の -X 面から侵入
        } else if (Math.abs(normal.z) > 0.5) {
            return normal.z > 0
                ? cubeBox.max.z - shellBox.min.z
                : shellBox.max.z - cubeBox.min.z;
        } else {
            return normal.y > 0
                ? cubeBox.max.y - shellBox.min.y
                : shellBox.max.y - cubeBox.min.y;
        }
    }

    // calcWallNormal の一時ベクトル（毎フレーム大量に呼ばれるため GC 圧力を下げる）
    private static readonly _wnShellCenter = new THREE.Vector3();
    private static readonly _wnCubeCenter  = new THREE.Vector3();
    // 戻り値の再利用（呼び出し元は保存が必要な場合のみ .clone() すること）
    private static readonly _wnResult      = new THREE.Vector3();

    /**
     * 壁の法線を計算する（SAT 最小オーバーラップ方式）。
     * 各軸の AABB 重複量を比較し、最小の軸＝直前に侵入した面として法線を返す。
     * 隣接壁で AABB が重複する状況でも正しい面を選べ、
     * direction.dot(n) >= 0 フィルタとも正しく連携する。
     */
    private static calcWallNormal(
        shellBox: THREE.Box3,
        cubeBox:  THREE.Box3,
    ): THREE.Vector3 {
        const overlapX = Math.min(
            shellBox.max.x - cubeBox.min.x,
            cubeBox.max.x  - shellBox.min.x,
        );
        const overlapY = Math.min(
            shellBox.max.y - cubeBox.min.y,
            cubeBox.max.y  - shellBox.min.y,
        );
        const overlapZ = Math.min(
            shellBox.max.z - cubeBox.min.z,
            cubeBox.max.z  - shellBox.min.z,
        );

        shellBox.getCenter(CollisionSystem._wnShellCenter);
        cubeBox.getCenter(CollisionSystem._wnCubeCenter);
        const dx = CollisionSystem._wnShellCenter.x - CollisionSystem._wnCubeCenter.x;
        const dy = CollisionSystem._wnShellCenter.y - CollisionSystem._wnCubeCenter.y;
        const dz = CollisionSystem._wnShellCenter.z - CollisionSystem._wnCubeCenter.z;

        if (overlapX <= overlapZ && overlapX <= overlapY) {
            return CollisionSystem._wnResult.set(Math.sign(dx), 0, 0);
        } else if (overlapZ <= overlapX && overlapZ <= overlapY) {
            return CollisionSystem._wnResult.set(0, 0, Math.sign(dz));
        } else {
            return CollisionSystem._wnResult.set(0, Math.sign(dy), 0);
        }
    }

    /**
     * 2 体のタンクが重なっているとき、両者を等量ずつ押し離す。
     * オーバーラップが小さい XZ 軸方向に押し出す（Y は無視）。
     */
    private static pushBackTankPair(
        tankA: Tank, boxA: THREE.Box3,
        tankB: Tank, boxB: THREE.Box3,
    ): void {
        const overlapX = Math.min(
            boxA.max.x - boxB.min.x,
            boxB.max.x - boxA.min.x,
        );
        const overlapZ = Math.min(
            boxA.max.z - boxB.min.z,
            boxB.max.z - boxA.min.z,
        );

        const half = 0.5;
        if (overlapX <= overlapZ) {
            const sign = tankA.movement.position.x < tankB.movement.position.x ? -1 : 1;
            tankA.movement.position.x += sign * overlapX * half;
            tankB.movement.position.x -= sign * overlapX * half;
        } else {
            const sign = tankA.movement.position.z < tankB.movement.position.z ? -1 : 1;
            tankA.movement.position.z += sign * overlapZ * half;
            tankB.movement.position.z -= sign * overlapZ * half;
        }
    }

    /**
     * タンクを壁の外に押し戻す。
     * XZ 平面のオーバーラップが小さい軸方向に押し出す（Y は無視）。
     */
    private static pushBackTank(
        tank:    Tank,
        tankBox: THREE.Box3,
        cubeBox: THREE.Box3,
    ): void {
        const overlapX = Math.min(
            tankBox.max.x - cubeBox.min.x,
            cubeBox.max.x - tankBox.min.x,
        );
        const overlapZ = Math.min(
            tankBox.max.z - cubeBox.min.z,
            cubeBox.max.z - tankBox.min.z,
        );

        const center = new THREE.Vector3();
        cubeBox.getCenter(center);

        if (overlapX <= overlapZ) {
            const sign = tank.movement.position.x < center.x ? -1 : 1;
            tank.movement.position.x += sign * overlapX;
        } else {
            const sign = tank.movement.position.z < center.z ? -1 : 1;
            tank.movement.position.z += sign * overlapZ;
        }
    }
}
