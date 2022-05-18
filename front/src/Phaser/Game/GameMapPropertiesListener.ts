import type { GameScene } from "./GameScene";
import type { GameMap } from "./GameMap";
import { scriptUtils } from "../../Api/ScriptUtils";
import { coWebsiteManager } from "../../WebRtc/CoWebsiteManager";
import { layoutManagerActionStore } from "../../Stores/LayoutManagerStore";
import { localUserStore } from "../../Connexion/LocalUserStore";
import { get } from "svelte/store";
import { ON_ACTION_TRIGGER_BUTTON, ON_ICON_TRIGGER_BUTTON } from "../../WebRtc/LayoutManager";
import type { ITiledMapProperty } from "../Map/ITiledMap";
import { GameMapProperties } from "./GameMapProperties";
import type { CoWebsite } from "../../WebRtc/CoWebsite/CoWesbite";
import { SimpleCoWebsite } from "../../WebRtc/CoWebsite/SimpleCoWebsite";
import { jitsiFactory } from "../../WebRtc/JitsiFactory";
import { bbbFactory } from "../../WebRtc/BBBFactory";
import { JITSI_PRIVATE_MODE, JITSI_URL } from "../../Enum/EnvironmentVariable";
import { JitsiCoWebsite } from "../../WebRtc/CoWebsite/JitsiCoWebsite";
import { audioManagerFileStore, audioManagerVisibilityStore } from "../../Stores/AudioManagerStore";
import { iframeListener } from "../../Api/IframeListener";
import { Room } from "../../Connexion/Room";
import LL from "../../i18n/i18n-svelte";
import { inJitsiStore, inBbbStore, silentStore } from "../../Stores/MediaStore";

interface OpenCoWebsite {
    actionId: string;
    coWebsite?: CoWebsite;
}

/**
 * Either Layer or Object within Objects Layer in Tiled
 */
export interface ITiledPlace {
    name: string;
    properties?: ITiledMapProperty[];
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}

export class GameMapPropertiesListener {
    private coWebsitesOpenByPlace = new Map<ITiledPlace, OpenCoWebsite>();
    private coWebsitesActionTriggerByPlace = new Map<ITiledPlace, string>();

    constructor(private scene: GameScene, private gameMap: GameMap) {}

