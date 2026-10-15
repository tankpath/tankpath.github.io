import * as THREE from 'three';

/** 1セルあたりのキャンバスピクセル数 */
export const FOOTPRINT_PIXELS_PER_CELL = 32;

// ─── スタンプパラメータ（セル単位） ───────────────────────
const STEP_CELLS          = 0.2;   // スタンプ間隔（セル）
const TRACK_OFFSET_CELLS  = 0.22;  // 中心からの左右オフセット
const TRACK_W_CELLS       = 0.12;  // 履帯スタンプの幅
const TRACK_H_CELLS       = 0.16;  // 履帯スタンプの高さ（進行方向）
const STAMP_ALPHA         = 0.13;   // 1スタンプあたりの不透明度
const ERASE_ALPHA         = 0.20;   // 描画前に既存の不透明度を消去する割合（蓄積上限を制御）
const TRACK_COLOR         = `rgba(150, 182, 182, ${STAMP_ALPHA})`;

export class FootPrint {
    private readonly ctx:     CanvasRenderingContext2D;
    private readonly texture: THREE.CanvasTexture;
    private readonly ppc:     number; // pixels per cell

    private lastPos:  THREE.Vector2 | null = null;
    private traveled: number = 0;
    private readonly _cur = new THREE.Vector2();

    /**
     * @param ctx      地面キャンバスの 2D コンテキスト
     * @param texture  同キャンバスから作成した CanvasTexture
     * @param pixelsPerCell  1セルあたりのピクセル数（FOOTPRINT_PIXELS_PER_CELL と同値）
     */
    constructor(
        ctx: CanvasRenderingContext2D,
        texture: THREE.CanvasTexture,
        pixelsPerCell: number = FOOTPRINT_PIXELS_PER_CELL,
    ) {
        this.ctx     = ctx;
        this.texture = texture;
        this.ppc     = pixelsPerCell;
    }

    /**
     * 毎フレーム呼ぶ。0.2セル以上移動するたびに履帯スタンプを描く。
     * @param position  タンクのワールド座標（XZ が水平面）
     * @param rotationY タンクの Y 軸回転（ラジアン）
     */
    update(position: THREE.Vector3, rotationY: number): void {
        this._cur.set(position.x, position.z);

        if (this.lastPos === null) {
            this.lastPos = this._cur.clone();
            return;
        }

        const dist = this._cur.distanceTo(this.lastPos);
        this.traveled += dist;
        this.lastPos.copy(this._cur);

        if (this.traveled >= STEP_CELLS) {
            this.traveled -= STEP_CELLS;
            this.stamp(this._cur, rotationY);
        }
    }

    private stamp(pos: THREE.Vector2, rotationY: number): void {
        const ppc = this.ppc;
        const px  = pos.x * ppc;
        const py  = pos.y * ppc;

        const offset = TRACK_OFFSET_CELLS * ppc;
        const tw     = TRACK_W_CELLS      * ppc;
        const th     = TRACK_H_CELLS      * ppc;

        const ctx = this.ctx;
        ctx.save();
        ctx.translate(px, py);
        // Three.js Y回転（右手系）→ Canvas回転（左手系・Y下向き）は符号反転
        ctx.rotate(-rotationY);

        // 既存スタンプを少し消去して蓄積上限を設ける（Bloom 抑制）
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = `rgba(0,0,0,${ERASE_ALPHA})`;
        ctx.fillRect(-offset - tw / 2, -th / 2, tw, th);
        ctx.fillRect( offset - tw / 2, -th / 2, tw, th);

        // 新しいスタンプを重ねる
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = TRACK_COLOR;
        ctx.fillRect(-offset - tw / 2, -th / 2, tw, th);
        ctx.fillRect( offset - tw / 2, -th / 2, tw, th);

        ctx.restore();

        this.texture.needsUpdate = true;
    }
}
