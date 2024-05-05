import {
    AreaData,
    AreaDataProperties,
    AreaDataProperty,
    FocusablePropertyData,
    JitsiRoomPropertyData,
    ListenerMegaphonePropertyData,
    OpenWebsitePropertyData,
    PersonalAreaAccessClaimMode,
    PersonalAreaPropertyData,
    PlayAudioPropertyData,
    SpeakerMegaphonePropertyData,
} from "@workadventure/map-editor";
import { getSpeakerMegaphoneAreaName } from "@workadventure/map-editor/src/Utils";
import { Jitsi } from "@workadventure/shared-utils";
import { slugify } from "@workadventure/shared-utils/src/Jitsi/slugify";
import { get } from "svelte/store";
import { LL } from "../../../../i18n/i18n-svelte";
import { analyticsClient } from "../../../Administration/AnalyticsClient";
import { iframeListener } from "../../../Api/IframeListener";
import { scriptUtils } from "../../../Api/ScriptUtils";
import { localUserStore } from "../../../Connection/LocalUserStore";
import { Room } from "../../../Connection/Room";
import { JITSI_PRIVATE_MODE, JITSI_URL } from "../../../Enum/EnvironmentVariable";
import { audioManagerFileStore, audioManagerVisibilityStore } from "../../../Stores/AudioManagerStore";
import { chatZoneLiveStore } from "../../../Stores/ChatStore";
/**
 * @DEPRECATED - This is the old way to show trigger message
import { layoutManagerActionStore } from "../../../Stores/LayoutManagerStore";
*/
import { inJitsiStore, inOpenWebsite, isSpeakerStore, silentStore } from "../../../Stores/MediaStore";
import { currentLiveStreamingNameStore } from "../../../Stores/MegaphoneStore";
import { notificationPlayingStore } from "../../../Stores/NotificationStore";
import type { CoWebsite } from "../../../WebRtc/CoWebsite/CoWebsite";
import { JitsiCoWebsite } from "../../../WebRtc/CoWebsite/JitsiCoWebsite";
import { SimpleCoWebsite } from "../../../WebRtc/CoWebsite/SimpleCoWebsite";
import { coWebsiteManager } from "../../../WebRtc/CoWebsiteManager";
import { ON_ACTION_TRIGGER_BUTTON, ON_ICON_TRIGGER_BUTTON } from "../../../WebRtc/LayoutManager";
import { gameManager } from "../GameManager";
import { OpenCoWebsite } from "../GameMapPropertiesListener";
import { GameScene } from "../GameScene";
import { mapEditorAskToClaimPersonalAreaStore } from "../../../Stores/MapEditorStore";
import { requestVisitCardsStore } from "../../../Stores/GameStore";
import { isMediaBreakpointUp } from "../../../Utils/BreakpointsUtils";

export class AreasPropertiesListener {
    private scene: GameScene;

    /**
     * Opened by Areas only, per property
     */
    private openedCoWebsites = new Map<string, OpenCoWebsite>();
    private coWebsitesActionTriggers = new Map<string, string>();

    private actionTriggerCallback: Map<string, () => void> = new Map<string, () => void>();

    constructor(scene: GameScene) {
        this.scene = scene;
    }

    public onEnterAreasHandler(areas: AreaData[]): void {
        for (const area of areas) {
            // analytics event for area
            analyticsClient.enterAreaMapEditor(area.id, area.name);

            if (!area.properties) {
                continue;
            }

            // Add new notification to show at the user that he entered a new area
            if (area.name && area.name !== "") {
                notificationPlayingStore.playNotification(area.name, "icon-tool-area.png");
            }
            for (const property of area.properties) {
                this.addPropertyFilter(property, area);
            }
        }
    }

