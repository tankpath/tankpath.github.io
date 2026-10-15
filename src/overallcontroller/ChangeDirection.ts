import type { IEffect } from "../sceneEffect/IEffect";
import { FadeOut } from "../sceneEffect/FadeOut";
import { DigitalScan } from "../sceneEffect/DigitalScan";
import { ChangeSceneEffect } from "../Definition/SceneEffect";
import { Immediately } from "../sceneEffect/Immediately";
import { DigitalFracture } from "../sceneEffect/DigitalFracture";

export class ChangeDirection {
    async run(type: ChangeSceneEffect, changeAction: () => void): Promise<void> {
        let effect: IEffect;

        switch (type) {
            case ChangeSceneEffect.Fade:
                effect = new FadeOut();
                break;
            case ChangeSceneEffect.Scan:
                effect = new DigitalScan();
                break;
            case ChangeSceneEffect.Immediately:
                effect = new Immediately();
                break;
            case ChangeSceneEffect.Fracture:
                effect = new DigitalFracture();
                break;
        }
        await effect.play(changeAction);
    }
}