    register() {
        // Website on new tab
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
                        message = get(LL).trigger.newTab();
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

        // Jitsi room
        this.gameMap.onPropertyChange(GameMapProperties.JITSI_ROOM, (newValue, oldValue, allProps) => {
            if (newValue === undefined) {
                layoutManagerActionStore.removeAction("jitsi");
                coWebsiteManager.getCoWebsites().forEach((coWebsite) => {
                    if (coWebsite instanceof JitsiCoWebsite) {
                        coWebsiteManager.closeCoWebsite(coWebsite);
                    }
                });
                inJitsiStore.set(false);
            } else {
                const openJitsiRoomFunction = () => {
                    let addPrefix = true;
                    if (allProps.get(GameMapProperties.JITSI_NO_PREFIX)) {
                        addPrefix = false;
                    }
                    const roomName = jitsiFactory.getRoomName(newValue.toString(), this.scene.roomUrl, addPrefix);
                    const jitsiUrl = allProps.get(GameMapProperties.JITSI_URL) as string | undefined;

                    if (JITSI_PRIVATE_MODE && !jitsiUrl) {
                        this.scene.connection?.emitQueryJitsiJwtMessage(roomName);
                    } else {
                        let domain = jitsiUrl || JITSI_URL;
                        if (domain === undefined) {
                            throw new Error("Missing JITSI_URL environment variable or jitsiUrl parameter in the map.");
                        }

                        if (domain.substring(0, 7) !== "http://" && domain.substring(0, 8) !== "https://") {
                            domain = `${location.protocol}//${domain}`;
                        }

                        const coWebsite = new JitsiCoWebsite(new URL(domain), false, undefined, undefined, false);

                        coWebsiteManager.addCoWebsiteToStore(coWebsite, 0);
                        this.scene.initialiseJitsi(coWebsite, roomName, undefined);
                    }
                    layoutManagerActionStore.removeAction("jitsi");
                };

                const jitsiTriggerValue = allProps.get(GameMapProperties.JITSI_TRIGGER);
                const forceTrigger = localUserStore.getForceCowebsiteTrigger();
                if (forceTrigger || jitsiTriggerValue === ON_ACTION_TRIGGER_BUTTON) {
                    let message = allProps.get(GameMapProperties.JITSI_TRIGGER_MESSAGE);
                    if (message === undefined) {
                        message = get(LL).trigger.jitsiRoom();
                    }
                    layoutManagerActionStore.addAction({
                        uuid: "jitsi",
                        type: "message",
                        message: message,
                        callback: () => {
                            openJitsiRoomFunction();
                            inJitsiStore.set(true);
                        },
                        userInputManager: this.scene.userInputManager,
                    });
                } else {
                    openJitsiRoomFunction();
                    inJitsiStore.set(true);
                }
            }
        });

        this.gameMap.onPropertyChange(GameMapProperties.BBB_MEETING, (newValue, oldValue, allProps) => {
            if (newValue === undefined) {
                layoutManagerActionStore.removeAction("bbbMeeting");
                inBbbStore.set(false);
                bbbFactory.setStopped(true);
                bbbFactory.stop();
            } else {
                inBbbStore.set(true);
                bbbFactory.setStopped(false);
                void bbbFactory.parametrizeMeetingId(newValue as string).then((hashedMeetingId) => {
                    this.scene.connection?.emitJoinBBBMeeting(hashedMeetingId, allProps);
                });
            }
        });

        this.gameMap.onPropertyChange(GameMapProperties.EXIT_SCENE_URL, (newValue) => {
            if (newValue) {
                this.scene
                    .onMapExit(
                        Room.getRoomPathFromExitSceneUrl(
                            newValue as string,
                            window.location.toString(),
                            this.scene.MapUrlFile
                        )
                    )
                    .catch((e) => console.error(e));
            } else {
                setTimeout(() => {
                    layoutManagerActionStore.removeAction("roomAccessDenied");
                }, 2000);
            }
        });

        this.gameMap.onPropertyChange(GameMapProperties.EXIT_URL, (newValue) => {
            if (newValue) {
                this.scene
                    .onMapExit(Room.getRoomPathFromExitUrl(newValue as string, window.location.toString()))
                    .catch((e) => console.error(e));
            } else {
                setTimeout(() => {
                    layoutManagerActionStore.removeAction("roomAccessDenied");
                }, 2000);
            }
        });

        this.gameMap.onPropertyChange(GameMapProperties.SILENT, (newValue) => {
            if (newValue === undefined || newValue === false || newValue === "") {
                silentStore.set(false);
            } else {
                silentStore.set(true);
            }
        });

        this.gameMap.onPropertyChange(GameMapProperties.PLAY_AUDIO, (newValue, oldValue, allProps) => {
            const volume = allProps.get(GameMapProperties.AUDIO_VOLUME) as number | undefined;
            const loop = allProps.get(GameMapProperties.AUDIO_LOOP) as boolean | undefined;
            newValue === undefined
                ? audioManagerFileStore.unloadAudio()
                : audioManagerFileStore.playAudio(newValue, this.scene.getMapDirUrl(), volume, loop);
            audioManagerVisibilityStore.set(!(newValue === undefined));
        });

        // TODO: This legacy property should be removed at some point
        this.gameMap.onPropertyChange(GameMapProperties.PLAY_AUDIO_LOOP, (newValue) => {
            newValue === undefined
                ? audioManagerFileStore.unloadAudio()
                : audioManagerFileStore.playAudio(newValue, this.scene.getMapDirUrl(), undefined, true);
            audioManagerVisibilityStore.set(!(newValue === undefined));
        });

        // TODO: Legacy functionnality replace by layer change
        this.gameMap.onPropertyChange(GameMapProperties.ZONE, (newValue, oldValue) => {
            if (oldValue) {
                iframeListener.sendLeaveEvent(oldValue as string);
            }
            if (newValue) {
                iframeListener.sendEnterEvent(newValue as string);
            }
        });

        this.gameMap.onEnterLayer((newLayers) => {
            this.onEnterPlaceHandler(newLayers);
        });

        this.gameMap.onLeaveLayer((oldLayers) => {
            this.onLeavePlaceHandler(oldLayers);
        });

        this.gameMap.onEnterArea((newAreas) => {
            this.onEnterPlaceHandler(newAreas);
        });

        this.gameMap.onLeaveArea((oldAreas) => {
            this.onLeavePlaceHandler(oldAreas);
        });
    }

    private onEnterPlaceHandler(places: ITiledPlace[]): void {
        places.forEach((place) => {
            this.handleOpenWebsitePropertiesOnEnter(place);
            this.handleFocusablePropertiesOnEnter(place);
        });
    }

    private onLeavePlaceHandler(places: ITiledPlace[]): void {
        places.forEach((place) => {
            if (!place.properties) {
                return;
            }

            this.handleOpenWebsitePropertiesOnLeave(place);
            this.handleFocusablePropertiesOnLeave(place);
        });
    }

    private handleOpenWebsitePropertiesOnEnter(place: ITiledPlace): void {
        if (!place.properties) {
            return;
        }
        let openWebsiteProperty: string | undefined;
        let allowApiProperty: boolean | undefined;
        let websitePolicyProperty: string | undefined;
        let websiteWidthProperty: number | undefined;
        let websitePositionProperty: number | undefined;
        let websiteTriggerProperty: string | undefined;
        let websiteTriggerMessageProperty: string | undefined;

        place.properties.forEach((property) => {
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
                case GameMapProperties.OPEN_WEBSITE_WIDTH:
                    websiteWidthProperty = property.value as number | undefined;
                    break;
                case GameMapProperties.OPEN_WEBSITE_POSITION:
                    websitePositionProperty = property.value as number | undefined;
                    break;
                case GameMapProperties.OPEN_WEBSITE_TRIGGER:
                    websiteTriggerProperty = property.value as string | undefined;
                    break;
                case GameMapProperties.OPEN_WEBSITE_TRIGGER_MESSAGE:
                    websiteTriggerMessageProperty = property.value as string | undefined;
                    break;
            }
        });

