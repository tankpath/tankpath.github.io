import './installPrompt.css';

type DeferredPromptEvent = Event & {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const SESSION_KEY = 'tankpath_pwa_dismissed';

let deferredPrompt: DeferredPromptEvent | null = null;

/** PWA（ホーム画面追加）として起動中か判定 */
function isPWA(): boolean {
    return (
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true
    );
}

/** モバイルまたはタブレットか判定 */
function isMobileOrTablet(): boolean {
    return window.innerWidth <= 1024 || 'ontouchstart' in window;
}

/** iOS（Safari）か判定 */
function isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function initInstallPrompt(): void {
    // PWA済み or PC → 何もしない
    if (isPWA() || !isMobileOrTablet()) return;

    // Android/Chrome: beforeinstallprompt をキャプチャ
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e as DeferredPromptEvent;
        maybeShowBanner();
    });

    // iOS: beforeinstallprompt は発火しないので手動表示
    if (isIOS()) {
        setTimeout(maybeShowBanner, 800);
    }
}

function maybeShowBanner(): void {
    // 今セッションで既に閉じていたら再表示しない
    if (sessionStorage.getItem(SESSION_KEY)) return;
    showBanner();
}

function showBanner(): void {
    if (document.getElementById('pwa-install-banner')) return;

    const ios = isIOS();
    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML = `
        <div class="pwa-banner-inner">
            <p class="pwa-banner-text">${
                ios
                    ? 'Safari の共有ボタン → [ホーム画面に追加] でフルスクリーン起動できます'
                    : 'アプリをインストールするとブラウザのUIバーなしでフルスクリーンで遊べます'
            }</p>
            <div class="pwa-banner-actions">
                ${!ios ? '<button id="pwa-install-btn" class="pwa-btn pwa-btn--install">インストール</button>' : ''}
                <button id="pwa-dismiss-btn" class="pwa-btn pwa-btn--dismiss">後で</button>
            </div>
        </div>
    `;
    document.body.appendChild(banner);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => banner.classList.add('pwa-banner--visible'));
    });

    if (!ios) {
        document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') removeBanner(false);
            deferredPrompt = null;
        });
    }

    document.getElementById('pwa-dismiss-btn')?.addEventListener('click', () => removeBanner(true));
}

function removeBanner(saveSession: boolean): void {
    const banner = document.getElementById('pwa-install-banner');
    if (!banner) return;
    if (saveSession) sessionStorage.setItem(SESSION_KEY, '1');
    banner.classList.remove('pwa-banner--visible');
    setTimeout(() => banner.remove(), 400);
}
