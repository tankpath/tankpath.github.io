import './style.css';
import { OverallManager } from './overallcontroller/OverallManager';
import { SceneId } from './Definition/SceneId';
import { ChangeSceneEffect } from './Definition/SceneEffect';
import { initInstallPrompt } from './pwa/installPrompt';
import { initOrientationManager } from './orientation/OrientationManager';
import { initLang } from './i18n/i18n';

window.addEventListener('DOMContentLoaded', () => {
  initLang();
  OverallManager.instance.requestChangeScene(SceneId.InitialLoading, ChangeSceneEffect.Immediately);
  initInstallPrompt();
  initOrientationManager();
});