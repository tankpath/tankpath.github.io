import { ChangeSceneEffect } from "../../Definition/SceneEffect";
import { SceneId } from "../../Definition/SceneId";
import { OverallManager } from "../../overallcontroller/OverallManager";
import type { ClickAction } from "./ClickAction";

export class SceneChangeAction implements ClickAction {
    private sceneId: SceneId;
    private effect: ChangeSceneEffect;

    constructor(sceneId: SceneId, effect: ChangeSceneEffect) {
        this.sceneId = sceneId;
        this.effect = effect;
    }

    execute(): void {
        OverallManager.instance.requestChangeScene(this.sceneId, this.effect);
    }
}