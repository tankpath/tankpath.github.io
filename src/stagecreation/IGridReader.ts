import type { GridData } from "../Definition/StageDefinition";

export interface IGridReader {
    read(): GridData;
}
// グリッドの読み取るための契約