import { get } from "svelte/store";
import Debug from "debug";
import {
    isLookingLikeIframeEventWrapper,
    isIframeEventWrapper,
    lookingLikeIframeEventWrapper,
} from "./Event/IframeEvent";
import { userStore } from "./Stores/LocalUserStore";
import {
    availabilityStatusStore,
    chatMessagesStore,
    ChatMessageTypes,
    chatNotificationsStore,
    chatPeerConnectionInProgress,
    chatSoundsStore,
    enableChat,
    enableChatOnlineListStore,
    enableChatDisconnectedListStore,
    enableChatUpload,
    newChatMessageSubject,
    newChatMessageWritingStatusSubject,
    showTimelineStore,
    timelineActiveStore,
    timelineMessagesToSee,
    writingStatusMessageStore,
    chatVisibilityStore,
} from "./Stores/ChatStore";
import { setCurrentLocale } from "./i18n/locales";
import { Locales } from "./i18n/i18n-types";
import { mucRoomsStore } from "./Stores/MucRoomsStore";
import { chatConnectionManager } from "./Connection/ChatConnectionManager";
import { NotificationType } from "./Media/MediaManager";
import { activeThreadStore } from "./Stores/ActiveThreadStore";
import { emojiRegex } from "./Utils/HtmlUtils";

const debug = Debug("chat");

class IframeListener {
    init() {
        window.addEventListener("message", (message: MessageEvent): void => {
            const payload = message.data;
            const lookingLikeEvent = isLookingLikeIframeEventWrapper.safeParse(payload);
            if (lookingLikeEvent.success) {
                const iframeEventGuarded = isIframeEventWrapper.safeParse(lookingLikeEvent.data);
                if (iframeEventGuarded.success) {
                    debug(`iFrameListener => message received => ${JSON.stringify(iframeEventGuarded.data)}`);
                    const iframeEvent = iframeEventGuarded.data;
                    switch (iframeEvent.type) {
                        case "settings": {
                            chatSoundsStore.set(iframeEvent.data.chatSounds);
                            chatNotificationsStore.set(iframeEvent.data.notification);
                            enableChat.set(iframeEvent.data.enableChat);
                            enableChatUpload.set(iframeEvent.data.enableChatUpload);
                            enableChatOnlineListStore.set(iframeEvent.data.enableChatOnlineList);
                            enableChatDisconnectedListStore.set(iframeEvent.data.enableChatDisconnectedList);
                            break;
                        }
                        case "xmppSettingsMessage": {
                            chatConnectionManager.initXmppSettings(iframeEvent.data);
                            break;
                        }
                        case "userData": {
                            iframeEvent.data.name = iframeEvent.data.name.replace(emojiRegex, "");
                            userStore.set(iframeEvent.data);
                            chatConnectionManager.initUser(
                                iframeEvent.data.playUri,
                                iframeEvent.data.uuid,
                                iframeEvent.data.authToken
                            );
                            if (chatConnectionManager.connection) {
                                mucRoomsStore.sendUserInfos();
                            }
                            break;
                        }
                        case "setLocale": {
                            setCurrentLocale(iframeEvent.data.locale as Locales).catch((err) => console.error(err));
                            break;
                        }
                        case "joinMuc": {
                            if (!get(enableChat)) {
                                return;
                            }
                            chatConnectionManager.connectionOrFail?.joinMuc(
                                iframeEvent.data.name,
                                iframeEvent.data.url,
                                iframeEvent.data.type,
                                iframeEvent.data.subscribe
                            );
                            break;
                        }
                        case "leaveMuc": {
                            if (!get(enableChat)) {
                                return;
                            }
                            chatConnectionManager.connectionOrFail?.leaveMuc(iframeEvent.data.url);
                            break;
                        }
                        case "updateWritingStatusChatList": {
                            writingStatusMessageStore.set(iframeEvent.data);
                            break;
                        }
                        case "addChatMessage": {
                            if (iframeEvent.data.text == undefined) {
                                break;
                            }
                            const mucRoomDefault = mucRoomsStore.getDefaultRoom();
                            let userData = undefined;
                            if (mucRoomDefault && iframeEvent.data.author.jid !== "fake") {
                                try {
                                    userData = mucRoomDefault.getUserByJid(iframeEvent.data.author.jid);
                                } catch (e) {
                                    console.warn("Can't fetch user data from Ejabberd", e);
                                    userData = iframeEvent.data.author;
                                }
                            } else {
                                userData = iframeEvent.data.author;
                            }
                            for (const chatMessageText of iframeEvent.data.text) {
                                chatMessagesStore.addExternalMessage(userData, chatMessageText, userData.name);
                            }
                            break;
                        }
                        case "comingUser": {
                            const mucRoomDefault = mucRoomsStore.getDefaultRoom();
                            let userData = undefined;
                            if (mucRoomDefault && iframeEvent.data.author.jid !== "fake") {
                                userData = mucRoomDefault.getUserByJid(iframeEvent.data.author.jid);
                            } else {
                                userData = iframeEvent.data.author;
                            }
                            if (ChatMessageTypes.userIncoming === iframeEvent.data.type) {
                                chatMessagesStore.addIncomingUser(userData);
                            }
                            if (ChatMessageTypes.userOutcoming === iframeEvent.data.type) {
                                chatMessagesStore.addOutcomingUser(userData);
                            }
                            break;
                        }
                        case "peerConnectionStatus": {
                            chatPeerConnectionInProgress.set(iframeEvent.data);
                            if (iframeEvent.data) {
                                showTimelineStore.set(true);
                            }
                            break;
                        }
                        case "chatVisibility": {
                            chatVisibilityStore.set(iframeEvent.data.visibility);
                            if (!iframeEvent.data.visibility) {
                                activeThreadStore.reset();
                            } else if (get(chatPeerConnectionInProgress) || get(timelineMessagesToSee) > 0) {
                                timelineActiveStore.set(true);
                            } else if (mucRoomsStore.getChatZones()) {
                                activeThreadStore.set(mucRoomsStore.getChatZones());
                            }
                            break;
                        }
                        case "availabilityStatus": {
                            availabilityStatusStore.set(iframeEvent.data);
                            break;
                        }
                    }
                } else {
                    console.error("Message structure not conform", lookingLikeEvent.data, iframeEventGuarded);
                }
            }
        });
    }

