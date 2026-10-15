import { SHELL_STATS, type ShellStats, type ShellType } from "../../../Definition/ShellDefinition";

export class ShellInformation {
    readonly id: string;
    readonly type: ShellType;
    readonly stats: ShellStats;

    constructor(id: string, type: ShellType) {
        this.id = id;
        this.type = type;
        this.stats = SHELL_STATS[type];
    }
}