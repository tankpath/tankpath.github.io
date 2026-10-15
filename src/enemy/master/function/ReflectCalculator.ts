// 反射計算
/** もらうもの　＝＞　自タンクの位置情報、対象（プレイヤー）の情報（idなど）, 反射回数
 *  わたすもの　＝＞　[発砲位置]（砲塔回転のための）
 */

import * as THREE from 'three';
import type { BattleFieldConfig } from '../../../scene/battle/BattleField';

export class ReflectCalculator {

    /**
     * 壁反射を使って対象タンクに弾を届ける「発砲位置」を計算する。
     *
     * アルゴリズム：鏡像法（Image Method / Billiards Unfolding）
     *   - フィールドをタイル状に展開した空間で、ターゲットの「鏡像」を列挙する。
     *   - 鏡像への直線が外壁を n 回横切る経路が、n 回反射軌跡に対応する。
     *   - x 方向の反射回数 rx と z 方向の反射回数 rz（rx+rz=reflectCount）を全組み合わせ試す。
     *   - 内部壁（shellBlocker）を通過しない経路が見つかったら、最初の壁衝突点を返す。
     *
     * @param self         自タンクのワールド座標
     * @param target       対象プレイヤータンクのワールド座標
     * @param reflectCount 反射回数（3 または 5）
     * @param config       フィールド設定
     * @returns 最初の壁衝突点（砲塔をここへ向けることで反射弾が target に到達する）、
     *          有効な経路がない場合は null
     */
    calculate(
        self: THREE.Vector3,
        target: THREE.Vector3,
        reflectCount: number,
        config: BattleFieldConfig,
        blocked: boolean[][],
        shellRadius: number,
        totalReflectCount: number = reflectCount,
    ): THREE.Vector3 | null {
        if (reflectCount < 2 || reflectCount > 5) return null;

        const { rows, cols, cellSize } = config;
        const W = cols * cellSize;  // フィールド横幅 (x 軸)
        const H = rows * cellSize;  // フィールド縦幅 (z 軸)

        // x 方向反射 rx と z 方向反射 rz の全組み合わせを試す
        for (let rx = 0; rx <= reflectCount; rx++) {
            const rz = reflectCount - rx;

            const xImgs = this._candidateImages(self.x, target.x, W, rx);
            const zImgs = this._candidateImages(self.z, target.z, H, rz);

            for (const xi of xImgs) {
                for (const zi of zImgs) {
                    const dx = xi - self.x;
                    const dz = zi - self.z;
                    if (Math.abs(dx) < 1e-9 && Math.abs(dz) < 1e-9) continue;

                    // 最初の壁衝突点（砲塔が向くべき点）を求める
                    const hit = this._firstWallHit(self.x, self.z, xi, zi, W, H);
                    if (!hit) continue;

                    // 全反射区間が内部壁で遮られていないか確認
                    if (!this._pathIsValid(self.x, self.z, xi, zi, W, H, blocked, rows, cols, cellSize, shellRadius)) continue;

                    // 余剰反射（totalReflectCount > reflectCount）で自滅しないか確認
                    const extra = totalReflectCount - reflectCount;
                    if (extra > 0) {
                        // ターゲット到達時の進行方向を計算（展開空間方向を反射回数で符号反転）
                        const norm = Math.sqrt(dx * dx + dz * dz);
                        const arrivingDx = (dx / norm) * (rx % 2 === 0 ? 1 : -1);
                        const arrivingDz = (dz / norm) * (rz % 2 === 0 ? 1 : -1);
                        const safeRadius = shellRadius + cellSize * 0.5;
                        if (!this._extraBouncesAreSafe(
                            target.x, target.z, self.x, self.z,
                            arrivingDx, arrivingDz, extra, W, H, safeRadius,
                        )) continue;
                    }

                    return new THREE.Vector3(hit.x, self.y, hit.z);
                }
            }
        }

        return null;
    }

    // ─── 鏡像計算 ─────────────────────────────────────────────────────

    /**
     * 1 次元区間 [0, L] において start → image 間にちょうど n 回の
     * 壁交差（L の整数倍）をもつ鏡像位置の一覧を返す。
     * 鏡像は 2kL + target または 2kL - target（k ∈ Z）で表される。
     */
    private _candidateImages(start: number, target: number, L: number, n: number): number[] {
        const result: number[] = [];
        const range = n + 2; // 探索範囲（余裕を持って ±(n+2) まで）
        for (let k = -range; k <= range; k++) {
            for (const img of [2 * k * L + target, 2 * k * L - target]) {
                if (this._countCrossings(start, img, L) === n) {
                    result.push(img);
                }
            }
        }
        return result;
    }

