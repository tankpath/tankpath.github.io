import type { IEffect } from './IEffect';
import './digitalfracture.css';

export class DigitalFracture implements IEffect {
    private readonly GRID_SIZE = 5; // 縦横 5x5 のタイル（計25枚）

    async play(changeAction: () => void): Promise<void> {
        return new Promise((resolve) => {
            const container = document.body;
            const wrapper = document.createElement('div');
            wrapper.className = 'fracture-wrapper';

            // 1. デジタルな「壁」をタイル状に生成
            for (let i = 0; i < this.GRID_SIZE * this.GRID_SIZE; i++) {
                const tile = document.createElement('div');
                tile.className = 'fracture-tile';
                
                // ランダムな三角形の形状を付与（clip-path）
                const shape = this.getRandomTriangle();
                tile.style.clipPath = shape;
                
                // 遅延をランダムにしてパラパラ感を出す
                tile.style.animationDelay = `${Math.random() * 0.5}s`;
                
                wrapper.appendChild(tile);
            }

            container.appendChild(wrapper);

            // 2. スキャンライン（既存の演出を流用）も追加
            const line = document.createElement('div');
            line.className = 'scan-line'; // 既存のCSSを流用
            wrapper.appendChild(line);

            void wrapper.offsetWidth;
            wrapper.classList.add('is-active');

            // 3. スキャンが下まで行き、崩壊が始まったタイミングでシーン切替
            setTimeout(() => {
                changeAction();
            }, 600); 

            // 4. 全ての破片が消えたら掃除
            setTimeout(() => {
                if (container.contains(wrapper)) container.removeChild(wrapper);
                resolve();
            }, 2000); // 演出時間が長いので少し長めに待機
        });
    }

    private getRandomTriangle(): string {
        // 多角形（三角形に近い形）をランダムに生成するポリゴンデータ
        const p1 = `${Math.random() * 100}% ${Math.random() * 100}%`;
        const p2 = `${Math.random() * 100}% ${Math.random() * 100}%`;
        const p3 = `${Math.random() * 100}% ${Math.random() * 100}%`;
        return `polygon(${p1}, ${p2}, ${p3})`;
    }
}