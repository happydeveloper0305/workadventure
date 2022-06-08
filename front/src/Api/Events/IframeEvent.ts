import { z } from "zod";
import { isChatEvent } from "./ChatEvent";
import { isClosePopupEvent } from "./ClosePopupEvent";
import { isGoToPageEvent } from "./GoToPageEvent";
import { isLoadPageEvent } from "./LoadPageEvent";
import { isCoWebsite, isOpenCoWebsiteEvent } from "./OpenCoWebsiteEvent";
import { isOpenPopupEvent } from "./OpenPopupEvent";
import { isOpenTabEvent } from "./OpenTabEvent";
import { isLayerEvent } from "./LayerEvent";
import { isSetPropertyEvent } from "./SetPropertyEvent";
import { isLoadSoundEvent } from "./LoadSoundEvent";
import { isPlaySoundEvent } from "./PlaySoundEvent";
import { isStopSoundEvent } from "./StopSoundEvent";
import { isSetTilesEvent } from "./SetTilesEvent";
import { isGameStateEvent } from "./GameStateEvent";
import { isMapDataEvent } from "./MapDataEvent";
import { isSetVariableEvent } from "./SetVariableEvent";
import { isCreateEmbeddedWebsiteEvent, isEmbeddedWebsiteEvent } from "./EmbeddedWebsiteEvent";
import { isLoadTilesetEvent } from "./LoadTilesetEvent";
import { isMessageReferenceEvent, isTriggerActionMessageEvent } from "./ui/TriggerActionMessageEvent";
import { isMenuRegisterEvent, isUnregisterMenuEvent } from "./ui/MenuRegisterEvent";
import { isPlayerPosition } from "./PlayerPosition";
import { isCameraSetEvent } from "./CameraSetEvent";
import { isCameraFollowPlayerEvent } from "./CameraFollowPlayerEvent";
import { isColorEvent } from "./ColorEvent";
import { isMovePlayerToEventConfig } from "./MovePlayerToEvent";
import { isMovePlayerToEventAnswer } from "./MovePlayerToEventAnswer";
import { isAddActionsMenuKeyToRemotePlayerEvent } from "./AddActionsMenuKeyToRemotePlayerEvent";
import { isRemoveActionsMenuKeyFromRemotePlayerEvent } from "./RemoveActionsMenuKeyFromRemotePlayerEvent";
import { isSetAreaPropertyEvent } from "./SetAreaPropertyEvent";
import { isCreateUIWebsiteEvent, isModifyUIWebsiteEvent, isUIWebsite } from "./ui/UIWebsite";
import { isAreaEvent, isCreateAreaEvent } from "./CreateAreaEvent";
import { isUserInputChatEvent } from "./UserInputChatEvent";
import { isEnterLeaveEvent } from "./EnterLeaveEvent";
import { isChangeLayerEvent } from "./ChangeLayerEvent";
import { isChangeAreaEvent } from "./ChangeAreaEvent";
import { isButtonClickedEvent } from "./ButtonClickedEvent";
import { isRemotePlayerClickedEvent } from "./RemotePlayerClickedEvent";
import { isActionsMenuActionClickedEvent } from "./ActionsMenuActionClickedEvent";
import { isHasPlayerMovedEvent } from "./HasPlayerMovedEvent";
import { isWasCameraUpdatedEvent } from "./WasCameraUpdatedEvent";
import { isMenuItemClickedEvent } from "./ui/MenuItemClickedEvent";

export interface TypedMessageEvent<T> extends MessageEvent {
    data: T;
}

/**
 * List event types sent from an iFrame to WorkAdventure
 */
