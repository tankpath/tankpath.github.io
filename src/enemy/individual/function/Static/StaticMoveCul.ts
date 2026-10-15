import * as THREE from 'three';
import type { Tank } from '../../../../object/tank/Tank';
import type { PlayerFacingDirection } from "../../../../Definition/PrerequisiteAI";

export type PlayerBehaviorMode = 'wait' | 'zigzag_retreat' | 'retreat' | 'zigzag_charge' | 'charge';

export class PlayerBehaviorSelector {

    /**
     * 検知時の初回抽選
     */
    static selectOnDetect(
        facingDir: PlayerFacingDirection | null
    ): { mode: PlayerBehaviorMode; waitTimer?: number } {

        const r = Math.random();

        switch (facingDir) {

            case 'vertical':
                if (r < 0.20) {
                    return { mode: 'wait', waitTimer: 3 + Math.random() * 2 };
                }
                if (r < 0.40) return { mode: 'zigzag_retreat' };
                if (r < 0.60) return { mode: 'charge' };
                return { mode: 'retreat' };

            case 'horizontal':
                if (r < 0.20) {
                    return { mode: 'wait', waitTimer: 3 + Math.random() * 2 };
                }
                if (r < 0.40) return { mode: 'zigzag_charge' };
                if (r < 0.80) return { mode: 'charge' };
                return { mode: 'retreat' };

            case 'diagonal':
                return { mode: 'charge' };

            default:
                return { mode: 'wait', waitTimer: 3 + Math.random() * 2 };
        }
    }
    /**
     * 待機終了後の再抽選
     */
    static selectAfterWait(
        facingDir: PlayerFacingDirection | null
    ): PlayerBehaviorMode {

        const r = Math.random();

        switch (facingDir) {

            case 'vertical':
                if (r < 0.25) return 'zigzag_retreat';
                if (r < 0.50) return 'charge';
                return 'retreat';

            case 'horizontal':
                if (r < 0.25) return 'zigzag_charge';
                if (r < 0.75) return 'charge';
                return 'retreat';

            default:
                return 'wait';
        }
    }

    /** スタック時の回避移動 */
    static handleStuck(tank: Tank, delta: number): void {
        const offsets = [Math.PI / 2, -Math.PI / 2, Math.PI] as const;
        const angle   = tank.movement.rotationY + offsets[Math.floor(Math.random() * offsets.length)];
        tank.movement.setRotation(angle);
        tank.movement.move(new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)), delta);
    }

    /**
     * 接触している敵タンク群から離れる方向へ押し出す（分離ステアリング）。
     * 各タンクとの中心間ベクトルを合算して正規化した方向へ移動する。
     */
    static separationPush(tank: Tank, others: Tank[], delta: number): void {
        const pos  = tank.movement.position;
        let pushX  = 0;
        let pushZ  = 0;

        for (const other of others) {
            const op   = other.movement.position;
            const dx   = pos.x - op.x;
            const dz   = pos.z - op.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 1e-9) continue;
            pushX += dx / dist;
            pushZ += dz / dist;
        }

        const len = Math.sqrt(pushX * pushX + pushZ * pushZ);
        if (len < 1e-9) return;

        const direction = new THREE.Vector3(pushX / len, 0, pushZ / len);
        tank.movement.setRotation(Math.atan2(direction.x, direction.z));
        tank.movement.move(direction, delta);
    }
}

