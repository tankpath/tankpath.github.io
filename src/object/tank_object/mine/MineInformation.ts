import { MINE_STATS, type MineStats, type MineType } from "../../../Definition/MineDefinition";

export class MineInformation {
    readonly id: string;
    readonly type: MineType;
    readonly stats: MineStats;
    
    constructor(id: string, type: MineType) {
        this.id = id;
        this.type = type;
        this.stats = MINE_STATS[type];
    }
}