    /**
     * a と b の間に L の整数倍が何個あるかを返す（端点は含まない）。
     * 端点境界の浮動小数点誤差を避けるため小さな epsilon を使用する。
     */
    private _countCrossings(a: number, b: number, L: number): number {
        if (L < 1e-9) return 0;
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        return Math.floor((hi - 1e-9) / L) - Math.floor((lo + 1e-9) / L);
    }

    // ─── 発砲位置（最初の壁衝突点）─────────────────────────────────────

    /**
     * 展開空間での直線 (sx,sz) → (xi,zi) における最初の壁交差 t を求め、
     * 元の [0,W]×[0,H] 空間に折り返した衝突点を返す。
     * 反射経路が存在しない（壁交差なし）場合は null を返す。
     */
    private _firstWallHit(
        sx: number, sz: number,
        xi: number, zi: number,
        W: number, H: number,
    ): { x: number; z: number } | null {
        const dx = xi - sx;
        const dz = zi - sz;
        let tFirst = Infinity;

        if (Math.abs(dx) > 1e-9) {
            const k = dx > 0 ? Math.floor(sx / W) + 1 : Math.ceil(sx / W) - 1;
            const t = (k * W - sx) / dx;
            if (t > 1e-9 && t < 1 + 1e-9) tFirst = Math.min(tFirst, t);
        }

        if (Math.abs(dz) > 1e-9) {
            const k = dz > 0 ? Math.floor(sz / H) + 1 : Math.ceil(sz / H) - 1;
            const t = (k * H - sz) / dz;
            if (t > 1e-9 && t < 1 + 1e-9) tFirst = Math.min(tFirst, t);
        }

        if (!isFinite(tFirst)) return null;

        return {
            x: this._fold(sx + tFirst * dx, W),
            z: this._fold(sz + tFirst * dz, H),
        };
    }

    /**
     * 展開座標 x を [0, L] に折り返す（ビリヤード折り返し）。
     *   x mod 2L ∈ [0, L]  → そのまま
     *   x mod 2L ∈ [L, 2L] → 2L - (x mod 2L)
     */
    private _fold(x: number, L: number): number {
        const twoL = 2 * L;
        const mod = ((x % twoL) + twoL) % twoL;
        return mod <= L ? mod : twoL - mod;
    }

    // ─── 余剰反射の自滅チェック ───────────────────────────────────────

    /**
     * ターゲット到達後の余剰反射区間が自タンクの近傍を通過しないか確認する。
     * 内部壁は考慮しない（保守的チェック）。
     *
     * @param fromX/fromZ  ターゲット位置（余剰反射の出発点）
     * @param selfX/selfZ  自タンク位置
     * @param dx/dz        ターゲット到達時の進行方向（正規化済み）
     * @param bounces      余剰反射回数
     * @param W/H          フィールドサイズ
     * @param safeRadius   自滅判定半径
     * @returns true = 安全（自滅なし）, false = 自滅リスクあり
     */
    private _extraBouncesAreSafe(
        fromX: number, fromZ: number,
        selfX: number, selfZ: number,
        dx: number, dz: number,
        bounces: number,
        W: number, H: number,
        safeRadius: number,
    ): boolean {
        let x = fromX, z = fromZ;
        let vx = dx, vz = dz;
        for (let i = 0; i < bounces; i++) {
            const hit = this._nextWallHit(x, z, vx, vz, W, H);
            if (!hit) return true;
            if (this._segmentPassesNear(x, z, hit.x, hit.z, selfX, selfZ, safeRadius)) return false;
            if (hit.isXWall) vx = -vx; else vz = -vz;
            x = hit.x;
            z = hit.z;
        }
        return true;
    }

    /**
     * 位置 (x,z) から方向 (dx,dz) に進んだとき最初に当たる外壁の衝突点を返す。
     */
    private _nextWallHit(
        x: number, z: number,
        dx: number, dz: number,
        W: number, H: number,
    ): { x: number; z: number; isXWall: boolean } | null {
        let tMin = Infinity;
        let isXWall = true;
        if (dx > 1e-9) {
            const t = (W - x) / dx;
            if (t > 1e-9) { tMin = t; isXWall = true; }
        } else if (dx < -1e-9) {
            const t = -x / dx;
            if (t > 1e-9) { tMin = t; isXWall = true; }
        }
        if (dz > 1e-9) {
            const t = (H - z) / dz;
            if (t > 1e-9 && t < tMin) { tMin = t; isXWall = false; }
        } else if (dz < -1e-9) {
            const t = -z / dz;
            if (t > 1e-9 && t < tMin) { tMin = t; isXWall = false; }
        }
        if (!isFinite(tMin)) return null;
        return { x: x + tMin * dx, z: z + tMin * dz, isXWall };
    }