    public onUpdateAreasHandler(
        area: AreaData,
        oldProperties: AreaDataProperties | undefined,
        newProperties: AreaDataProperties | undefined
    ): void {
        const propertiesTreated = new Set<string>();

        if (newProperties === undefined) {
            return;
        }

        if (oldProperties !== undefined) {
            for (const oldProperty of oldProperties) {
                const newProperty = newProperties.find((searchedProperty) => searchedProperty.id === oldProperty.id);

                if (JSON.stringify(oldProperty) === JSON.stringify(newProperty)) {
                    propertiesTreated.add(oldProperty.id);
                    continue;
                }

                if (newProperty === undefined) {
                    this.removePropertyFilter(oldProperty);
                } else {
                    this.updatePropertyFilter(oldProperty, newProperty, area);
                }

                propertiesTreated.add(oldProperty.id);
            }
        }

        for (const newProperty of newProperties) {
            if (propertiesTreated.has(newProperty.id)) {
                continue;
            }
            this.addPropertyFilter(newProperty, area);
        }
    }

    public onLeaveAreasHandler(areas: AreaData[]): void {
        for (const area of areas) {
            // analytics event for area
            analyticsClient.leaveAreaMapEditor(area.id, area.name);

            if (!area.properties) {
                continue;
            }
            for (const property of area.properties) {
                this.removePropertyFilter(property);
            }
        }
    }

    private addPropertyFilter(property: AreaDataProperty, area: AreaData) {
        switch (property.type) {
            case "openWebsite": {
                this.handleOpenWebsitePropertyOnEnter(property);
                break;
            }
            case "playAudio": {
                this.handlePlayAudioPropertyOnEnter(property);
                break;
            }
            case "focusable": {
                this.handleFocusablePropertiesOnEnter(area.x, area.y, area.width, area.height, property);
                break;
            }
            case "jitsiRoomProperty": {
                this.handleJitsiRoomPropertyOnEnter(property);
                break;
            }
            case "silent": {
                this.handleSilentPropertyOnEnter();
                break;
            }
            case "speakerMegaphone": {
                this.handleSpeakerMegaphonePropertyOnEnter(property);
                break;
            }
            case "listenerMegaphone": {
                this.handleListenerMegaphonePropertyOnEnter(property);
                break;
            }
            case "exit": {
                let url = `${property.url}`;
                if (property.areaName && property.areaName !== "") {
                    url = `${property.url}#${property.areaName}`;
                }
                this.handleExitPropertyOnEnter(url);
                break;
            }
            case "personalAreaPropertyData": {
                this.handlePersonalAreaPropertyOnEnter(property, area);

                break;
            }
            default: {
                break;
            }
        }
    }

    private updatePropertyFilter(oldProperty: AreaDataProperty, newProperty: AreaDataProperty, area: AreaData) {
        if (oldProperty.type !== newProperty.type) {
            throw new Error("Cannot update a property with a different type");
        }

        switch (oldProperty.type) {
            case "openWebsite": {
                newProperty = newProperty as typeof oldProperty;
                this.handleOpenWebsitePropertiesOnLeave(oldProperty);
                this.handleOpenWebsitePropertyOnEnter(newProperty);
                break;
            }
            case "playAudio": {
                newProperty = newProperty as typeof oldProperty;
                this.handlePlayAudioPropertyOnUpdate(newProperty);
                break;
            }
            case "focusable": {
                newProperty = newProperty as typeof oldProperty;
                this.handleFocusablePropertiesOnEnter(area.x, area.y, area.width, area.height, newProperty);
                break;
            }
            case "jitsiRoomProperty": {
                newProperty = newProperty as typeof oldProperty;
                this.handleJitsiRoomPropertyOnLeave(oldProperty);
                this.handleJitsiRoomPropertyOnEnter(newProperty);
                break;
            }
            case "speakerMegaphone": {
                newProperty = newProperty as typeof oldProperty;
                this.handleSpeakerMegaphonePropertyOnLeave(oldProperty);
                this.handleSpeakerMegaphonePropertyOnEnter(newProperty);
                break;
            }
            case "listenerMegaphone": {
                newProperty = newProperty as typeof oldProperty;
                this.handleListenerMegaphonePropertyOnLeave(oldProperty);
                this.handleListenerMegaphonePropertyOnEnter(newProperty);
                break;
            }
            case "exit": {
                newProperty = newProperty as typeof oldProperty;
                let url = `${newProperty.url}`;
                if (newProperty.areaName && newProperty.areaName !== "") {
                    url = `${newProperty.url}#${newProperty.areaName}`;
                }
                this.handleExitPropertyOnEnter(url);
                break;
            }
            case "personalAreaPropertyData": {
                newProperty = newProperty as typeof oldProperty;
                this.handlePersonalAreaPropertyOnLeave();
                this.handlePersonalAreaPropertyOnEnter(newProperty, area);
                break;
            }
            case "silent":
            default: {
                break;
            }
        }
    }

