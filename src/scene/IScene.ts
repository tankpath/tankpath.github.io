export interface IScene {
    // 画面に表示する（HTML生成やThree.js開始）
    mount(container: HTMLElement): void;

    // 画面から消す（イベント解除やメモリ解放）
    unmount(): void;
}