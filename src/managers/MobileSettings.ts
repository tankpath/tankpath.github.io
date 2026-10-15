export interface MobileSettings {
    orientation: 'landscape' | 'portrait';
    bt_shell:    boolean;
    bt_mine:     boolean;
    bt_enemy:    boolean;
    bt_remain:   boolean;
    /** ジョイスティック中心 X (バトル画面幅に対する %) */
    stick_x: number;
    /** ジョイスティック中心 Y (バトル画面高さに対する %) */
    stick_y: number;
    /** 地雷ボタン中心 X (%) */
    mine_x: number;
    /** 地雷ボタン中心 Y (%) */
    mine_y: number;
    /** ジョイスティックサイズ倍率 (0.7 〜 1.5) */
    stick_size: number;
    /** 地雷ボタンサイズ倍率 (0.7 〜 1.5) */
    mine_size: number;

    // ── 縦向き専用 ──────────────────────────────────────────
    pt_bt_shell:   boolean;
    pt_bt_mine:    boolean;
    pt_bt_enemy:   boolean;
    pt_bt_remain:  boolean;
    /** 縦向き: ジョイスティック中心 X (%) */
    pt_stick_x:    number;
    /** 縦向き: ジョイスティック中心 Y (%) — 画面下半分に配置 */
    pt_stick_y:    number;
    /** 縦向き: 地雷ボタン中心 X (%) */
    pt_mine_x:     number;
    /** 縦向き: 地雷ボタン中心 Y (%) */
    pt_mine_y:     number;
    /** 縦向き: ジョイスティックサイズ倍率 (0.7 〜 1.5) */
    pt_stick_size: number;
    /** 縦向き: 地雷ボタンサイズ倍率 (0.7 〜 1.5) */
    pt_mine_size:  number;
}

const DEFAULTS: MobileSettings = {
    orientation: 'landscape',
    bt_shell:    true,
    bt_mine:     true,
    bt_enemy:    true,
    bt_remain:   false,
    stick_x:   13,
    stick_y:   78,
    mine_x:    87,
    mine_y:    78,
    stick_size: 1.0,
    mine_size:  1.0,

    pt_bt_shell:   true,
    pt_bt_mine:    true,
    pt_bt_enemy:   true,
    pt_bt_remain:  true,
    pt_stick_x:    50,
    pt_stick_y:    72,
    pt_mine_x:     50,
    pt_mine_y:     87,
    pt_stick_size: 1.0,
    pt_mine_size:  1.0,
};

export function getMobileSettings(): MobileSettings {
    try {
        const raw = JSON.parse(localStorage.getItem('tankpath-settings-mobile') ?? '{}');
        return { ...DEFAULTS, ...raw };
    } catch {
        return { ...DEFAULTS };
    }
}
