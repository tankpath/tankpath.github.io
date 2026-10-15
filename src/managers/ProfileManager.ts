import { t } from '../i18n/i18n';

/** 称号定義 */
export interface TitleDef {
    id: string;
    /** 表示ラベル */
    label: string;
    /** 解禁に必要なクリアステージ数（0 = 最初から使用可） */
    requiredStage: number;
}

/** ユーザーが選択できる称号一覧。
 *  将来的に requiredStage を参照して解禁判定する。 */
export const TITLE_DEFINITIONS: readonly TitleDef[] = [
    { id: 'rookie',      label: 'Loyal Retainer', requiredStage: 0   },
    { id: 'corporal',    label: 'Mutineer',       requiredStage: 5   },
    { id: 'sergeant',    label: 'Madman',         requiredStage: 10  },
    { id: 'lieutenant',  label: 'Butcher',        requiredStage: 20  },
    { id: 'captain',     label: 'Traitor',        requiredStage: 35  },
    { id: 'major',       label: 'Fugitive',       requiredStage: 50  },
    { id: 'colonel',     label: 'Rebel',          requiredStage: 70  },
    { id: 'general',     label: 'Hero',           requiredStage: 100 },
    { id: 'custom',      label: 'Custom',         requiredStage: 0   },
] as const;

const KEY_NICKNAME     = 'tankpath_nickname';
const KEY_TITLE_ID     = 'tankpath_title_id';
const KEY_CUSTOM_TITLE = 'tankpath_custom_title';
const KEY_CLEARED      = 'tankpath_cleared_stages';
const KEY_AVATAR       = 'tankpath_avatar';

export class ProfileManager {
    private static _instance: ProfileManager;

    private _nickname:    string = 'COMMANDER';
    private _titleId:     string = 'rookie';
    private _customTitle: string = '';

    private constructor() {
        this._load();
    }

    public static get instance(): ProfileManager {
        if (!this._instance) this._instance = new ProfileManager();
        return this._instance;
    }

    get nickname():    string { return this._nickname; }
    get titleId():     string { return this._titleId; }
    get customTitle(): string { return this._customTitle; }

    /** 画面に表示する称号文字列 */
    getDisplayTitle(): string {
        if (this._titleId === 'custom') {
            return this._customTitle.trim() || '---';
        }
        const key = ('title' + this._titleId.charAt(0).toUpperCase() + this._titleId.slice(1)) as Parameters<typeof t>[0];
        return t(key) ?? t('titleRookie');
    }

    /** クリア済みステージ数を返す */
    getClearedStages(): number {
        return parseInt(localStorage.getItem(KEY_CLEARED) ?? '0', 10);
    }

    /** クリア済みステージ数を localStorage へ保存する（AnalyzerStorage から呼ぶ） */
    setClearedStages(n: number): void {
        localStorage.setItem(KEY_CLEARED, String(n));
    }

    /** クリア済みステージ数に基づいて解禁済み称号 ID の集合を返す */
    getUnlockedIds(): Set<string> {
        const cleared = this.getClearedStages();
        return new Set(
            TITLE_DEFINITIONS
                .filter(t => t.requiredStage <= cleared)
                .map(t => t.id)
        );
    }

    /** アバターのピクセルデータをグリッドサイズ別に保存する */
    saveAvatar(data: string[], gridSize: 8 | 16 | 32): void {
        localStorage.setItem(`${KEY_AVATAR}_${gridSize}`, JSON.stringify(data));
    }

    /** 保存済みアバターデータを返す（未保存 or サイズ不一致なら null） */
    loadAvatar(gridSize: 8 | 16 | 32): string[] | null {
        const raw = localStorage.getItem(`${KEY_AVATAR}_${gridSize}`);
        if (!raw) return null;
        try {
            const data = JSON.parse(raw);
            if (Array.isArray(data) && data.length === gridSize * gridSize) return data as string[];
        } catch { /* ignore */ }
        return null;
    }

    /** プロフィールを localStorage に保存する */
    save(nickname: string, titleId: string, customTitle: string): void {
        this._nickname    = nickname;
        this._titleId     = titleId;
        this._customTitle = customTitle;
        localStorage.setItem(KEY_NICKNAME,     nickname);
        localStorage.setItem(KEY_TITLE_ID,     titleId);
        localStorage.setItem(KEY_CUSTOM_TITLE, customTitle);
    }

    private _load(): void {
        this._nickname    = localStorage.getItem(KEY_NICKNAME)     ?? 'COMMANDER';
        this._titleId     = localStorage.getItem(KEY_TITLE_ID)     ?? 'rookie';
        this._customTitle = localStorage.getItem(KEY_CUSTOM_TITLE) ?? '';
    }
}