export const isIframeEventWrapper = z.union([
    z.object({
        type: z.literal("addActionsMenuKeyToRemotePlayer"),
        data: isAddActionsMenuKeyToRemotePlayerEvent,
    }),
    z.object({
        type: z.literal("removeActionsMenuKeyFromRemotePlayer"),
        data: isRemoveActionsMenuKeyFromRemotePlayerEvent,
    }),
    z.object({
        type: z.literal("loadPage"),
        data: isLoadPageEvent,
    }),
    z.object({
        type: z.literal("chat"),
        data: isChatEvent,
    }),
    z.object({
        type: z.literal("cameraFollowPlayer"),
        data: isCameraFollowPlayerEvent,
    }),
    z.object({
        type: z.literal("cameraSet"),
        data: isCameraSetEvent,
    }),
    z.object({
        type: z.literal("openPopup"),
        data: isOpenPopupEvent,
    }),
    z.object({
        type: z.literal("closePopup"),
        data: isClosePopupEvent,
    }),
    z.object({
        type: z.literal("openTab"),
        data: isOpenTabEvent,
    }),
    z.object({
        type: z.literal("goToPage"),
        data: isGoToPageEvent,
    }),
    z.object({
        type: z.literal("disablePlayerControls"),
        data: z.undefined(),
    }),
    z.object({
        type: z.literal("restorePlayerControls"),
        data: z.undefined(),
    }),
    z.object({
        type: z.literal("disablePlayerProximityMeeting"),
        data: z.undefined(),
    }),
    z.object({
        type: z.literal("restorePlayerProximityMeeting"),
        data: z.undefined(),
    }),
    z.object({
        type: z.literal("displayBubble"),
        data: z.undefined(),
    }),
    z.object({
        type: z.literal("removeBubble"),
        data: z.undefined(),
    }),
    z.object({
        type: z.literal("onPlayerMove"),
        data: z.undefined(),
    }),
    z.object({
        type: z.literal("onCameraUpdate"),
        data: z.undefined(),
    }),
    z.object({
        type: z.literal("showLayer"),
        data: isLayerEvent,
    }),
    z.object({
        type: z.literal("hideLayer"),
        data: isLayerEvent,
    }),
    z.object({
        type: z.literal("setProperty"),
        data: isSetPropertyEvent,
    }),
    z.object({
        type: z.literal("setAreaProperty"),
        data: isSetAreaPropertyEvent,
    }),
    z.object({
        type: z.literal("loadSound"),
        data: isLoadSoundEvent,
    }),
    z.object({
        type: z.literal("playSound"),
        data: isPlaySoundEvent,
    }),
    z.object({
        type: z.literal("stopSound"),
        data: isStopSoundEvent,
    }),
    z.object({
        type: z.literal("registerMenu"),
        data: isMenuRegisterEvent,
    }),
    z.object({
        type: z.literal("unregisterMenu"),
        data: isUnregisterMenuEvent,
    }),
    z.object({
        type: z.literal("setTiles"),
        data: isSetTilesEvent,
    }),
    z.object({
        type: z.literal("modifyEmbeddedWebsite"),
        data: isEmbeddedWebsiteEvent,
    }),
    z.object({
        type: z.literal("modifyUIWebsite"),
        data: isModifyUIWebsiteEvent,
    }),
    z.object({
        type: z.literal("modifyArea"),
        data: isAreaEvent,
    }),
]);

export type IframeEvent = z.infer<typeof isIframeEventWrapper>;

export const isIframeResponseEvent = z.union([
    z.object({
        type: z.literal("userInputChat"),
        data: isUserInputChatEvent,
    }),
    z.object({
        type: z.literal("enterEvent"),
        data: isEnterLeaveEvent,
    }),
    z.object({
        type: z.literal("leaveEvent"),
        data: isEnterLeaveEvent,
    }),
    z.object({
        type: z.literal("enterLayerEvent"),
        data: isChangeLayerEvent,
    }),
    z.object({
        type: z.literal("leaveLayerEvent"),
        data: isChangeLayerEvent,
    }),
    z.object({
        type: z.literal("enterAreaEvent"),
        data: isChangeAreaEvent,
    }),
    z.object({
        type: z.literal("leaveAreaEvent"),
        data: isChangeAreaEvent,
    }),
    z.object({
        type: z.literal("buttonClickedEvent"),
        data: isButtonClickedEvent,
    }),
    z.object({
        type: z.literal("remotePlayerClickedEvent"),
        data: isRemotePlayerClickedEvent,
    }),
    z.object({
        type: z.literal("actionsMenuActionClickedEvent"),
        data: isActionsMenuActionClickedEvent,
    }),
    z.object({
        type: z.literal("hasPlayerMoved"),
        data: isHasPlayerMovedEvent,
    }),
    z.object({
        type: z.literal("wasCameraUpdated"),
        data: isWasCameraUpdatedEvent,
    }),
    z.object({
        type: z.literal("menuItemClicked"),
        data: isMenuItemClickedEvent,
    }),
    z.object({
        type: z.literal("setVariable"),
        data: isSetVariableEvent,
    }),
    z.object({
        type: z.literal("messageTriggered"),
        data: isMessageReferenceEvent,
    }),
]);
export type IframeResponseEvent = z.infer<typeof isIframeResponseEvent>;

export const isLookingLikeIframeEventWrapper = z.object({
    type: z.string(),
    data: z.unknown().optional(),
});

/**
 * List event types sent from an iFrame to WorkAdventure that expect a unique answer from WorkAdventure along the type for the answer from WorkAdventure to the iFrame.
 * Types are defined using Type guards that will actually bused to enforce and check types.
 */
