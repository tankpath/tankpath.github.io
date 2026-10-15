import { CUBE_STATS, type CubeStats, type CubeType } from "../../Definition/CubeDefinition";


export class CubeInformation {
    readonly id: string;
    readonly type: CubeType;
    readonly stats: CubeStats;

    constructor(id: string, type: CubeType) {
        this.id = id;
        this.type = type;
        this.stats = CUBE_STATS[type];
    }
}