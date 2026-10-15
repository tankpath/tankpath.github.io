export type OrientationRequirement = 'landscape' | 'portrait' | 'any';

let requirement: OrientationRequirement = 'any';
let dismissed = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** PC/タブレット以上は対象外（スマホのみ） */
function isMobile(): boolean {
    // screen.width/height は向きに関係なく物理サイズを返すため、横持ちでも正確
    const shortSide = Math.min(screen.width, screen.height);
    const hasTouch  = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    return hasTouch && shortSide < 600;
}

/** screen.orientation → matchMedia → innerWidth/Height の順でフォールバック */
function isLandscape(): boolean {
    if (typeof screen !== 'undefined' && screen.orientation?.type) {
        return screen.orientation.type.startsWith('landscape');
    }
    if (typeof window.matchMedia === 'function') {
        return window.matchMedia('(orientation: landscape)').matches;
    }
    return window.innerWidth > window.innerHeight;
}

function getWarningEl(): HTMLElement | null {
    return document.getElementById('orientation-warning');
}

function updateText(): void {
    const textEl = document.getElementById('orientation-warning-text');
    const subEl  = document.getElementById('orientation-warning-sub');
    if (!textEl || !subEl) return;

    if (requirement === 'landscape') {
        textEl.textContent = 'LANDSCAPE MODE RECOMMENDED';
        subEl.textContent  = '横画面での表示を推奨しています';
    } else if (requirement === 'portrait') {
        textEl.textContent = 'PORTRAIT MODE RECOMMENDED';
        subEl.textContent  = '縦画面での表示を推奨しています';
    }
}

function check(): void {
    const el = getWarningEl();
    if (!el) return;

    // PC 等は対象外
    if (!isMobile() || requirement === 'any' || dismissed) {
        el.classList.add('is-hidden');
        return;
    }

    const landscape  = isLandscape();
    const shouldShow =
        (requirement === 'landscape' && !landscape) ||
        (requirement === 'portrait'  &&  landscape);

    if (shouldShow) {
        updateText();
        el.style.display = 'flex';
        el.classList.remove('is-hidden');
    } else {
        el.classList.add('is-hidden');
    }
}

/** デバウンス付きチェック: 連続 resize を間引く */
function debouncedCheck(delay = 150): void {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        debounceTimer = null;
        if (!dismissed) check();
    }, delay);
}

/** シーンから呼ぶ: 必要な向きを設定する */
export function setOrientationRequirement(req: OrientationRequirement): void {
    requirement = req;
    dismissed   = false;
    check();
}

/** main.ts から一度だけ呼ぶ */
export function initOrientationManager(): void {
    // 閉じるボタン
    document.getElementById('close-warning')?.addEventListener('click', () => {
        dismissed = true;
        getWarningEl()?.classList.add('is-hidden');
    });

    // screen.orientation が使える場合はこちらを優先（より正確）
    if (typeof screen !== 'undefined' && screen.orientation) {
        screen.orientation.addEventListener('change', () => debouncedCheck(200));
    }

    // resize はデバウンスして多重発火を抑制
    window.addEventListener('resize', () => debouncedCheck(150));
}
