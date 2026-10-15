export type PixelTool = 'pencil' | 'eraser' | 'fill';
export type GridSize  = 8 | 16 | 32;

import { t } from '../../i18n/i18n';

/** プリセット20色パレット */
export const PALETTE: readonly string[] = [
    // スキン
    '#FFCBA4', '#F0A878', '#C07040', '#7A3818',
    // 髪
    '#1A0A00', '#5C3010', '#B07030', '#F0E098',
    // 目・アクセント
    '#4878C8', '#38A858', '#C84828', '#D8A0A0',
    // ゲームテーマ色
    '#132727', '#387B94', '#5BBCE8', '#D8F5FB',
    // 基本
    '#E05070', '#E0C020', '#F0F0F0', '#080808',
] as const;

/** 内部キャンバス: 1グリッドセル = 14px */
const CELL = 14;

export class PixelEditor {
    private canvas:  HTMLCanvasElement;
    private overlay: HTMLCanvasElement;
    private ctx:        CanvasRenderingContext2D;
    private overlayCtx: CanvasRenderingContext2D;

    private pixels: string[];        // grid*grid 個。空文字 = 透明
    private selectedColor = PALETTE[0];
    private tool: PixelTool = 'pencil';
    private isDrawing      = false;
    private isRightErasing = false;

    private readonly boundMouseUp: (e: MouseEvent) => void;
    private readonly container: HTMLElement;
    private readonly grid: GridSize;
    private readonly onChange?: () => void;

    /**
     * @param container    描画先要素
     * @param gridSize     グリッドサイズ（8 / 16 / 32）
     * @param onChange     描画終了時コールバック
     * @param initialData  保存済みピクセルデータ（gridSize² 要素）
     */
    constructor(
        container:   HTMLElement,
        gridSize:    GridSize = 32,
        onChange?:   () => void,
        initialData?: string[],
    ) {
        this.container = container;
        this.grid      = gridSize;
        this.onChange  = onChange;

        const total = gridSize * gridSize;
        this.pixels = (initialData?.length === total)
            ? [...initialData]
            : new Array(total).fill('');

        this.boundMouseUp = (e: MouseEvent) => {
            if (e.button === 2) this.isRightErasing = false;
            if (!(e.buttons & 3) && this.isDrawing) {
                this.isDrawing = false;
                this.onChange?.();
            }
        };

        container.innerHTML = this.buildHTML();

        this.canvas  = container.querySelector<HTMLCanvasElement>('.pe-canvas')!;
        this.overlay = container.querySelector<HTMLCanvasElement>('.pe-overlay')!;
        this.ctx        = this.canvas.getContext('2d')!;
        this.overlayCtx = this.overlay.getContext('2d')!;

        const size = this.grid * CELL;
        this.canvas.width  = this.overlay.width  = size;
        this.canvas.height = this.overlay.height = size;

        this.renderGrid();
        this.redrawAll();
        this.setupEvents();
    }

    getData(): string[] { return [...this.pixels]; }

    destroy(): void {
        window.removeEventListener('mouseup', this.boundMouseUp);
    }

    // ----------------------------------------
    // DOM 生成
    // ----------------------------------------

