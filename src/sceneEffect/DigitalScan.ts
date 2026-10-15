import type { IEffect } from './IEffect';
import './digitalscan.css';

export class DigitalScan implements IEffect {
  async play(changeAction: () => void): Promise<void> {
    console.log("DigitalScan: デジタルスキャン演出開始...");
    return new Promise((resolve) => {
      const container = document.body;

      // 1.エフェクトの要素を作成
      const overlay = document.createElement('div');
      overlay.className = 'scan-overlay';
      const line = document.createElement('div');
      line.className = 'scan-line';

      overlay.appendChild(line);
      container.appendChild(overlay);

      // 2.アニメーション開始（リフローを強制してからクラス付与）
      requestAnimationFrame(() => {
        overlay.classList.add('scan-active');
      });

      // 3.アニメーション
      setTimeout(() => {
        changeAction();
        if (container.contains(overlay)) {
            container.removeChild(overlay);
        }
        resolve();
      }, 800);
    });
  }
}