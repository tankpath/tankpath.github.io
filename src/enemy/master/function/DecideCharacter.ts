// 各エネミーへの性格を確率で割り当てる
// 確率はEnemyCharacterで決定してあるのを使う
// 回避＝０、相殺＝１
// 直撃＝０，反射＝１
// プレイヤーとの距離は[近,中,遠]の確率の重さ。nullの場合は移動なし

import { ENEMY_CHARACTERS } from '../../../Definition/EnemyCharacter';
import type { Aiming } from '../../../Definition/EnemyCharacter';
import type { EnemyType } from '../../../Definition/EnemyDefinition';

/** 発砲パターン（直撃：プレイヤーへ直接狙う / 反射：壁を使って狙う） */
export type ShotPattern = 'direct' | 'reflect';

/** プレイヤーとの距離の好み */
export type DistancePref = 'near' | 'mid' | 'far' | null;

/** DecideCharacter が決定した、この敵インスタンスの確定した性格 */
export interface ResolvedCharacter {
    /** 射撃方法 */
    shootingType: Aiming;
    /** 発砲パターン */
    shotPattern: ShotPattern;
    /** プレイヤーとの距離の好み（null = 移動しない） */
    distancePref: DistancePref;
}

export class DecideCharacter {

    /**
     * 敵タイプの性格定義（確率）をもとに、このインスタンスの性格を決定する。
     * @param type 敵の種別
     */
    static decide(type: EnemyType): ResolvedCharacter {
        const nature = ENEMY_CHARACTERS[type];
        return {
            shootingType: DecideCharacter.pickShootingType(nature.shootingType),
            shotPattern:  Math.random() < nature.shootingMethod ? 'reflect' : 'direct',
            distancePref: DecideCharacter.pickDistancePref(nature.fromPlayer),
        };
    }

    /**
     * [rapid, fan, counter, sniper] の重み付きランダムで射撃方法を選ぶ。
     */
    static pickShootingType(weights: [number, number, number, number]): Aiming {
        const types: Aiming[] = ['rapid', 'fan', 'counter', 'sniper'];
        const total = weights[0] + weights[1] + weights[2] + weights[3];
        const r = Math.random() * total;
        let cumulative = 0;
        for (let i = 0; i < types.length; i++) {
            cumulative += weights[i];
            if (r < cumulative) return types[i];
        }
        return types[types.length - 1];
    }

    /**
     * [近, 中, 遠] の重み付きランダムで距離の好みを選ぶ。
     * 合計が 0 の場合は移動なし（null）。
     */
    static pickDistancePref(weights: [number, number, number]): DistancePref {
        const total = weights[0] + weights[1] + weights[2];
        if (total === 0) return null;

        const r = Math.random() * total;
        if (r < weights[0]) return 'near';
        if (r < weights[0] + weights[1]) return 'mid';
        return 'far';
    }
}
