export interface CursorSettings {
    /** カーソルを表示するか */
    enabled: boolean;
    /** 表示サイズ (%) — 50〜200、デフォルト 100 */
    size: number;
    /** 色相回転 (deg) — 0〜360、デフォルト 0 */
    hue: number;
    /** 明るさ (%) — 50〜150、デフォルト 100 */
    brightness: number;
    /** カーソルと自タンクを結ぶラインを表示するか */
    lineEnabled: boolean;
}

const DEFAULTS: CursorSettings = {
    enabled:     true,
    size:        100,
    hue:         0,
    brightness:  100,
    lineEnabled: false,
};

export function getCursorSettings(): CursorSettings {
    try {
        const raw = JSON.parse(localStorage.getItem('tankpath-settings-cursor') ?? '{}');
        return { ...DEFAULTS, ...raw };
    } catch {
        return { ...DEFAULTS };
    }
}