export const iframeQueryMapTypeGuards = {
    getState: {
        query: z.undefined(),
        answer: isGameStateEvent,
    },
    getMapData: {
        query: z.undefined(),
        answer: isMapDataEvent,
    },
    setVariable: {
        query: isSetVariableEvent,
        answer: z.undefined(),
    },
    loadTileset: {
        query: isLoadTilesetEvent,
        answer: z.number(),
    },
    openCoWebsite: {
        query: isOpenCoWebsiteEvent,
        answer: isCoWebsite,
    },
    getCoWebsites: {
        query: z.undefined(),
        answer: z.array(isCoWebsite),
    },
    closeCoWebsite: {
        query: z.string(),
        answer: z.undefined(),
    },
    closeCoWebsites: {
        query: z.undefined(),
        answer: z.undefined(),
    },
    triggerActionMessage: {
        query: isTriggerActionMessageEvent,
        answer: z.undefined(),
    },
    removeActionMessage: {
        query: isMessageReferenceEvent,
        answer: z.undefined(),
    },
    getEmbeddedWebsite: {
        query: z.string(),
        answer: isCreateEmbeddedWebsiteEvent,
    },
    deleteEmbeddedWebsite: {
        query: z.string(),
        answer: z.undefined(),
    },
    createEmbeddedWebsite: {
        query: isCreateEmbeddedWebsiteEvent,
        answer: z.undefined(),
    },
    createArea: {
        query: isCreateAreaEvent,
        answer: z.undefined(),
    },
    getArea: {
        query: z.string(),
        answer: isCreateAreaEvent,
    },
    modifyArea: {
        query: isAreaEvent,
        answer: z.undefined(),
    },
    deleteArea: {
        query: z.string(),
        answer: z.undefined(),
    },
    setPlayerOutline: {
        query: isColorEvent,
        answer: z.undefined(),
    },
    removePlayerOutline: {
        query: z.undefined(),
        answer: z.undefined(),
    },
    getPlayerPosition: {
        query: z.undefined(),
        answer: isPlayerPosition,
    },
    movePlayerTo: {
        query: isMovePlayerToEventConfig,
        answer: isMovePlayerToEventAnswer,
    },
    openUIWebsite: {
        query: isCreateUIWebsiteEvent,
        answer: isUIWebsite,
    },
    closeUIWebsite: {
        query: z.string(),
        answer: z.undefined(),
    },
    getUIWebsites: {
        query: z.undefined(),
        answer: z.array(isUIWebsite),
    },
};

type IframeQueryMapTypeGuardsType = typeof iframeQueryMapTypeGuards;
type UnknownToVoid<T> = undefined extends T ? void : T;

export type IframeQueryMap = {
    [key in keyof IframeQueryMapTypeGuardsType]: {
        query: z.infer<typeof iframeQueryMapTypeGuards[key]["query"]>;
        answer: UnknownToVoid<z.infer<typeof iframeQueryMapTypeGuards[key]["answer"]>>;
    };
};

export interface IframeQuery<T extends keyof IframeQueryMap> {
    type: T;
    data: IframeQueryMap[T]["query"];
}

export interface IframeQueryWrapper<T extends keyof IframeQueryMap> {
    id: number;
    query: IframeQuery<T>;
}

export const isIframeQueryKey = (type: string): type is keyof IframeQueryMap => {
    return type in iframeQueryMapTypeGuards;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isIframeQuery = (event: any): event is IframeQuery<keyof IframeQueryMap> => {
    const type = event.type;
    if (typeof type !== "string") {
        return false;
    }
    if (!isIframeQueryKey(type)) {
        return false;
    }

    try {
        iframeQueryMapTypeGuards[type].query.parse(event.data);
    } catch (err) {
        if (err instanceof z.ZodError) {
            console.error(err.issues);
        }
        console.warn('Received a query with type "' + type + '" but the payload is invalid.');

        return false;
    }

    return true;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isIframeQueryWrapper = (event: any): event is IframeQueryWrapper<keyof IframeQueryMap> =>
    typeof event.id === "number" && isIframeQuery(event.query);

export interface IframeAnswerEvent<T extends keyof IframeQueryMap> {
    id: number;
    type: T;
    data: IframeQueryMap[T]["answer"];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isIframeAnswerEvent = (event: any): event is IframeAnswerEvent<keyof IframeQueryMap> =>
    typeof event.type === "string" && typeof event.id === "number";

/*export interface IframeErrorAnswerEvent {
    id: number;
    type: keyof IframeQueryMap;
    error: string;
}

export const isIframeErrorAnswerEvent = (event: {
    type?: string;
    id?: number;
    error?: string;
}): event is IframeErrorAnswerEvent =>
    typeof event.type === "string" && typeof event.id === "number" && typeof event.error === "string";*/

export const isIframeErrorAnswerEvent = z.object({
    id: z.number(),
    type: z.string(),
    error: z.string(),
});

/**
 * A message sent from the game to the iFrame when a user enters or leaves a zone.
 */
export type IframeErrorAnswerEvent = z.infer<typeof isIframeErrorAnswerEvent>;