    private removePropertyFilter(property: AreaDataProperty) {
        switch (property.type) {
            case "openWebsite": {
                this.handleOpenWebsitePropertiesOnLeave(property);
                break;
            }
            case "playAudio": {
                this.handlePlayAudioPropertyOnLeave();
                break;
            }
            case "focusable": {
                this.handleFocusablePropertiesOnLeave(property);
                break;
            }
            case "jitsiRoomProperty": {
                this.handleJitsiRoomPropertyOnLeave(property);
                break;
            }
            case "silent": {
                this.handleSilentPropertyOnLeave();
                break;
            }
            case "speakerMegaphone": {
                this.handleSpeakerMegaphonePropertyOnLeave(property);
                break;
            }
            case "listenerMegaphone": {
                this.handleListenerMegaphonePropertyOnLeave(property);
                break;
            }
            case "personalAreaPropertyData": {
                this.handlePersonalAreaPropertyOnLeave();
                break;
            }
            default: {
                break;
            }
        }
    }

    private handlePlayAudioPropertyOnEnter(property: PlayAudioPropertyData): void {
        // playAudioLoop is supposedly deprecated. Should we ignore it?
        audioManagerFileStore.playAudio(property.audioLink, this.scene.getMapUrl(), property.volume);
        audioManagerVisibilityStore.set(true);
    }