    // ─── 経路の妥当性検証 ─────────────────────────────────────────────

    /**
     * 展開空間の直線 (sx,sz) → (xi,zi) を壁交差点ですべての区間に分割し、
     * 各区間を元の空間に折り返したとき shellBlocker セルを通らないか確認する。
     */
    private _pathIsValid(
        sx: number, sz: number,
        xi: number, zi: number,
        W: number, H: number,
        blocked: boolean[][],
        rows: number, cols: number, cellSize: number,
        shellRadius: number,
    ): boolean {
        const dx = xi - sx;
        const dz = zi - sz;

        // 壁交差パラメータ t を収集（t=0: 出発点、t=1: ターゲット到達点）
        const ts: number[] = [0, 1];

        if (Math.abs(dx) > 1e-9) {
            const lo = Math.min(sx, xi);
            const hi = Math.max(sx, xi);
            const kStart = Math.floor((lo + 1e-9) / W) + 1;
            const kEnd   = Math.floor((hi - 1e-9) / W);
            for (let k = kStart; k <= kEnd; k++) {
                const t = (k * W - sx) / dx;
                if (t > 1e-9 && t < 1 - 1e-9) ts.push(t);
            }
        }

        if (Math.abs(dz) > 1e-9) {
            const lo = Math.min(sz, zi);
            const hi = Math.max(sz, zi);
            const kStart = Math.floor((lo + 1e-9) / H) + 1;
            const kEnd   = Math.floor((hi - 1e-9) / H);
            for (let k = kStart; k <= kEnd; k++) {
                const t = (k * H - sz) / dz;
                if (t > 1e-9 && t < 1 - 1e-9) ts.push(t);
            }
        }

        ts.sort((a, b) => a - b);

        // 自滅防止：自タンク半径 + 弾半径 の合計距離を安全余裕として使用
        const safeRadius = shellRadius + cellSize * 0.5;

        // 各区間を折り返して内部壁チェック＋自滅チェック
        for (let i = 0; i < ts.length - 1; i++) {
            const t0 = ts[i];
            const t1 = ts[i + 1];
            const p1 = { x: this._fold(sx + t0 * dx, W), z: this._fold(sz + t0 * dz, H) };
            const p2 = { x: this._fold(sx + t1 * dx, W), z: this._fold(sz + t1 * dz, H) };

            if (!this._segmentClear(p1.x, p1.z, p2.x, p2.z, blocked, rows, cols, cellSize, shellRadius)) {
                return false;
            }
            // 自滅防止：第1区間（i=0）は自タンクから出発するため除外し、以降の区間をチェック
            if (i > 0 && this._segmentPassesNear(p1.x, p1.z, p2.x, p2.z, sx, sz, safeRadius)) {
                return false;
            }
        }

        return true;
    }

    /**
     * 線分 (x1,z1)→(x2,z2) が点 (px,pz) から radius 以内を通過するか判定する。
     * 自滅防止チェックに使用する。
     */
    private _segmentPassesNear(
        x1: number, z1: number,
        x2: number, z2: number,
        px: number, pz: number,
        radius: number,
    ): boolean {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const lenSq = dx * dx + dz * dz;
        const t = lenSq < 1e-12
            ? 0
            : Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / lenSq));
        const ex = x1 + t * dx - px;
        const ez = z1 + t * dz - pz;
        return ex * ex + ez * ez < radius * radius;
    }

    /**
     * 線分 (x1,z1) → (x2,z2) が shellBlocker セルを通過しないか確認する。
     * セルサイズの 40% 間隔でサンプリングして判定する。
     */
    private _segmentClear(
        x1: number, z1: number,
        x2: number, z2: number,
        blocked: boolean[][],
        rows: number, cols: number, cellSize: number,
        shellRadius: number,
    ): boolean {
        const dx  = x2 - x1;
        const dz  = z2 - z1;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len < 1e-9) return true;

        const steps = Math.max(Math.ceil(len / (cellSize * 0.4)), 2);
        for (let i = 0; i <= steps; i++) {
            const t  = i / steps;
            const cx = x1 + t * dx;
            const cz = z1 + t * dz;

            // 弾の断面（shellRadius）が重なりうるセル範囲を検査
            const colMin = Math.floor((cx - shellRadius) / cellSize);
            const colMax = Math.floor((cx + shellRadius) / cellSize);
            const rowMin = Math.floor((cz - shellRadius) / cellSize);
            const rowMax = Math.floor((cz + shellRadius) / cellSize);

            for (let r = rowMin; r <= rowMax; r++) {
                for (let c = colMin; c <= colMax; c++) {
                    if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
                    if (blocked[r][c]) return false;
                }
            }
        }

        return true;
    }
}