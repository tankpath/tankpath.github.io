import { ja, type Locale } from './locales/ja';
import { en } from './locales/en';

export type LangKey = keyof Locale;
export type Lang = 'ja' | 'en';

const locales: Record<Lang, Locale> = { ja, en };
let currentLang: Lang = 'ja';

/** localStorage の保存値から言語を初期化する。main.ts の DOMContentLoaded で呼ぶ。 */
export function initLang(): void {
    try {
        const saved = JSON.parse(localStorage.getItem('tankpath-settings') ?? '{}');
        if (saved.lang === 'en') currentLang = 'en';
    } catch { /* ignore */ }
}

export function setLang(lang: Lang): void {
    currentLang = lang;
}

export function getLang(): Lang {
    return currentLang;
}

/** キーに対応する現在言語の文字列を返す。 */
export function t(key: LangKey): string {
    return locales[currentLang][key] ?? locales.ja[key];
}

/**
 * テンプレート変数を含むキーを展開する。
 * @example tf('nicknameNote', { max: 12 }) // → "最大 12 文字"
 */
export function tf(key: LangKey, vars: Record<string, string | number>): string {
    return t(key).replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
}
