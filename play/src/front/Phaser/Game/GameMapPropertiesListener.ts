import { get } from "svelte/store";
import type { ITiledMapLayer, ITiledMapObject } from "@workadventure/tiled-map-type-guard";
import { GameMapProperties } from "@workadventure/map-editor";
import { Jitsi } from "@workadventure/shared-utils";
import { scriptUtils } from "../../Api/ScriptUtils";
import { coWebsiteManager } from "../../WebRtc/CoWebsiteManager";
import { layoutManagerActionStore } from "../../Stores/LayoutManagerStore";
import { localUserStore } from "../../Connexion/LocalUserStore";
import { ON_ACTION_TRIGGER_BUTTON, ON_ICON_TRIGGER_BUTTON } from "../../WebRtc/LayoutManager";
import type { CoWebsite } from "../../WebRtc/CoWebsite/CoWesbite";
import { SimpleCoWebsite } from "../../WebRtc/CoWebsite/SimpleCoWebsite";
import { bbbFactory } from "../../WebRtc/BBBFactory";
import { JITSI_PRIVATE_MODE, JITSI_URL } from "../../Enum/EnvironmentVariable";
import { JitsiCoWebsite } from "../../WebRtc/CoWebsite/JitsiCoWebsite";
import { audioManagerFileStore, audioManagerVisibilityStore } from "../../Stores/AudioManagerStore";
import { iframeListener } from "../../Api/IframeListener";
import { Room } from "../../Connexion/Room";
import { LL } from "../../../i18n/i18n-svelte";
import { inJitsiStore, inBbbStore, silentStore, inOpenWebsite } from "../../Stores/MediaStore";
import { urlManager } from "../../Url/UrlManager";
import { chatZoneLiveStore } from "../../Stores/ChatStore";
import { connectionManager } from "../../Connexion/ConnectionManager";
import { analyticsClient } from "./../../Administration/AnalyticsClient";
import type { GameMapFrontWrapper } from "./GameMap/GameMapFrontWrapper";
import type { GameScene } from "./GameScene";

interface OpenCoWebsite {
    actionId: string;
    coWebsite?: CoWebsite;
}

// NOTE: We need to change id type to fit both ITiledMapObjects and UUID's from MapEditor
export type ITiledPlace = Omit<ITiledMapLayer | ITiledMapObject, "id"> & { id?: string | number };

export class GameMapPropertiesListener {
    private coWebsitesOpenByPlace = new Map<string, OpenCoWebsite>();
    private coWebsitesActionTriggerByPlace = new Map<string, string>();

    constructor(private scene: GameScene, private gameMapFrontWrapper: GameMapFrontWrapper) {}

    register() {
        // Website on new tab
        this.gameMapFrontWrapper.onPropertyChange(GameMapProperties.OPEN_TAB, (newValue, oldValue, allProps) => {
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
        this.gameMapFrontWrapper.onPropertyChange(GameMapProperties.JITSI_ROOM, (newValue, oldValue, allProps) => {
            if (newValue === undefined || newValue !== oldValue) {
                layoutManagerActionStore.removeAction("jitsi");
                coWebsiteManager.getCoWebsites().forEach((coWebsite) => {
                    if (coWebsite instanceof JitsiCoWebsite) {
                        coWebsiteManager.closeCoWebsite(coWebsite);
                    }
                });
                inJitsiStore.set(false);
                if (newValue === undefined) {
                    return;
                }
            }
            const openJitsiRoomFunction = async () => {
                const roomName = Jitsi.slugifyJitsiRoomName(newValue.toString(), this.scene.roomUrl, allProps);
                let jitsiUrl = allProps.get(GameMapProperties.JITSI_URL) as string | undefined;

                let jwt: string | undefined;
                if (JITSI_PRIVATE_MODE && !jitsiUrl) {
                    if (!this.scene.connection) {
                        console.log("Cannot connect to Jitsi. No connection to Pusher server.");
                        return;
                    }
                    const answer = await this.scene.connection.queryJitsiJwtToken(roomName);
                    jwt = answer.jwt;
                    jitsiUrl = answer.url;
                }

                let domain = jitsiUrl || JITSI_URL;
                if (domain === undefined) {
                    throw new Error("Missing JITSI_URL environment variable or jitsiUrl parameter in the map.");
                }

                let domainWithoutProtocol = domain;
                if (domain.substring(0, 7) !== "http://" && domain.substring(0, 8) !== "https://") {
                    domainWithoutProtocol = domain;
                    domain = `${location.protocol}//${domain}`;
                } else {
                    if (domain.startsWith("http://")) {
                        domainWithoutProtocol = domain.substring(7);
                    } else {
                        domainWithoutProtocol = domain.substring(8);
                    }
                }

                inJitsiStore.set(true);

                // TODO create new property to allow to close the jitsi room
                //const closable = allProps.get(GameMapProperties.OPEN_WEBSITE_CLOSABLE) as boolean | undefined;

                const coWebsite = new JitsiCoWebsite(new URL(domain), false, undefined, undefined, true);

                coWebsiteManager.addCoWebsiteToStore(coWebsite, 0);
                this.scene.initialiseJitsi(coWebsite, roomName, jwt, domainWithoutProtocol);

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
                        openJitsiRoomFunction().catch((e) => console.error(e));
                    },
                    userInputManager: this.scene.userInputManager,
                });
            } else {
                openJitsiRoomFunction().catch((e) => console.error(e));
            }
        });

