import type { GameScene } from "./GameScene";
import type { GameMap } from "./GameMap";
import { scriptUtils } from "../../Api/ScriptUtils";
import type { CoWebsite } from "../../WebRtc/CoWebsiteManager";
import { coWebsiteManager } from "../../WebRtc/CoWebsiteManager";
import { layoutManagerActionStore } from "../../Stores/LayoutManagerStore";
import { get } from 'svelte/store';
import {
    ON_ACTION_TRIGGER_BUTTON,
    TRIGGER_WEBSITE_PROPERTIES,
    WEBSITE_MESSAGE_PROPERTIES,
} from "../../WebRtc/LayoutManager";
import type { ITiledMapLayer } from "../Map/ITiledMap";

enum OpenCoWebsiteState {
    LOADING,
    OPENED,
    MUST_BE_CLOSE,
}

interface OpenCoWebsite {
    coWebsite: CoWebsite | undefined,
    state: OpenCoWebsiteState
}

export class GameMapPropertiesListener {
    private coWebsitesOpenByLayer = new Map<ITiledMapLayer, OpenCoWebsite>();
    private coWebsitesActionTriggerByLayer = new Map<ITiledMapLayer, string>();

    constructor(private scene: GameScene, private gameMap: GameMap) {}

    register() {
        this.gameMap.onPropertyChange("openTab", (newValue, oldvalue, allProps) => {
            if (newValue === undefined) {
                layoutManagerActionStore.removeAction("openTab");
            }
            if (typeof newValue == "string" && newValue.length) {
                const openWebsiteTriggerValue = allProps.get(TRIGGER_WEBSITE_PROPERTIES);
                if (openWebsiteTriggerValue && openWebsiteTriggerValue === ON_ACTION_TRIGGER_BUTTON) {
                    let message = allProps.get(WEBSITE_MESSAGE_PROPERTIES);
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
                newLayers.forEach(layer => {
                    if (!layer.properties) {
                        return;
                    }

                    let openWebsiteProperty: string | undefined;
                    let allowApiProperty: boolean | undefined;
                    let websitePolicyProperty: string | undefined;
                    let websiteWidthProperty: number | undefined;
                    let websitePositionProperty: number | undefined;
                    let websiteTriggerProperty: string | undefined;
                    let websiteTriggerMessageProperty: string | undefined;

                    layer.properties.forEach(property => {
                        switch(property.name) {
                            case 'openWebsite':
                                openWebsiteProperty = property.value as string | undefined;
                                break;
                            case 'openWebsiteAllowApi':
                                allowApiProperty = property.value as boolean | undefined;
                                break;
                            case 'openWebsitePolicy':
                                websitePolicyProperty = property.value as string | undefined;
                                break;
                            case 'openWebsiteWidth':
                                websiteWidthProperty = property.value as number | undefined;
                                break;
                            case 'openWebsitePosition':
                                websitePositionProperty = property.value as number | undefined;
                                break;
                            case TRIGGER_WEBSITE_PROPERTIES:
                                websiteTriggerProperty = property.value as string | undefined;
                                break;
                            case WEBSITE_MESSAGE_PROPERTIES:
                                websiteTriggerMessageProperty = property.value as string | undefined;
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

                    this.coWebsitesOpenByLayer.set(layer, {
                        coWebsite: undefined,
                        state: OpenCoWebsiteState.LOADING,
                    });

                    const openWebsiteFunction = () => {
                        coWebsiteManager.loadCoWebsite(
                            openWebsiteProperty as string,
                            this.scene.MapUrlFile,
                            allowApiProperty,
                            websitePolicyProperty,
                            websiteWidthProperty,
                            websitePositionProperty,
                        ).then(coWebsite => {
                            const coWebsiteOpen = this.coWebsitesOpenByLayer.get(layer);
                            if (coWebsiteOpen && coWebsiteOpen.state === OpenCoWebsiteState.MUST_BE_CLOSE) {
                                coWebsiteManager.closeCoWebsite(coWebsite);
                                this.coWebsitesOpenByLayer.delete(layer);
                                this.coWebsitesActionTriggerByLayer.delete(layer);
                            } else {
                                this.coWebsitesOpenByLayer.set(layer, {
                                    coWebsite,
                                    state: OpenCoWebsiteState.OPENED
                                });
                            }
                        });

                        layoutManagerActionStore.removeAction(actionUuid);
                    };

                    if (websiteTriggerProperty && websiteTriggerProperty === ON_ACTION_TRIGGER_BUTTON) {
                        if (!websiteTriggerMessageProperty) {
                            websiteTriggerMessageProperty = "Press SPACE or touch here to open web site";
                        }

                        this.coWebsitesActionTriggerByLayer.set(layer, actionUuid);

                        layoutManagerActionStore.addAction({
                            uuid: actionUuid,
                            type: "message",
                            message: websiteTriggerMessageProperty,
                            callback: () => openWebsiteFunction(),
                            userInputManager: this.scene.userInputManager,
                        });
                    } else {
                        openWebsiteFunction();
                    }
                });
            };

            handler();
        });

        // Close opened co-websites on leave the layer who contain the property.
        this.gameMap.onLeaveLayer((oldLayers) => {
            const handler = () => {
                oldLayers.forEach(layer => {
                    if (!layer.properties) {
                        return;
                    }

                    let openWebsiteProperty: string | undefined;
                    let websiteTriggerProperty: string | undefined;

                    layer.properties.forEach(property => {
                        switch(property.name) {
                            case 'openWebsite':
                                openWebsiteProperty = property.value as string | undefined;
                                break;
                            case TRIGGER_WEBSITE_PROPERTIES:
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

                    if (coWebsiteOpen.state === OpenCoWebsiteState.LOADING) {
                        coWebsiteOpen.state = OpenCoWebsiteState.MUST_BE_CLOSE;
                        return;
                    }

                    if (coWebsiteOpen.state !== OpenCoWebsiteState.OPENED) {
                        return;
                    }

                    if (coWebsiteOpen.coWebsite !== undefined) {
                        coWebsiteManager.closeCoWebsite(coWebsiteOpen.coWebsite);
                    }

                    this.coWebsitesOpenByLayer.delete(layer);

                    if (!websiteTriggerProperty) {
                        return;
                    }

                    const actionStore = get(layoutManagerActionStore);
                    const actionTriggerUuid = this.coWebsitesActionTriggerByLayer.get(layer);

                    if (!actionTriggerUuid) {
                        return;
                    }

                    const action = actionStore && actionStore.length > 0 ?
                        actionStore.find(action => action.uuid === actionTriggerUuid) : undefined;


                    if (action) {
                        layoutManagerActionStore.removeAction(actionTriggerUuid);
                    }
                });
            };

            handler();
        });
    }
}
