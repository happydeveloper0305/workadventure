import { gameManager } from "../Game/GameManager";
import { Scene } from "phaser";
import { ErrorScene, ErrorSceneName } from "../Reconnecting/ErrorScene";
import { WAError } from "../Reconnecting/WAError";
import { waScaleManager } from "../Services/WaScaleManager";

export const EntrySceneName = "EntryScene";

/**
 * The EntryScene is not a real scene. It is the first scene loaded and is only used to initialize the gameManager
 * and to route to the next correct scene.
 */
export class EntryScene extends Scene {
    constructor() {
        super({
            key: EntrySceneName,
        });
    }

    create() {
        gameManager
            .init(this.scene)
            .then((nextSceneName) => {
                // Let's rescale before starting the game
                // We can do it at this stage.
                waScaleManager.applyNewSize();
                this.scene.start(nextSceneName);
            })
            .catch((err) => {
                if (err.response && err.response.status == 404) {
                    ErrorScene.showError(
                        new WAError(
                            "Access link incorrect",
                            "Could not find map. Please check your access link.",
                            "If you want more information, you may contact administrator or contact us at: hello@workadventu.re"
                        ),
                        this.scene
                    );
                } else if (err.response && err.response.status == 403) {
                    ErrorScene.showError(
                        new WAError(
                            "Connection rejected",
                            "You cannot join the World. Try again later" +
                                (err.response.data ? ". \n\r \n\r" + `${err.response.data}` : "") +
                                ".",
                            "If you want more information, you may contact administrator or contact us at: hello@workadventu.re"
                        ),
                        this.scene
                    );
                } else {
                    ErrorScene.showError(err, this.scene);
                }
            });
    }
}
