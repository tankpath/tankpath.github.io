import { SceneId } from "../Definition/SceneId";
import { ChangeSceneEffect } from "../Definition/SceneEffect";
import { SceneTransition } from "./SceneTransition";
import { ChangeDirection } from "./ChangeDirection";

export class OverallManager {
    private static _instance: OverallManager;

    private transitioner: SceneTransition;
    private director: ChangeDirection;

    private constructor() {
        this.transitioner = new SceneTransition();
        this.director = new ChangeDirection();
    }

    public static get instance(): OverallManager {
        if (!this._instance) {
            this._instance = new OverallManager();
        }
        return this._instance;
    }

    public async requestChangeScene(nextId: SceneId, directorNum: ChangeSceneEffect) {
        // シーン移動演出をChangeDirection.tsに指示
        await this.director.run(directorNum, () => {
            // シーン遷移をSceneTranstition.tsに指示
            this.excuteSceneChange(nextId);
        });
        
        console.log('次のシーンは' + nextId);
    }

    private excuteSceneChange(id: SceneId){
        this.transitioner.changeScene(id);
    }
}