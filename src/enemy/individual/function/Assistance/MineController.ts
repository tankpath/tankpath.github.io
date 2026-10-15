import type { Tank } from '../../../../object/tank/Tank';
import type { MinePlacementDecision } from '../Decision/DecisionTypes';
import type { MinePlacementPattern } from '../../../../Definition/MineDefinition';
import { MineBehavior } from '../Weapon/MineBehavior';

export class MineController {
    private _elapsedSinceLastPlace: number;
    private readonly _cooldown:     number;
    private readonly _mineBehavior: MineBehavior;

    get elapsedSinceLastPlace(): number { return this._elapsedSinceLastPlace; }
    get cooldown():              number { return this._cooldown; }

    constructor(mineBehavior: MineBehavior, pattern: MinePlacementPattern) {
        this._mineBehavior          = mineBehavior;
        this._cooldown              = MineController._randomCooldown(pattern);
        this._elapsedSinceLastPlace = Math.random() * this._cooldown;
    }

    execute(tank: Tank, decisionMine: MinePlacementDecision | null, delta: number): void {
        this._elapsedSinceLastPlace += delta;
        if (!decisionMine?.shouldPlace) return;
        if (this._elapsedSinceLastPlace < this._cooldown) return;
        if (Math.random() >= 0.4) return;
        const before = tank.minePlacer.remainingMines;
        this._mineBehavior.tryPlace(tank);
        if (tank.minePlacer.remainingMines < before) {
            this._elapsedSinceLastPlace = 0;
        }
    }

    /** パターンごとにランダムなクールダウン（秒）を返す */
    private static _randomCooldown(pattern: MinePlacementPattern): number {
        switch (pattern) {
            case 'positive': return  2 + Math.random() *  3;  // 2〜5秒
            case 'negative': return 25 + Math.random() * 10;  // 25〜35秒
            case 'passage':  return  5 + Math.random() *  5;  // 5〜10秒
        }
    }
}