        this.gameMapFrontWrapper.onPropertyChange(GameMapProperties.BBB_MEETING, (newValue, oldValue, allProps) => {
            if (newValue === undefined || newValue !== oldValue) {
                layoutManagerActionStore.removeAction("bbbMeeting");
                inBbbStore.set(false);
                bbbFactory.setStopped(true);
                bbbFactory.stop();
                if (newValue === undefined) {
                    return;
                }
            }
            inBbbStore.set(true);
            bbbFactory.setStopped(false);
            bbbFactory
                .parametrizeMeetingId(newValue as string)
                .then((hashedMeetingId) => {
                    if (this.scene.connection === undefined) {
                        throw new Error("No more connection to open BBB");
                    }
                    return this.scene.connection.queryBBBMeetingUrl(hashedMeetingId, allProps);
                })
                .then((bbbAnswer) => {
                    bbbFactory.start(bbbAnswer.clientURL);
                })
                .catch((e) => console.error(e));
        });

        this.gameMapFrontWrapper.onPropertyChange(GameMapProperties.EXIT_SCENE_URL, (newValue) => {
            if (newValue) {
                this.scene
                    .onMapExit(
                        Room.getRoomPathFromExitSceneUrl(
                            newValue as string,
                            window.location.toString(),
                            this.scene.mapUrlFile
                        )
                    )
                    .catch((e) => console.error(e));
            } else {
                setTimeout(() => {
                    layoutManagerActionStore.removeAction("roomAccessDenied");
                }, 2000);
            }
        });

