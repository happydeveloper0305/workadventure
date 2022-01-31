import type { GameScene } from "./GameScene";
import type { GameMap } from "./GameMap";
import { scriptUtils } from "../../Api/ScriptUtils";
import type { CoWebsite } from "../../WebRtc/CoWebsiteManager";
import { coWebsiteManager } from "../../WebRtc/CoWebsiteManager";
import { layoutManagerActionStore } from "../../Stores/LayoutManagerStore";
import { localUserStore } from "../../Connexion/LocalUserStore";
import { get } from "svelte/store";
import { ON_ACTION_TRIGGER_BUTTON } from "../../WebRtc/LayoutManager";
import type { ITiledMapLayer } from "../Map/ITiledMap";
import { GameMapProperties } from "./GameMapProperties";
import { highlightedEmbedScreen } from "../../Stores/EmbedScreensStore";

enum OpenCoWebsiteState {
    ASLEEP,
    OPENED,
    MUST_BE_CLOSE,
}

interface OpenCoWebsite {
    coWebsite: CoWebsite;
    state: OpenCoWebsiteState;
}

export class GameMapPropertiesListener {
    private coWebsitesOpenByLayer = new Map<ITiledMapLayer, OpenCoWebsite>();

    constructor(private scene: GameScene, private gameMap: GameMap) {}

    register() {
        this.gameMap.onPropertyChange(GameMapProperties.OPEN_TAB, (newValue, oldValue, allProps) => {
            if (newValue === undefined) {
                layoutManagerActionStore.removeAction("openTab");
            }
            if (typeof newValue == "string" && newValue.length) {
                const openWebsiteTriggerValue = allProps.get(GameMapProperties.OPEN_WEBSITE_TRIGGER);
                const forceTrigger = localUserStore.getForceCowebsiteTrigger();
                if (forceTrigger || openWebsiteTriggerValue === ON_ACTION_TRIGGER_BUTTON) {
                    let message = allProps.get(GameMapProperties.OPEN_WEBSITE_TRIGGER_MESSAGE);
                    if (message === undefined) {
                        message = "Press SPACE or touch here to open web site in new tab";
                    }
                    layoutManagerActionStore.addAction({
                        uuid: "openTab",
                        type: "message",
                        message: message,
                        callback: () => scriptUtils.openTab(newValue),
                        userInputManager: this.scene.userInputManager,
                    });
                } else {
                    scriptUtils.openTab(newValue);
                }
            }
        });

        // Open a new co-website by the property.
        this.gameMap.onEnterLayer((newLayers) => {
            const handler = () => {
                newLayers.forEach((layer) => {
                    if (!layer.properties) {
                        return;
                    }

                    let openWebsiteProperty: string | undefined;
                    let allowApiProperty: boolean | undefined;
                    let websitePolicyProperty: string | undefined;
                    let websitePositionProperty: number | undefined;
                    let websiteTriggerProperty: string | undefined;

                    layer.properties.forEach((property) => {
                        switch (property.name) {
                            case GameMapProperties.OPEN_WEBSITE:
                                openWebsiteProperty = property.value as string | undefined;
                                break;
                            case GameMapProperties.OPEN_WEBSITE_ALLOW_API:
                                allowApiProperty = property.value as boolean | undefined;
                                break;
                            case GameMapProperties.OPEN_WEBSITE_POLICY:
                                websitePolicyProperty = property.value as string | undefined;
                                break;
                            case GameMapProperties.OPEN_WEBSITE_POSITION:
                                websitePositionProperty = property.value as number | undefined;
                                break;
                            case GameMapProperties.OPEN_WEBSITE_TRIGGER:
                                websiteTriggerProperty = property.value as string | undefined;
                                break;
                        }
                    });

                    if (!openWebsiteProperty) {
                        return;
                    }

                    const actionUuid = "openWebsite-" + (Math.random() + 1).toString(36).substring(7);

                    if (this.coWebsitesOpenByLayer.has(layer)) {
                        return;
                    }

                    const coWebsite = coWebsiteManager.addCoWebsite(
                        openWebsiteProperty,
                        this.scene.MapUrlFile,
                        allowApiProperty,
                        websitePolicyProperty,
                        websitePositionProperty,
                        false
                    );

                    this.coWebsitesOpenByLayer.set(layer, {
                        coWebsite: coWebsite,
                        state: OpenCoWebsiteState.ASLEEP,
                    });

                    const openWebsiteFunction = () => {
                        coWebsiteManager
                            .loadCoWebsite(coWebsite)
                            .then((coWebsite) => {
                                const coWebsiteOpen = this.coWebsitesOpenByLayer.get(layer);
                                if (coWebsiteOpen && coWebsiteOpen.state === OpenCoWebsiteState.MUST_BE_CLOSE) {
                                    coWebsiteManager.closeCoWebsite(coWebsite).catch(() => {
                                        console.error("Error during a co-website closing");
                                    });
                                    this.coWebsitesOpenByLayer.delete(layer);
                                } else {
                                    this.coWebsitesOpenByLayer.set(layer, {
                                        coWebsite,
                                        state: OpenCoWebsiteState.OPENED,
                                    });
                                }
                            })
                            .catch(() => {
                                console.error("Error during loading a co-website: " + coWebsite.url);
                            });

                        layoutManagerActionStore.removeAction(actionUuid);
                    };

                    if (
                        !localUserStore.getForceCowebsiteTrigger() &&
                        websiteTriggerProperty !== ON_ACTION_TRIGGER_BUTTON
                    ) {
                        openWebsiteFunction();
                    }
                });
            };

            handler();
        });

        // Close opened co-websites on leave the layer who contain the property.
        this.gameMap.onLeaveLayer((oldLayers) => {
            const handler = () => {
                oldLayers.forEach((layer) => {
                    if (!layer.properties) {
                        return;
                    }

                    let openWebsiteProperty: string | undefined;
                    let websiteTriggerProperty: string | undefined;

                    layer.properties.forEach((property) => {
                        switch (property.name) {
                            case GameMapProperties.OPEN_WEBSITE:
                                openWebsiteProperty = property.value as string | undefined;
                                break;
                            case GameMapProperties.OPEN_WEBSITE_TRIGGER:
                                websiteTriggerProperty = property.value as string | undefined;
                                break;
                        }
                    });

                    if (!openWebsiteProperty) {
                        return;
                    }

                    const coWebsiteOpen = this.coWebsitesOpenByLayer.get(layer);

                    if (!coWebsiteOpen) {
                        return;
                    }

                    if (coWebsiteOpen.state === OpenCoWebsiteState.ASLEEP) {
                        coWebsiteOpen.state = OpenCoWebsiteState.MUST_BE_CLOSE;
                    }

                    if (coWebsiteOpen.coWebsite !== undefined) {
                        coWebsiteManager.closeCoWebsite(coWebsiteOpen.coWebsite).catch((e) => console.error(e));
                    }

                    this.coWebsitesOpenByLayer.delete(layer);
                });
            };

            handler();
        });
    }
}
