import type { Tank } from '../../../../object/tank/Tank';
import type { Shell } from '../../../../object/tank_object/shell/Shell';
import type { TurretBehavior } from '../Movement/TurretBehavior';
import type { ShootBehavior } from '../Weapon/ShootBehavior';

/**
 * 相殺射撃の管理クラス。
 * 照準リロードを無視して発砲するが、1発撃ったあとは3秒間で追加1発のみ許可。
 * 追加1発を撃った後、または3秒経過後、さらに3秒のクールダウンを経て再び利用可能になる。
 *
 * ステート遷移:
 *   READY → (発砲) → WAITING[3s, 追加1発可] → (追加発砲 or 3s経過)
 *     → COOLDOWN[3s] → READY
 */
type OffsetState = 'ready' | 'waiting' | 'cooldown';

export class OffsetFireHandler {
    private readonly _turretBehavior: TurretBehavior;
    private readonly _shootBehavior:  ShootBehavior;

    private _state:     OffsetState = 'ready';
    private _timer:     number      = 0;
    private _extraUsed: boolean     = false;

    constructor(turretBehavior: TurretBehavior, shootBehavior: ShootBehavior) {
        this._turretBehavior = turretBehavior;
        this._shootBehavior  = shootBehavior;
    }

    /** クールダウン中は通常射撃に制御を渡すべきなので、外部から確認できるようにする */
    get isCooldown(): boolean {
        return this._state === 'cooldown';
    }

    /** タイマーだけ進める（クールダウン中に通常射撃を許可しつつタイマーを消費するために使う） */
    tick(delta: number): void {
        this._tickTimer(delta);
    }

    update(tank: Tank, dangerShell: Shell, delta: number): void {
        this._tickTimer(delta);

        switch (this._state) {
            case 'ready':
                this._tryFire(tank, dangerShell, false);
                break;
            case 'waiting':
                if (!this._extraUsed) {
                    this._tryFire(tank, dangerShell, true);
                }
                break;
            case 'cooldown':
                break;
        }
    }

    private _tryFire(tank: Tank, shell: Shell, isExtra: boolean): void {
        // 照準リロードを無視し、弾の現在位置へ直接照準
        const target = shell.object.position;
        this._turretBehavior.aimAt(tank, target);
        if (!this._turretBehavior.isAligned(tank, target)) return;

        this._shootBehavior.tryShoot(tank, target);

        if (isExtra) {
            // 追加弾を撃った → 3秒クールダウン
            this._extraUsed = true;
            this._state     = 'cooldown';
            this._timer     = 3.0;
        } else {
            // 初弾を撃った → 3秒ウィンドウ（追加1発可）
            this._extraUsed = false;
            this._state     = 'waiting';
            this._timer     = 3.0;
        }
    }

    private _tickTimer(delta: number): void {
        if (this._state === 'waiting' || this._state === 'cooldown') {
            this._timer = Math.max(0, this._timer - delta);
            if (this._timer <= 0) {
                this._state     = 'ready';
                this._extraUsed = false;
            }
        }
    }
}