    openCoWebsite(
        url: string,
        allowApi?: boolean,
        allowPolicy?: string,
        widthPercent?: number,
        position?: number,
        closable?: boolean,
        lazy?: boolean
    ) {
        window.parent.postMessage(
            {
                id: 0,
                query: {
                    type: "openCoWebsite",
                    data: {
                        url,
                        allowApi,
                        allowPolicy,
                        widthPercent,
                        position,
                        closable,
                        lazy,
                    },
                },
            },
            "*"
        );
    }

    closeCoWebsite() {
        window.parent.postMessage(
            {
                id: 0,
                query: {
                    type: "closeCoWebsites",
                    data: undefined,
                },
            },
            "*"
        );
    }
    sendNotificationToFront(userName: string, notificationType: NotificationType, forum: null | string) {
        this.sendToParent({
            type: "notification",
            data: { userName, notificationType, forum },
        });
    }

    sendLogin() {
        this.sendToParent({
            type: "login",
        });
    }

    sendRefresh() {
        this.sendToParent({
            type: "refresh",
        });
    }

    sendShowBusinessCard(visitCardUrl: string) {
        this.sendToParent({
            type: "showBusinessCard",
            data: { visitCardUrl },
        });
    }

    sendRedirectPricing() {
        this.sendToParent({
            type: "redirectPricing",
        });
    }

    sendChatTotalMessagesToSee(total: number) {
        this.sendToParent({
            type: "chatTotalMessagesToSee",
            data: total,
        });
    }

    sendChatIsReady() {
        this.sendToParent({
            type: "chatReady",
        });
    }

    sendToParent(message: lookingLikeIframeEventWrapper) {
        debug(`iFrameListener => message sent to parent => ${JSON.stringify(message)}`);
        window.parent.postMessage(message, "*");
    }
}

export const iframeListener = new IframeListener();

/* @deprecated with new service chat messagerie */
//publis new message when user send message in chat timeline
newChatMessageSubject.subscribe((messgae) => {
    window.parent.postMessage(
        {
            type: "addPersonnalMessage",
            data: messgae,
        },
        "*"
    );
});
newChatMessageWritingStatusSubject.subscribe((status) => {
    window.parent.postMessage(
        {
            type: "newChatMessageWritingStatus",
            data: status,
        },
        "*"
    );
});