        if (!openWebsiteProperty) {
            return;
        }

        const actionId = "openWebsite-" + (Math.random() + 1).toString(36).substring(7);

        if (this.coWebsitesOpenByPlace.has(place)) {
            return;
        }

        const coWebsiteOpen: OpenCoWebsite = {
            actionId: actionId,
        };

        this.coWebsitesOpenByPlace.set(place, coWebsiteOpen);

        const loadCoWebsiteFunction = (coWebsite: CoWebsite) => {
            coWebsiteManager.loadCoWebsite(coWebsite).catch(() => {
                console.error("Error during loading a co-website: " + coWebsite.getUrl());
            });

            layoutManagerActionStore.removeAction(actionId);
        };

        const openCoWebsiteFunction = () => {
            const coWebsite = new SimpleCoWebsite(
                new URL(openWebsiteProperty ?? "", this.scene.MapUrlFile),
                allowApiProperty,
                websitePolicyProperty,
                websiteWidthProperty,
                false
            );

            coWebsiteOpen.coWebsite = coWebsite;

            coWebsiteManager.addCoWebsiteToStore(coWebsite, websitePositionProperty);

            loadCoWebsiteFunction(coWebsite);
        };

        if (localUserStore.getForceCowebsiteTrigger() || websiteTriggerProperty === ON_ACTION_TRIGGER_BUTTON) {
            if (!websiteTriggerMessageProperty) {
                websiteTriggerMessageProperty = get(LL).trigger.cowebsite();
            }

            this.coWebsitesActionTriggerByPlace.set(place, actionId);

            layoutManagerActionStore.addAction({
                uuid: actionId,
                type: "message",
                message: websiteTriggerMessageProperty,
                callback: () => openCoWebsiteFunction(),
                userInputManager: this.scene.userInputManager,
            });
        } else if (websiteTriggerProperty === ON_ICON_TRIGGER_BUTTON) {
            const coWebsite = new SimpleCoWebsite(
                new URL(openWebsiteProperty ?? "", this.scene.MapUrlFile),
                allowApiProperty,
                websitePolicyProperty,
                websiteWidthProperty,
                false
            );

            coWebsiteOpen.coWebsite = coWebsite;

            coWebsiteManager.addCoWebsiteToStore(coWebsite, websitePositionProperty);
        }

        if (!websiteTriggerProperty) {
            openCoWebsiteFunction();
        }
    }

    private handleFocusablePropertiesOnEnter(place: ITiledPlace): void {
        if (!place.properties) {
            return;
        }
        if (place.x === undefined || place.y === undefined || !place.height || !place.width) {
            return;
        }
        const focusable = place.properties.find((property) => property.name === GameMapProperties.FOCUSABLE);
        if (focusable && focusable.value === true) {
            const zoomMargin = place.properties.find((property) => property.name === GameMapProperties.ZOOM_MARGIN);
            this.scene.getCameraManager().enterFocusMode(
                {
                    x: place.x + place.width * 0.5,
                    y: place.y + place.height * 0.5,
                    width: place.width,
                    height: place.height,
                },
                zoomMargin ? Math.max(0, Number(zoomMargin.value)) : undefined
            );
        }
    }

    private handleOpenWebsitePropertiesOnLeave(place: ITiledPlace): void {
        if (!place.properties) {
            return;
        }

        let openWebsiteProperty: string | undefined;
        let websiteTriggerProperty: string | undefined;

        place.properties.forEach((property) => {
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

        const coWebsiteOpen = this.coWebsitesOpenByPlace.get(place);

        if (!coWebsiteOpen) {
            return;
        }

        const coWebsite = coWebsiteOpen.coWebsite;

        if (coWebsite) {
            coWebsiteManager.closeCoWebsite(coWebsite);
        }

        this.coWebsitesOpenByPlace.delete(place);

        if (!websiteTriggerProperty) {
            return;
        }

        const actionStore = get(layoutManagerActionStore);
        const actionTriggerUuid = this.coWebsitesActionTriggerByPlace.get(place);

        if (!actionTriggerUuid) {
            return;
        }

        const action =
            actionStore && actionStore.length > 0
                ? actionStore.find((action) => action.uuid === actionTriggerUuid)
                : undefined;

        if (action) {
            layoutManagerActionStore.removeAction(actionTriggerUuid);
        }

        this.coWebsitesActionTriggerByPlace.delete(place);
    }

    private handleFocusablePropertiesOnLeave(place: ITiledPlace): void {
        if (!place.properties) {
            return;
        }
        const focusable = place.properties.find((property) => property.name === GameMapProperties.FOCUSABLE);
        if (focusable && focusable.value === true) {
            this.scene.getCameraManager().leaveFocusMode(this.scene.CurrentPlayer, 1000);
        }
    }
}
