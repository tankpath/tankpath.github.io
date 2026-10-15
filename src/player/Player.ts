import type { Tank } from '../object/tank/Tank';
import type { InputSource } from './input/InputSource';
import { TankDriver } from '../operateTank/TankDriver';
import { SoundManager } from '../managers/SoundManager';

/**
 * プレイヤー操作クラス。
 * 入力状態を TankDriver に渡してタンクを操縦する。
 */
export class Player {
    private readonly tank: Tank;
    private readonly driver: TankDriver;
    private readonly input: InputSource;
    private animationId: number | null = null;
    private lastTime: number | null = null;
    private turretOnly = false;

    constructor(tank: Tank, input: InputSource) {
        this.tank   = tank;
        this.driver = new TankDriver(tank);
        this.input  = input;
        this.input.setMineCallback(() => { if (!this.turretOnly) this.driver.placeMine(); });
        this.input.setShootCallback(() => { if (!this.turretOnly) this.driver.shoot(); });
    }

    /** true にすると砲塔追尾のみ有効（移動・発砲・地雷は無効） */
    setTurretOnly(enabled: boolean): void {
        this.turretOnly = enabled;
    }

    start(): void {
        this.animationId = requestAnimationFrame(this.loop);
    }

    /** ポーズ（true）/ 再開（false）を切り替える */
    setPaused(paused: boolean): void {
        if (paused) {
            if (this.animationId !== null) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
        } else if (this.animationId === null) {
            this.lastTime    = null; // delta スパイク防止
            this.animationId = requestAnimationFrame(this.loop);
        }
    }

    dispose(): void {
        SoundManager.instance.notifyMoving(this.tank.info.id, false);
        this.input.dispose();
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    // ─── ゲームループ ─────────────────────────────────────────────────

    private readonly loop = (now: number): void => {
        if (!this.tank.isAlive) {
            this.dispose();
            return;
        }

        const delta = this.lastTime !== null ? (now - this.lastTime) / 1000 : 0;
        this.lastTime = now;

        const { dx, dz, aimTarget } = this.input.getState();
        if (!this.turretOnly) {
            this.driver.applyMovement(dx, dz, delta);
        }
        SoundManager.instance.notifyMoving(this.tank.info.id, this.tank.movement.consumeMovedFlag());
        this.driver.applyTurret(aimTarget);
        this.tank.update(delta);

        this.animationId = requestAnimationFrame(this.loop);
    };
}
