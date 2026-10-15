// 簡易版の反射計算（反射回数 1 回固定）
/** もらうもの　＝＞　自タンクの位置情報、対象（プレイヤー）の位置情報
 *  わたすもの　＝＞　[発砲位置]（砲塔回転のための）
 */

import * as THREE from 'three';
import type { BattleFieldConfig } from '../../../scene/battle/BattleField';

export class Simple_ReflectC {

    /**
     * 外壁に 1 回だけ反射してターゲットへ届く発砲位置を返す。
     *
     * アルゴリズム：鏡像法（1 回反射限定の簡易版）
     *   外壁 4 面それぞれについてターゲットの鏡像を作り、
     *   self → 鏡像 の直線が外壁と交わる点が「壁衝突点」になる。
     *   内部壁に遮られない最初の経路の衝突点を返す。
     *
     * @param self        自タンクのワールド座標
     * @param target      対象プレイヤータンクのワールド座標
     * @param config      フィールド設定
     * @param blocked     EnemyMaster が構築した shellBlocker グリッド（キャッシュ済み）
     * @param shellRadius 使用する弾の半径（経路チェック時の拡張量）
     * @returns 壁衝突点（砲塔をここへ向けると反射弾が target に到達する）、
     *          有効な経路がない場合は null
     */
    calculate(
        self: THREE.Vector3,
        target: THREE.Vector3,
        config: BattleFieldConfig,
        blocked: boolean[][],
        shellRadius: number,
        totalReflectCount: number = 1,
    ): THREE.Vector3 | null {
        const { rows, cols, cellSize } = config;
        const W = cols * cellSize;
        const H = rows * cellSize;

        // 外壁 4 面それぞれの「鏡像」を列挙（target を各壁で折り返した位置）
        const mirrors: Array<{ xi: number; zi: number }> = [
            { xi: 2 * W - target.x, zi: target.z },          // 右壁 (x = W)
            { xi: -target.x,        zi: target.z },          // 左壁 (x = 0)
            { xi: target.x,         zi: 2 * H - target.z },  // 下壁 (z = H)
            { xi: target.x,         zi: -target.z },         // 上壁 (z = 0)
        ];

        // 自滅防止：自タンク半径 + 弾半径 の合計距離を安全余裕として使用
        const safeRadius = shellRadius + cellSize * 0.5;

        for (const { xi, zi } of mirrors) {
            // self と鏡像を結ぶ直線が最初に当たる外壁の点を求める
            const hit = this._firstWallHit(self.x, self.z, xi, zi, W, H);
            if (!hit) continue;

            // self → 壁衝突点 → target の 2 区間が内部壁に遮られないか確認
            if (
                !this._segmentClear(self.x, self.z, hit.x, hit.z, blocked, rows, cols, cellSize, shellRadius) ||
                !this._segmentClear(hit.x, hit.z, target.x, target.z, blocked, rows, cols, cellSize, shellRadius) ||
                // 自滅防止：反射後区間（hit → target）が自タンクの近傍を通過しないか
                this._segmentPassesNear(hit.x, hit.z, target.x, target.z, self.x, self.z, safeRadius)
            ) continue;

            // 余剰反射（totalReflectCount > 1）で自滅しないか確認
            const extra = totalReflectCount - 1;
            if (extra > 0) {
                // ターゲット到達時の進行方向 = hit→target の正規化ベクトル
                const ddx = target.x - hit.x;
                const ddz = target.z - hit.z;
                const len = Math.sqrt(ddx * ddx + ddz * ddz);
                if (len > 1e-9) {
                    if (!this._extraBouncesAreSafe(
                        target.x, target.z, self.x, self.z,
                        ddx / len, ddz / len, extra, W, H, safeRadius,
                    )) continue;
                }
            }

            return new THREE.Vector3(hit.x, self.y, hit.z);
        }

        return null;
    }

    // ─── 余剰反射の自滅チェック ───────────────────────────────────────

    /** ターゲット到達後の余剰反射区間が自タンク近傍を通過しないか確認する（内部壁考慮なし・保守的） */
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

    /** 位置 (x,z) から方向 (dx,dz) に進んだとき最初に当たる外壁の衝突点を返す */
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

    // ─── 壁衝突点の計算 ─────────────────────────────────────────────────

    /**
     * 展開空間での直線 (sx,sz) → (xi,zi) における最初の外壁交差点を
     * 元の [0,W]×[0,H] 空間に折り返して返す。
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

    /** 展開座標 x を [0, L] に折り返す */
    private _fold(x: number, L: number): number {
        const twoL = 2 * L;
        const mod = ((x % twoL) + twoL) % twoL;
        return mod <= L ? mod : twoL - mod;
    }

    // ─── 経路チェック ────────────────────────────────────────────────────

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
     * 線分 (x1,z1)→(x2,z2) が shellBlocker セルを通過しないか確認する。
     * セルサイズの 40% 間隔でサンプリングし、各点から shellRadius 以内のセルも検査する。
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
