import { SceneId } from "../Definition/SceneId";
import type { IScene } from "../scene/IScene";
import { setOrientationRequirement } from "../orientation/OrientationManager";

import { InitialLoading } from "../scene/initailLoading/InitialLoading";
import { Title } from "../scene/title/Title";
import { StageLoading } from "../scene/stageloading/StageLoading";
import { Battle } from "../scene/battle/Battle";
import { TryCountUP } from "../scene/trycountup/TryCountUp";
import { Result } from "../scene/result/Result";
import { MissionComplete } from "../scene/missionComplete/MissionComplete";
import { Profile } from "../scene/profile/Profile";

export class SceneTransition {
    private container: HTMLElement;
    private currentScene: IScene | null = null;

    constructor() {
        // 画面全体を覆うコンテナを取得
        this.container = document.querySelector<HTMLDivElement>('#app')!;
    }

    public changeScene(id: SceneId) {
      // 1. 前のシーンがあれば、お片付け（unmount）させる
        if (this.currentScene) {
            this.currentScene.unmount();
            this.currentScene = null;
        }

      // 2. 画面をクリア  
        this.container.innerHTML = '';

      // 3. IDに合わせて、新しいシーンクラスを生成（まだ表示はしない）
        switch (id) {
            case SceneId.InitialLoading:
                this.currentScene = new InitialLoading();
                break;
            case SceneId.Title:
                this.currentScene = new Title();
                break;
            case SceneId.StageLoading:
                this.currentScene = new StageLoading();
                break;
            case SceneId.Battle:
                this.currentScene = new Battle();
                break;
            case SceneId.TryCountUp:
                this.currentScene = new TryCountUP();
                break;
            case SceneId.Result:
                this.currentScene = new Result();
                break;
            case SceneId.MissionComplete:
                this.currentScene = new MissionComplete();
                break;
            case SceneId.Profile:
                this.currentScene = new Profile();
                break;
            // ... 他のケース
            default:
                console.error("未定義のシーンIDです:", id);
                return;
        }

        // 4. 向き要求をデフォルトにリセット（各シーンが必要に応じて上書きする）
        setOrientationRequirement('any');

        // 5. 新しいシーンを表示（mount）開始！
        if (this.currentScene) {
            this.currentScene.mount(this.container);
        }

    }

}