    private handleOpenWebsitePropertyOnEnter(property: OpenWebsitePropertyData): void {
        if (!property.link) {
            return;
        }

        const actionId = "openWebsite-" + (Math.random() + 1).toString(36).substring(7);

        if (property.newTab) {
            const forceTrigger = localUserStore.getForceCowebsiteTrigger();
            if (forceTrigger || property.trigger === ON_ACTION_TRIGGER_BUTTON) {
                this.coWebsitesActionTriggers.set(property.id, actionId);
                let message = property.triggerMessage;
                if (message === undefined) {
                    message = isMediaBreakpointUp("md") ? get(LL).trigger.mobile.newTab() : get(LL).trigger.newTab();
                }

                // Create callback and play text message
                const callback = () => {
                    scriptUtils.openTab(property.link as string), this.scene.CurrentPlayer.destroyText(actionId);
                    this.scene.userInputManager.removeSpaceEventListener(callback);
                    this.actionTriggerCallback.delete(actionId);
                };
                this.scene.CurrentPlayer.playText(actionId, `${message}`, -1, callback);
                this.scene.userInputManager?.addSpaceEventListener(callback);
                this.actionTriggerCallback.set(actionId, callback);

                /**
                 * @DEPRECATED - This is the old way to show trigger message
                layoutManagerActionStore.addAction({
                    uuid: actionId,
                    type: "message",
                    message: message,
                    callback: () => scriptUtils.openTab(property.link as string),
                    userInputManager: this.scene.userInputManager,
                });
                */
            } else {
                scriptUtils.openTab(property.link);
            }
            return;
        }

        if (this.openedCoWebsites.has(property.id)) {
            return;
        }

        const coWebsiteOpen: OpenCoWebsite = {
            actionId: actionId,
        };

        this.openedCoWebsites.set(property.id, coWebsiteOpen);

        if (localUserStore.getForceCowebsiteTrigger() || property.trigger === ON_ACTION_TRIGGER_BUTTON) {
            let message = property.triggerMessage;
            if (!message) {
                message = isMediaBreakpointUp("md") ? get(LL).trigger.mobile.cowebsite() : get(LL).trigger.cowebsite();
            }

            this.coWebsitesActionTriggers.set(property.id, actionId);

            // Create callback and play text message
            const callback = () => {
                this.openCoWebsiteFunction(property, coWebsiteOpen, actionId);
                this.scene.CurrentPlayer.destroyText(actionId);
                this.scene.userInputManager.removeSpaceEventListener(callback);
                this.actionTriggerCallback.delete(actionId);
            };
            this.scene.CurrentPlayer.playText(actionId, `${message}`, -1, callback);
            this.scene.userInputManager?.addSpaceEventListener(callback);
            this.actionTriggerCallback.set(actionId, callback);

            /**
             * @DEPRECATED - This is the old way to show trigger message
            layoutManagerActionStore.addAction({
                uuid: actionId,
                type: "message",
                message: message,
                callback: () => this.openCoWebsiteFunction(property, coWebsiteOpen, actionId),
                userInputManager: this.scene.userInputManager,
            });
             */
        } else if (property.trigger === ON_ICON_TRIGGER_BUTTON) {
            const coWebsite = new SimpleCoWebsite(
                new URL(property.link ?? "", this.scene.mapUrlFile),
                property.allowAPI,
                property.policy,
                property.width,
                property.closable
            );

            coWebsiteOpen.coWebsite = coWebsite;

            coWebsiteManager.addCoWebsiteToStore(coWebsite, property.position);

            //user in zone to open cowesite with only icon
            inOpenWebsite.set(true);
        }

        if (!property.trigger) {
            this.openCoWebsiteFunction(property, coWebsiteOpen, actionId);
        }
    }

    private handleFocusablePropertiesOnEnter(
        x: number,
        y: number,
        width: number,
        height: number,
        property: FocusablePropertyData
    ): void {
        const zoomMargin = property.zoom_margin ? Math.max(0, property.zoom_margin) : undefined;
        this.scene.getCameraManager().enterFocusMode(
            {
                x: x + width * 0.5,
                y: y + height * 0.5,
                width,
                height,
            },
            zoomMargin
        );
    }