    private buildHTML(): string {
        // 左クリック：左ボタン塗り
        const mouseLeft = `<svg class="pe-mouse-icon" viewBox="0 0 14 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M1,7.5 A5.5,5.5 0 0,1 6.5,2 L7,2 L7,9 L1,9 Z" fill="currentColor"/><rect x="1" y="2" width="12" height="17" rx="5.5" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="7" y1="2" x2="7" y2="9" stroke="currentColor" stroke-width="1"/><line x1="1" y1="9" x2="13" y2="9" stroke="currentColor" stroke-width="1"/></svg>`;
        // 右クリック：右ボタン塗り
        const mouseRight = `<svg class="pe-mouse-icon" viewBox="0 0 14 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M7,2 L7.5,2 A5.5,5.5 0 0,1 13,7.5 L13,9 L7,9 Z" fill="currentColor"/><rect x="1" y="2" width="12" height="17" rx="5.5" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="7" y1="2" x2="7" y2="9" stroke="currentColor" stroke-width="1"/><line x1="1" y1="9" x2="13" y2="9" stroke="currentColor" stroke-width="1"/></svg>`;

        const swatches = PALETTE.map((c, i) => `
            <button
                class="pe-swatch${i === 0 ? ' pe-swatch--active' : ''}"
                data-color="${c}"
                style="background:${c}"
                title="${c}"
            ></button>
        `).join('');

        return `
            <div class="pe-wrap">
                <div class="pe-editor-col">
                    <div class="pe-toolbar">
                        <div class="pe-tools">
                            <button class="pe-tool-btn pe-tool-btn--active" data-tool="pencil" title="${t('toolPencil')}">${mouseLeft}PEN</button>
                            <button class="pe-tool-btn" data-tool="eraser"  title="${t('toolEraser')}">${mouseRight}ERS</button>
                            <button class="pe-tool-btn" data-tool="fill"    title="${t('toolFill')}">${mouseLeft}FILL</button>
                        </div>
                        <button class="pe-clear-btn" title="${t('toolClear')}">CLEAR</button>
                    </div>

                    <div class="pe-canvas-area">
                        <div class="pe-canvas-container">
                            <canvas class="pe-canvas"></canvas>
                            <canvas class="pe-overlay"></canvas>
                        </div>
                    </div>
                </div>

                <div class="pe-palette">
                    ${swatches}
                    <label class="pe-color-picker-wrap" title="${t('customColor')}">
                        <input type="color" class="pe-color-picker" value="#FFFFFF">
                        <span class="pe-color-picker-icon">＋</span>
                    </label>
                </div>
            </div>
        `;
    }

    // ----------------------------------------
    // 描画ロジック
    // ----------------------------------------

