import { ChangeSceneEffect } from '../../Definition/SceneEffect';
import { SceneId } from '../../Definition/SceneId';
import { SceneChangeAction } from '../../types/btn/SceneChange';
import { ResultManager } from '../../managers/ResultManager';
import { ProfileManager } from '../../managers/ProfileManager';
import { isPlayerType } from '../../Definition/TankDefinition';
import { saveAnalyzers } from '../../Analyze/AnalyzerStorage';
import type { IScene } from '../IScene';
import './missionComplete.css';
import { StageCreationManager } from '../../managers/StageCreationManager';

const CONFETTI_COLORS = [
    '#FFD700', '#FF69B4', '#00E676', '#FF8C00',
    '#5BBCE8', '#FFFFFF', '#FF4081', '#B2FF59',
];
const CONFETTI_COUNT = 120;

interface ConfettiPiece {
    x: number; y: number;
    w: number; h: number;
    vx: number; vy: number;
    rot: number; rotSpeed: number;
    color: string;
    gravity: number;
    launched: boolean; // true = 発射フェーズ, false = 落下フェーズ
}

export class MissionComplete implements IScene {
    private container: HTMLElement | null = null;
    private animFrameId: number | null = null;
    private pieces: ConfettiPiece[] = [];

    public mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = '';
        this.render();
        this.bindButtons();
        this.drawAvatar();
        this.startConfetti();
    }

    private render(): void {
        if (!this.container) return;

        const ms    = ResultManager.instance.totalElapsedMs;
        const total = Math.floor(ms / 1000);
        const mm    = Math.floor(total / 60).toString().padStart(2, '0');
        const ss    = (total % 60).toString().padStart(2, '0');
        const kills = ResultManager.instance.records.filter(
            r => !isPlayerType(r.victimType),
        ).length;

        const profile  = ProfileManager.instance;
        const nickname = profile.nickname;
        const title    = profile.getDisplayTitle();

        this.container.innerHTML = `
        <div class="mc-scene">
            <canvas class="mc-confetti"></canvas>
            <div class="mc-scanbeam"></div>
            <div class="mc-corner mc-corner--tl"></div>
            <div class="mc-corner mc-corner--tr"></div>
            <div class="mc-corner mc-corner--bl"></div>
            <div class="mc-corner mc-corner--br"></div>

            <div class="mc-body">
                <div class="mc-title">MISSION COMPLETE!!</div>

                <div class="mc-player-card">
                    <div class="mc-avatar-wrap">
                        <canvas class="mc-avatar-canvas" width="64" height="64"></canvas>
                    </div>
                    <div class="mc-player-info">
                        <div class="mc-player-title-text">${title}</div>
                        <div class="mc-player-name">${nickname}</div>
                    </div>
                </div>

                <div class="mc-divider">FINAL RECORD</div>
                <div class="mc-stats">
                    <div class="mc-stat-row">
                        <span class="mc-stat-label">TOTAL TIME</span>
                        <span class="mc-stat-value">${mm}:${ss}</span>
                    </div>
                    <div class="mc-stat-row">
                        <span class="mc-stat-label">TOTAL KILLS</span>
                        <span class="mc-stat-value">${kills}</span>
                    </div>
                </div>

                <div class="mc-actions">
                    <button class="mc-btn" id="mc-back-btn">TITLE</button>
                </div>
            </div>
        </div>`;
    }

    private drawAvatar(): void {
        const canvas = this.container?.querySelector<HTMLCanvasElement>('.mc-avatar-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const profile = ProfileManager.instance;
        let data: string[] | null = null;
        let gridSize = 8;

        for (const g of [32, 16, 8] as const) {
            const d = profile.loadAvatar(g);
            if (d) { data = d; gridSize = g; break; }
        }

        if (!data) {
            ctx.fillStyle = 'rgba(56,123,148,0.3)';
            ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#387B94';
            ctx.lineWidth = 2;
            ctx.strokeRect(1, 1, 62, 62);
            return;
        }

        const scale = 64 / gridSize;
        ctx.clearRect(0, 0, 64, 64);
        data.forEach((color, i) => {
            if (!color) return;
            ctx.fillStyle = color;
            ctx.fillRect((i % gridSize) * scale, Math.floor(i / gridSize) * scale, scale, scale);
        });
    }

    private startConfetti(): void {
        const scene  = this.container?.querySelector<HTMLElement>('.mc-scene');
        const canvas = this.container?.querySelector<HTMLCanvasElement>('.mc-confetti');
        if (!scene || !canvas) return;

        const W = scene.offsetWidth  || 600;
        const H = scene.offsetHeight || 800;
        canvas.width  = W;
        canvas.height = H;

        const randomColor = () => CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
        const randomSize  = () => ({ w: 6 + Math.random() * 8, h: 10 + Math.random() * 10 });

        const half = Math.floor(CONFETTI_COUNT / 2);

        // 左下から右上方向に扇状に発射 (30°〜80°)
        const leftPieces: ConfettiPiece[] = Array.from({ length: half }, () => {
            const angle = Math.PI / 6 + Math.random() * (Math.PI * 5 / 18);
            const speed = 15 + Math.random() * 12;
            const { w, h } = randomSize();
            return {
                x: Math.random() * W * 0.08, y: H,
                w, h,
                vx: speed * Math.cos(angle),
                vy: -speed * Math.sin(angle),
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.2,
                color: randomColor(),
                gravity: 0.35 + Math.random() * 0.15,
                launched: true,
            };
        });

        // 右下から左上方向に扇状に発射 (100°〜150°)
        const rightPieces: ConfettiPiece[] = Array.from({ length: CONFETTI_COUNT - half }, () => {
            const angle = Math.PI * 5 / 9 + Math.random() * (Math.PI * 5 / 18);
            const speed = 15 + Math.random() * 12;
            const { w, h } = randomSize();
            return {
                x: W - Math.random() * W * 0.08, y: H,
                w, h,
                vx: speed * Math.cos(angle),
                vy: -speed * Math.sin(angle),
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.2,
                color: randomColor(),
                gravity: 0.35 + Math.random() * 0.15,
                launched: true,
            };
        });

        this.pieces = [...leftPieces, ...rightPieces];

        const ctx = canvas.getContext('2d')!;

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const p of this.pieces) {
                if (p.launched) {
                    p.vy += p.gravity;
                    p.x  += p.vx;
                    p.y  += p.vy;
                    // 画面外に出たら落下フェーズへ移行
                    if (p.y > canvas.height + 20 || p.x < -60 || p.x > canvas.width + 60) {
                        p.launched  = false;
                        p.x         = Math.random() * canvas.width;
                        p.y         = -20 - Math.random() * canvas.height;
                        p.vx        = (Math.random() - 0.5) * 1.5;
                        p.vy        = 1.5 + Math.random() * 3;
                        p.gravity   = 0;
                    }
                } else {
                    p.x += p.vx;
                    p.y += p.vy;
                    if (p.y > canvas.height + 20) {
                        p.y = -20;
                        p.x = Math.random() * canvas.width;
                    }
                }
                p.rot += p.rotSpeed;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.fillStyle   = p.color;
                ctx.globalAlpha = 0.85;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            }
            this.animFrameId = requestAnimationFrame(animate);
        };
        this.animFrameId = requestAnimationFrame(animate);
    }

    private bindButtons(): void {
        this.container?.querySelector('#mc-back-btn')
            ?.addEventListener('click', async () => {
                await saveAnalyzers();
                ResultManager.instance.reset();
                StageCreationManager.instance.reset();
                new SceneChangeAction(SceneId.Title, ChangeSceneEffect.Fade).execute();
            });
    }

    public unmount(): void {
        if (this.animFrameId !== null) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        if (this.container) this.container.innerHTML = '';
    }
}
