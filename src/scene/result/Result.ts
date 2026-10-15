import { ChangeSceneEffect } from '../../Definition/SceneEffect';
import { SceneId } from '../../Definition/SceneId';
import { SceneChangeAction } from '../../types/btn/SceneChange';
import { StageCreationManager } from '../../managers/StageCreationManager';
import { ResultManager } from '../../managers/ResultManager';
import { saveAnalyzers } from '../../Analyze/AnalyzerStorage';
import type { IScene } from '../IScene';
import { ResultView } from './ResultView';
import './result.css';
import { SoundManager } from '../../managers/SoundManager';
import { SE, BGM } from '../../Definition/SoundList';


export class Result implements IScene {
    private container: HTMLElement | null = null;

    private readonly buttonConfigs = [
        {
            selector: '#rs-back-btn',
            action: new SceneChangeAction(SceneId.Title, ChangeSceneEffect.Fade)
        },
        {
            selector: '#rs-retry-btn',
            action: new SceneChangeAction(SceneId.StageLoading, ChangeSceneEffect.Fade)
        }
    ];

    public mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = '';
        SoundManager.instance.playBGM(BGM.STAGE_LOADING);
        this.render();
        this.bindButtons();
    }

    private render() {
        if (!this.container) return;
        ResultView.render(this.container);
    }

    private bindButtons() {
        this.buttonConfigs.forEach(({ selector, action }) => {
            const btn = this.container?.querySelector(selector);
            if (!btn) return;

            if (selector === '#rs-retry-btn') {
                btn.addEventListener('click', async () => {
                    SoundManager.instance.playSE(SE.DECISION);
                    await saveAnalyzers();
                    StageCreationManager.instance.reset();
                    ResultManager.instance.reset();
                    action.execute();
                });
            } else {
                btn.addEventListener('click', async () => {
                    SoundManager.instance.playSE(SE.CANCEL);
                    await saveAnalyzers();
                    ResultManager.instance.reset();
                    action.execute();
                });
            }
        });
    }

    public unmount(): void {
        SoundManager.instance.stopBGM();
        if (this.container) this.container.innerHTML = '';
    }
}