        this.gameMapFrontWrapper.onPropertyChange(GameMapProperties.EXIT_URL, (newValue) => {
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

        this.gameMapFrontWrapper.onPropertyChange(GameMapProperties.SILENT, (newValue) => {
            if (newValue === undefined || newValue === false || newValue === "") {
                silentStore.set(false);
            } else {
                silentStore.set(true);
            }
        });

        this.gameMapFrontWrapper.onPropertyChange(GameMapProperties.PLAY_AUDIO, (newValue, oldValue, allProps) => {
            const volume = allProps.get(GameMapProperties.AUDIO_VOLUME) as number | undefined;
            const loop = allProps.get(GameMapProperties.AUDIO_LOOP) as boolean | undefined;
            newValue === undefined
                ? audioManagerFileStore.unloadAudio()
                : audioManagerFileStore.playAudio(newValue, this.scene.getMapDirUrl(), volume, loop);
            audioManagerVisibilityStore.set(!(newValue === undefined));
        });

        // TODO: This legacy property should be removed at some point
        this.gameMapFrontWrapper.onPropertyChange(GameMapProperties.PLAY_AUDIO_LOOP, (newValue) => {
            newValue === undefined
                ? audioManagerFileStore.unloadAudio()
                : audioManagerFileStore.playAudio(newValue, this.scene.getMapDirUrl(), undefined, true);
            audioManagerVisibilityStore.set(!(newValue === undefined));
        });

        // TODO: Legacy functionnality replace by layer change
        this.gameMapFrontWrapper.onPropertyChange(GameMapProperties.ZONE, (newValue, oldValue) => {
            if (oldValue) {
                iframeListener.sendLeaveEvent(oldValue as string);
            }
            if (newValue) {
                iframeListener.sendEnterEvent(newValue as string);
            }
        });

        // Muc zone
        this.gameMapFrontWrapper.onPropertyChange(GameMapProperties.CHAT_NAME, (newValue, oldValue, allProps) => {
            if (!connectionManager.currentRoom) {
                throw new Error("Race condition : Current room is not defined yet");
            } else if (!connectionManager.currentRoom.enableChat) {
                return;
            }

            const playUri = urlManager.getPlayUri() + "/";

            if (oldValue !== undefined) {
                iframeListener.sendLeaveMucEventToChatIframe(playUri + oldValue);
                chatZoneLiveStore.set(false);
            }
            if (newValue !== undefined) {
                iframeListener.sendJoinMucEventToChatIframe(playUri + newValue, newValue.toString(), "live", false);
                chatZoneLiveStore.set(true);
            }
        });

        this.gameMapFrontWrapper.onEnterLayer((newLayers) => {
            this.onEnterPlaceHandler(newLayers);
        });

        this.gameMapFrontWrapper.onLeaveLayer((oldLayers) => {
            this.onLeavePlaceHandler(oldLayers);
        });

        this.gameMapFrontWrapper.onEnterTiledArea((newTiledAreas) => {
            this.onEnterPlaceHandler(newTiledAreas);
        });

        this.gameMapFrontWrapper.onLeaveTiledArea((oldTiledAreas) => {
            this.onLeavePlaceHandler(oldTiledAreas);
        });

        this.gameMapFrontWrapper.onEnterArea((newAreas) => {
            this.onEnterPlaceHandler(newAreas.map((area) => this.gameMapFrontWrapper.mapAreaToTiledObject(area)));
        });

        this.gameMapFrontWrapper.onLeaveArea((oldAreas) => {
            this.onLeavePlaceHandler(oldAreas.map((area) => this.gameMapFrontWrapper.mapAreaToTiledObject(area)));
        });

        this.gameMapFrontWrapper.onEnterDynamicArea((newAreas) => {
            this.onEnterPlaceHandler(
                newAreas.map((area) => this.gameMapFrontWrapper.mapDynamicAreaToTiledObject(area))
            );
        });

        this.gameMapFrontWrapper.onLeaveDynamicArea((oldAreas) => {
            this.onLeavePlaceHandler(
                oldAreas.map((area) => this.gameMapFrontWrapper.mapDynamicAreaToTiledObject(area))
            );
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
        let websiteClosableProperty: boolean | undefined;

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
                case GameMapProperties.OPEN_WEBSITE_CLOSABLE:
                    websiteClosableProperty = property.value as boolean | undefined;
                    break;
            }
        });

        if (!openWebsiteProperty) {
            return;
        }

        const actionId = "openWebsite-" + (Math.random() + 1).toString(36).substring(7);

        if (this.coWebsitesOpenByPlace.has(this.getIdFromPlace(place))) {
            return;
        }

        const coWebsiteOpen: OpenCoWebsite = {
            actionId: actionId,
        };

        this.coWebsitesOpenByPlace.set(this.getIdFromPlace(place), coWebsiteOpen);

        const loadCoWebsiteFunction = (coWebsite: CoWebsite) => {
            coWebsiteManager.loadCoWebsite(coWebsite).catch(() => {
                console.error("Error during loading a co-website: " + coWebsite.getUrl());
            });

            layoutManagerActionStore.removeAction(actionId);
        };

        const openCoWebsiteFunction = () => {
            const coWebsite = new SimpleCoWebsite(
                new URL(openWebsiteProperty ?? "", this.scene.mapUrlFile),
                allowApiProperty,
                websitePolicyProperty,
                websiteWidthProperty,
                websiteClosableProperty
            );

            coWebsiteOpen.coWebsite = coWebsite;

            coWebsiteManager.addCoWebsiteToStore(coWebsite, websitePositionProperty);

            loadCoWebsiteFunction(coWebsite);

            //user in a zone with cowebsite opened or pressed SPACE to enter is a zone
            inOpenWebsite.set(true);

            // analytics event for open website
            analyticsClient.openedWebsite();
        };

        if (localUserStore.getForceCowebsiteTrigger() || websiteTriggerProperty === ON_ACTION_TRIGGER_BUTTON) {
            if (!websiteTriggerMessageProperty) {
                websiteTriggerMessageProperty = get(LL).trigger.cowebsite();
            }

            this.coWebsitesActionTriggerByPlace.set(this.getIdFromPlace(place), actionId);

            layoutManagerActionStore.addAction({
                uuid: actionId,
                type: "message",
                message: websiteTriggerMessageProperty,
                callback: () => openCoWebsiteFunction(),
                userInputManager: this.scene.userInputManager,
            });
        } else if (websiteTriggerProperty === ON_ICON_TRIGGER_BUTTON) {
            const coWebsite = new SimpleCoWebsite(
                new URL(openWebsiteProperty ?? "", this.scene.mapUrlFile),
                allowApiProperty,
                websitePolicyProperty,
                websiteWidthProperty,
                websiteClosableProperty
            );

            coWebsiteOpen.coWebsite = coWebsite;

            coWebsiteManager.addCoWebsiteToStore(coWebsite, websitePositionProperty);

            //user in zone to open cowesite with only icone
            inOpenWebsite.set(true);
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
            const zoomMargin = place.properties.find((property) =>
                [GameMapProperties.ZOOM_MARGIN, "zoom_margin"].includes(property.name)
            );
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

        const coWebsiteOpen = this.coWebsitesOpenByPlace.get(this.getIdFromPlace(place));

        if (!coWebsiteOpen) {
            return;
        }

        const coWebsite = coWebsiteOpen.coWebsite;

        if (coWebsite) {
            coWebsiteManager.closeCoWebsite(coWebsite);
        }

        this.coWebsitesOpenByPlace.delete(this.getIdFromPlace(place));

        inOpenWebsite.set(false);

        if (!websiteTriggerProperty) {
            return;
        }

        const actionStore = get(layoutManagerActionStore);
        const actionTriggerUuid = this.coWebsitesActionTriggerByPlace.get(this.getIdFromPlace(place));

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

        this.coWebsitesActionTriggerByPlace.delete(this.getIdFromPlace(place));
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

    private getIdFromPlace(place: ITiledPlace): string {
        return `${place.name}:${place.type ?? ""}:${place.id ?? 0}`;
    }
}
