import type { IEffect } from './IEffect';
import './fadeout.css';

export class FadeOut implements IEffect {
  private readonly OVERLAY_ID = 'effect-fade-overlay';

  async play(changeAction: () => void): Promise<void> {
    console.log("FadeOut: フェードアウト演出開始...");
    return new Promise(resolve => {
      const container = document.body;
      let overlay = document.getElementById(this.OVERLAY_ID);

      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = this.OVERLAY_ID;
        overlay.className = 'fade-out-overlay';
        container.appendChild(overlay);
      }

      void overlay.offsetWidth;
      overlay.classList.add('is-active');

      setTimeout(() => {
        changeAction();

        overlay.classList.remove('is-active');
        setTimeout(() => {
          if (container.contains(overlay)) container.removeChild(overlay);
          resolve();
        }, 1000);
      }, 1000);
    });
  }
}