    private handleJitsiRoomPropertyOnEnter(property: JitsiRoomPropertyData): void {
        const openJitsiRoomFunction = async () => {
            const roomName = Jitsi.slugifyJitsiRoomName(property.roomName, this.scene.roomUrl, property.noPrefix);
            let jitsiUrl = property.jitsiUrl;

            let jwt: string | undefined;
            if (JITSI_PRIVATE_MODE && !jitsiUrl) {
                if (!this.scene.connection) {
                    console.info("Cannot connect to Jitsi. No connection to Pusher server.");
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

            const coWebsite = new JitsiCoWebsite(
                new URL(domain),
                property.width,
                property.closable,
                roomName,
                gameManager.getPlayerName() ?? "unknown",
                jwt,
                property.jitsiRoomConfig,
                undefined,
                domainWithoutProtocol
            );

            coWebsiteManager.addCoWebsiteToStore(coWebsite, 0);

            coWebsiteManager.loadCoWebsite(coWebsite).catch((err) => {
                console.error(err);
            });

            analyticsClient.enteredJitsi(roomName, this.scene.roomUrl);

            this.scene.CurrentPlayer.destroyText("jitsi");
            const callback = this.actionTriggerCallback.get("jitsi");
            if (callback) {
                this.scene.userInputManager.removeSpaceEventListener(callback);
                this.actionTriggerCallback.delete("jitsi");
            }
            /**
             * @DEPRECATED - This is the old way to show trigger message
            layoutManagerActionStore.removeAction("jitsi");
            */
        };

        const jitsiTriggerValue = property.trigger;
        const forceTrigger = localUserStore.getForceCowebsiteTrigger();
        if (forceTrigger || jitsiTriggerValue === ON_ACTION_TRIGGER_BUTTON) {
            let message = property.triggerMessage;
            if (message === undefined) {
                message = isMediaBreakpointUp("md") ? get(LL).trigger.mobile.jitsiRoom() : get(LL).trigger.jitsiRoom();
            }

            // Create callback and play text message
            const callback = () => {
                openJitsiRoomFunction().catch((e) => console.error(e));
                this.scene.CurrentPlayer.destroyText("jitsi");
                this.scene.userInputManager.removeSpaceEventListener(callback);
                this.actionTriggerCallback.delete("jitsi");
            };
            this.scene.CurrentPlayer.playText("jitsi", `${message}`, -1, callback);
            this.scene.userInputManager?.addSpaceEventListener(callback);
            this.actionTriggerCallback.set("jitsi", callback);

            /**
             * @DEPRECATED - This is the old way to show trigger message
            layoutManagerActionStore.addAction({
                uuid: "jitsi",
                type: "message",
                message: message,
                callback: () => {
                    openJitsiRoomFunction().catch((e) => console.error(e));
                },
                userInputManager: this.scene.userInputManager,
            });
             */
        } else {
            openJitsiRoomFunction().catch((e) => console.error(e));
        }
    }

    private handlePersonalAreaPropertyOnEnter(property: PersonalAreaPropertyData, areaData: AreaData): void {
        if (property.ownerId !== null) {
            this.displayPersonalAreaOwnerVisitCard(property.ownerId);
        } else if (property.accessClaimMode === PersonalAreaAccessClaimMode.enum.dynamic) {
            this.displayPersonalAreaClaimDialogBox(property, areaData);
        }
    }

    private displayPersonalAreaOwnerVisitCard(ownerId: string) {
        const connectedUserUUID = localUserStore.getLocalUser()?.uuid;
        if (connectedUserUUID != ownerId) {
            const connection = this.scene.connection;
            if (connection) {
                connection
                    .queryMember(ownerId)
                    .then((member) => {
                        if (member?.visitCardUrl) {
                            requestVisitCardsStore.set(member.visitCardUrl);
                        }
                    })
                    .catch((error) => console.error(error));
            }
        }
    }

    private displayPersonalAreaClaimDialogBox(property: PersonalAreaPropertyData, areaData: AreaData) {
        const userHasAllowedTagToClaimTheArea =
            localUserStore.isLogged() &&
            (property.allowedTags.length === 0 ||
                property.allowedTags.some((tag) => this.scene.connection?.hasTag(tag)));
        if (userHasAllowedTagToClaimTheArea) {
            mapEditorAskToClaimPersonalAreaStore.set(areaData);
        }
    }

    private handleSilentPropertyOnEnter(): void {
        silentStore.setAreaSilent(true);
    }

    private handleOpenWebsitePropertiesOnLeave(property: OpenWebsitePropertyData): void {
        const openWebsiteProperty: string | null = property.link;
        const websiteTriggerProperty: string | undefined = property.trigger;

        if (!openWebsiteProperty) {
            return;
        }

        const coWebsiteOpen = this.openedCoWebsites.get(property.id);

        if (coWebsiteOpen) {
            const coWebsite = coWebsiteOpen.coWebsite;

            if (coWebsite) {
                coWebsiteManager.closeCoWebsite(coWebsite);
            }
        }

        this.openedCoWebsites.delete(property.id);

        inOpenWebsite.set(false);

        if (!websiteTriggerProperty) {
            return;
        }

        const actionTriggerUuid = this.coWebsitesActionTriggers.get(property.id);
        if (!actionTriggerUuid) {
            return;
        }

        this.scene.CurrentPlayer.destroyText(actionTriggerUuid);
        const callback = this.actionTriggerCallback.get(actionTriggerUuid);
        if (callback) {
            this.scene.userInputManager.removeSpaceEventListener(callback);
            this.actionTriggerCallback.delete(actionTriggerUuid);
        }

        /**
        * @DEPRECATED - This is the old way to show trigger message
        const actionStore = get(layoutManagerActionStore);
        const action =
            actionStore && actionStore.length > 0
                ? actionStore.find((action) => action.uuid === actionTriggerUuid)
                : undefined;

        if (action) {
            layoutManagerActionStore.removeAction(actionTriggerUuid);
        }
        */

        this.coWebsitesActionTriggers.delete(property.id);
    }

    private handleFocusablePropertiesOnLeave(property: FocusablePropertyData): void {
        if (!property) {
            return;
        }
        this.scene.getCameraManager().leaveFocusMode(this.scene.CurrentPlayer, 1000);
    }

    private handleSilentPropertyOnLeave(): void {
        silentStore.setAreaSilent(false);
    }

    private handlePlayAudioPropertyOnLeave(): void {
        audioManagerFileStore.unloadAudio();
        audioManagerVisibilityStore.set(false);
    }

    private handlePlayAudioPropertyOnUpdate(newProperty: PlayAudioPropertyData): void {
        audioManagerFileStore.unloadAudio();
        audioManagerFileStore.playAudio(newProperty.audioLink, this.scene.getMapUrl(), newProperty.volume);
    }

    private handleJitsiRoomPropertyOnLeave(property: JitsiRoomPropertyData): void {
        this.scene.CurrentPlayer.destroyText("jitsi");
        const callback = this.actionTriggerCallback.get("jitsi");
        if (callback) {
            this.scene.userInputManager.removeSpaceEventListener(callback);
            this.actionTriggerCallback.delete("jitsi");
        }
        /**
         * @DEPRECATED - This is the old way to show trigger message
        layoutManagerActionStore.removeAction("jitsi");
        */
        coWebsiteManager.getCoWebsites().forEach((coWebsite) => {
            if (coWebsite instanceof JitsiCoWebsite) {
                coWebsiteManager.closeCoWebsite(coWebsite);
            }
        });
        inJitsiStore.set(false);
    }

    private handlePersonalAreaPropertyOnLeave(): void {
        mapEditorAskToClaimPersonalAreaStore.set(undefined);
        if (get(requestVisitCardsStore)) {
            requestVisitCardsStore.set(null);
        }
    }

    private openCoWebsiteFunction(
        property: OpenWebsitePropertyData,
        coWebsiteOpen: OpenCoWebsite,
        actionId: string
    ): void {
        const url = new URL(property.link ?? "", this.scene.mapUrlFile);
        const coWebsite = new SimpleCoWebsite(
            url,
            property.allowAPI,
            property.policy,
            property.width,
            property.closable
        );

        coWebsiteOpen.coWebsite = coWebsite;

        coWebsiteManager.addCoWebsiteToStore(coWebsite, property.position);

        this.loadCoWebsiteFunction(coWebsite, actionId);

        //user in a zone with cowebsite opened or pressed SPACE to enter is a zone
        inOpenWebsite.set(true);

        // analytics event for open website
        analyticsClient.openedWebsite(url);
    }

    private loadCoWebsiteFunction(coWebsite: CoWebsite, actionId: string): void {
        coWebsiteManager.loadCoWebsite(coWebsite).catch(() => {
            console.error("Error during loading a co-website: " + coWebsite.getUrl());
        });

        this.scene.CurrentPlayer.destroyText(actionId);
        const callback = this.actionTriggerCallback.get(actionId);
        if (callback) {
            this.scene.userInputManager.removeSpaceEventListener(callback);
            this.actionTriggerCallback.delete(actionId);
        }
        /**
         * @DEPRECATED - This is the old way to show trigger message
        layoutManagerActionStore.removeAction(actionId);
        */
    }

    private handleSpeakerMegaphonePropertyOnEnter(property: SpeakerMegaphonePropertyData): void {
        if (property.name !== undefined && property.id !== undefined) {
            const uniqRoomName = Jitsi.slugifyJitsiRoomName(property.name, this.scene.roomUrl);
            // TODO remove this console.log after testing
            console.info("handleSpeakerMegaphonePropertyOnEnter => joinSpace => uniqRoomName : ", uniqRoomName);
            currentLiveStreamingNameStore.set(uniqRoomName);
            this.scene.broadcastService.joinSpace(uniqRoomName, false);
            isSpeakerStore.set(true);
            //requestedMegaphoneStore.set(true);
            if (property.chatEnabled) {
                this.handleJoinMucRoom(uniqRoomName, "live");
            }
        }
    }

    private handleSpeakerMegaphonePropertyOnLeave(property: SpeakerMegaphonePropertyData): void {
        if (property.name !== undefined && property.id !== undefined) {
            isSpeakerStore.set(false);
            const uniqRoomName = Jitsi.slugifyJitsiRoomName(property.name, this.scene.roomUrl);
            currentLiveStreamingNameStore.set(undefined);
            this.scene.broadcastService.leaveSpace(uniqRoomName);
            if (property.chatEnabled) {
                this.handleLeaveMucRoom(uniqRoomName);
            }
        }
    }

    private handleListenerMegaphonePropertyOnEnter(property: ListenerMegaphonePropertyData): void {
        if (property.speakerZoneName !== undefined) {
            const speakerZoneName = getSpeakerMegaphoneAreaName(
                this.scene.getGameMap().getGameMapAreas()?.getAreas(),
                property.speakerZoneName
            );
            if (speakerZoneName) {
                const uniqRoomName = Jitsi.slugifyJitsiRoomName(speakerZoneName, this.scene.roomUrl);
                // TODO remove this log after testing
                console.info("handleListenerMegaphonePropertyOnEnter => joinSpace => uniqRoomName", uniqRoomName);
                currentLiveStreamingNameStore.set(uniqRoomName);
                this.scene.broadcastService.joinSpace(uniqRoomName, false);
                if (property.chatEnabled) {
                    this.handleJoinMucRoom(uniqRoomName, "live");
                }
            }
        }
    }

    private handleListenerMegaphonePropertyOnLeave(property: ListenerMegaphonePropertyData): void {
        if (property.speakerZoneName !== undefined) {
            const speakerZoneName = getSpeakerMegaphoneAreaName(
                this.scene.getGameMap().getGameMapAreas()?.getAreas(),
                property.speakerZoneName
            );
            if (speakerZoneName) {
                const uniqRoomName = Jitsi.slugifyJitsiRoomName(speakerZoneName, this.scene.roomUrl);
                // TODO remove this log after testing
                console.info("handleListenerMegaphonePropertyOnLeave => uniqRoomName", uniqRoomName);
                currentLiveStreamingNameStore.set(undefined);
                this.scene.broadcastService.leaveSpace(uniqRoomName);
                if (property.chatEnabled) {
                    this.handleLeaveMucRoom(uniqRoomName);
                }
            }
        }
    }

    private handleJoinMucRoom(name: string, type: string) {
        iframeListener.sendJoinMucEventToChatIframe(`${this.scene.roomUrl}/${slugify(name)}`, name, type, false);
        chatZoneLiveStore.set(true);
    }

    private handleLeaveMucRoom(name: string) {
        iframeListener.sendLeaveMucEventToChatIframe(`${this.scene.roomUrl}/${slugify(name)}`);
        chatZoneLiveStore.set(false);
    }

    private handleExitPropertyOnEnter(url: string): void {
        this.scene
            .onMapExit(Room.getRoomPathFromExitUrl(url, window.location.toString()))
            .catch((e) => console.error(e));
    }
}
