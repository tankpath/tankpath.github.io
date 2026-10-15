import type { TankType } from '../Definition/TankDefinition';
import type { TankInformation } from '../object/tank/TankInfomation';
import type { ShellType } from '../Definition/ShellDefinition';
import type { MineType } from '../Definition/MineDefinition';

// 追加で時間の合計も

/** 破壊に使われた兵器の情報 */
export type AttackWeapon =
    | { kind: 'shell'; type: ShellType }
    | { kind: 'mine';  type: MineType  };

/** 1件の撃破記録 */
export interface KillRecord {
    /** 破壊されたタンクの型番 */
    victimType:   TankType;
    /** 破壊されたタンクのID */
    victimId:     string;
    /** 使用された兵器（弾または地雷） */
    weapon:       AttackWeapon;
    /** 攻撃したタンクの型番（分裂弾など所有者不明の場合は null） */
    attackerType: TankType | null;
    /** 攻撃したタンクのID（不明の場合は null） */
    attackerId:   string | null;
}

export class ResultManager {
    private static _instance: ResultManager;

    private _records: KillRecord[] = [];
    private _totalElapsedMs: number = 0;

    private constructor() {}

    public static get instance(): ResultManager {
        if (!this._instance) this._instance = new ResultManager();
        return this._instance;
    }

    /**
     * タンクが破壊されたときに呼ぶ。
     * @param victim       破壊されたタンクの情報
     * @param weapon       使用された兵器（弾または地雷）
     * @param attackerInfo 攻撃したタンクの情報（不明の場合は null）
     */
    public recordKill(
        victim:       TankInformation,
        weapon:       AttackWeapon,
        attackerInfo: TankInformation | null,
    ): void {
        this._records.push({
            victimType:   victim.type,
            victimId:     victim.id,
            weapon,
            attackerType: attackerInfo?.type ?? null,
            attackerId:   attackerInfo?.id   ?? null,
        });
    }

    /** ステージ終了時に経過時間（ミリ秒）を合計に加算する */
    public addElapsedMs(ms: number): void {
        this._totalElapsedMs += ms;
    }

    public get records(): readonly KillRecord[] { return this._records; }

    /** 全ステージの合計経過時間（ミリ秒） */
    public get totalElapsedMs(): number { return this._totalElapsedMs; }

    public reset(): void {
        this._records = [];
        this._totalElapsedMs = 0;
    }
}