    private renderGrid(): void {
        const g    = this.grid;
        const ctx  = this.overlayCtx;
        const size = g * CELL;
        ctx.clearRect(0, 0, size, size);
        ctx.strokeStyle = 'rgba(56,123,148,0.35)';
        ctx.lineWidth   = 0.5;
        for (let i = 0; i <= g; i++) {
            ctx.beginPath(); ctx.moveTo(i * CELL, 0);    ctx.lineTo(i * CELL, size); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i * CELL);    ctx.lineTo(size, i * CELL); ctx.stroke();
        }
    }

    private redrawAll(): void {
        const g   = this.grid;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, g * CELL, g * CELL);
        this.pixels.forEach((color, i) => {
            if (!color) return;
            ctx.fillStyle = color;
            ctx.fillRect((i % g) * CELL, Math.floor(i / g) * CELL, CELL, CELL);
        });
    }

    private isErasing(): boolean {
        return this.tool === 'eraser' || this.isRightErasing;
    }

    private selectTool(tool: PixelTool): void {
        this.tool = tool;
        this.container.querySelectorAll('.pe-tool-btn').forEach(b => b.classList.remove('pe-tool-btn--active'));
        this.container.querySelector<HTMLButtonElement>(`.pe-tool-btn[data-tool="${tool}"]`)?.classList.add('pe-tool-btn--active');
    }

    private drawPixel(col: number, row: number): void {
        const g = this.grid;
        if (col < 0 || col >= g || row < 0 || row >= g) return;
        const idx   = row * g + col;
        const color = this.isErasing() ? '' : this.selectedColor;
        if (this.pixels[idx] === color) return;
        this.pixels[idx] = color;
        if (color) {
            this.ctx.fillStyle = color;
            this.ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
        } else {
            this.ctx.clearRect(col * CELL, row * CELL, CELL, CELL);
        }
    }

    private floodFill(col: number, row: number): void {
        const g        = this.grid;
        const startIdx = row * g + col;
        const target   = this.pixels[startIdx];
        const fill     = this.selectedColor;
        if (target === fill) return;

        const stack   = [startIdx];
        const visited = new Set<number>();
        while (stack.length) {
            const idx = stack.pop()!;
            if (visited.has(idx) || this.pixels[idx] !== target) continue;
            visited.add(idx);
            this.pixels[idx] = fill;
            const c = idx % g, r = Math.floor(idx / g);
            if (c > 0)      stack.push(idx - 1);
            if (c < g - 1)  stack.push(idx + 1);
            if (r > 0)      stack.push(idx - g);
            if (r < g - 1)  stack.push(idx + g);
        }
        this.redrawAll();
        this.onChange?.();
    }

    private getCell(clientX: number, clientY: number): [number, number] {
        const g      = this.grid;
        const rect   = this.overlay.getBoundingClientRect();
        const scaleX = (g * CELL) / rect.width;
        const scaleY = (g * CELL) / rect.height;
        return [
            Math.floor((clientX - rect.left) * scaleX / CELL),
            Math.floor((clientY - rect.top)  * scaleY / CELL),
        ];
    }

    // ----------------------------------------
    // イベント設定
    // ----------------------------------------

    private setupEvents(): void {
        const c = this.container;

        // ---- ツール選択 ----
        c.querySelectorAll<HTMLButtonElement>('.pe-tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.tool = btn.dataset.tool as PixelTool;
                c.querySelectorAll('.pe-tool-btn').forEach(b => b.classList.remove('pe-tool-btn--active'));
                btn.classList.add('pe-tool-btn--active');
            });
        });

        // ---- プリセットパレット ----
        c.querySelectorAll<HTMLButtonElement>('.pe-swatch').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setColor(btn.dataset.color!);
                c.querySelectorAll('.pe-swatch, .pe-color-picker-wrap').forEach(b => b.classList.remove('pe-swatch--active'));
                btn.classList.add('pe-swatch--active');
            });
        });

        // ---- カスタムカラーピッカー ----
        const picker     = c.querySelector<HTMLInputElement>('.pe-color-picker')!;
        const pickerWrap = c.querySelector<HTMLElement>('.pe-color-picker-wrap')!;
        picker.addEventListener('input', () => {
            this.setColor(picker.value);
            c.querySelectorAll('.pe-swatch').forEach(b => b.classList.remove('pe-swatch--active'));
            pickerWrap.classList.add('pe-swatch--active');
            const icon = c.querySelector<HTMLElement>('.pe-color-picker-icon')!;
            icon.style.background = picker.value;
        });

        // ---- CLEAR ----
        c.querySelector('.pe-clear-btn')?.addEventListener('click', () => {
            this.pixels.fill('');
            this.redrawAll();
            this.onChange?.();
        });

        // ---- 右クリックメニュー抑止 ----
        this.overlay.addEventListener('contextmenu', (e) => e.preventDefault());

        // ---- マウス ----
        this.overlay.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (e.button === 2) {
                this.selectTool('eraser');
                this.isRightErasing = true;
                this.isDrawing = true;
                const [col, row] = this.getCell(e.clientX, e.clientY);
                this.drawPixel(col, row);
            } else if (e.button === 0) {
                if (this.tool !== 'fill') this.selectTool('pencil');
                this.isDrawing = true;
                const [col, row] = this.getCell(e.clientX, e.clientY);
                if (this.tool === 'fill') this.floodFill(col, row);
                else                      this.drawPixel(col, row);
            }
        });

        this.overlay.addEventListener('mousemove', (e) => {
            if (!this.isDrawing || (this.tool === 'fill' && !this.isRightErasing)) return;
            const [col, row] = this.getCell(e.clientX, e.clientY);
            this.drawPixel(col, row);
        });

        window.addEventListener('mouseup', this.boundMouseUp);

        // ---- タッチ ----
        this.overlay.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.isDrawing = true;
            const t = e.touches[0];
            const [col, row] = this.getCell(t.clientX, t.clientY);
            if (this.tool === 'fill') this.floodFill(col, row);
            else                      this.drawPixel(col, row);
        }, { passive: false });

        this.overlay.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!this.isDrawing || (this.tool === 'fill' && !this.isRightErasing)) return;
            const t = e.touches[0];
            const [col, row] = this.getCell(t.clientX, t.clientY);
            this.drawPixel(col, row);
        }, { passive: false });

        this.overlay.addEventListener('touchend', () => {
            this.isDrawing = false;
            this.onChange?.();
        });
    }

    // ----------------------------------------
    // ヘルパー
    // ----------------------------------------

    private setColor(color: string): void {
        this.selectedColor = color;
        if (this.tool === 'eraser') {
            this.tool = 'pencil';
            const c = this.container;
            c.querySelectorAll('.pe-tool-btn').forEach(b => b.classList.remove('pe-tool-btn--active'));
            c.querySelector('[data-tool="pencil"]')?.classList.add('pe-tool-btn--active');
        }
    }
}
