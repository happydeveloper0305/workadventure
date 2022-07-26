import {
  isLookingLikeIframeEventWrapper,
  isIframeEventWrapper,
} from "./Event/IframeEvent";
import { userStore } from "./Stores/LocalUserStore";
import {
  chatMessagesStore,
  ChatMessageTypes,
  chatPeerConnectionInProgress,
  newChatMessageSubject,
  newChatMessageWritingStatusSubject,
  timelineOpenedStore,
  writingStatusMessageStore,
} from "./Stores/ChatStore";
import { setCurrentLocale } from "./i18n/locales";
import { Locales } from "./i18n/i18n-types";
import { mucRoomsStore } from "./Stores/MucRoomsStore";
import { defaultUserData } from "./Xmpp/MucRoom";
import { connectionManager } from "./Connection/ChatConnectionManager";

class IframeListener {
  init() {
    window.addEventListener("message", (message: MessageEvent): void => {
      const payload = message.data;
      const lookingLikeEvent =
        isLookingLikeIframeEventWrapper.safeParse(payload);
      if (lookingLikeEvent.success) {
        const iframeEventGuarded = isIframeEventWrapper.safeParse(
          lookingLikeEvent.data
        );
        if (iframeEventGuarded.success) {
          const iframeEvent = iframeEventGuarded.data;
          switch (iframeEvent.type) {
            case "userData": {
              userStore.set(iframeEvent.data);
              connectionManager.init(
                iframeEvent.data.playUri,
                iframeEvent.data.uuid,
                iframeEvent.data.authToken
              );
              break;
            }
            case "setLocale": {
              setCurrentLocale(iframeEvent.data.locale as Locales).catch(
                (err) => console.error(err)
              );
              break;
            }
            case "joinMuc": {
              if (!connectionManager.connection) {
                connectionManager.start();
              }
              connectionManager.connectionOrFaile
                .getXmppClient()
                ?.joinMuc(
                  iframeEvent.data.name,
                  iframeEvent.data.url,
                  iframeEvent.data.type
                );
              break;
            }
            case "leaveMuc": {
              if (!connectionManager.connection) {
                connectionManager.start();
              }
              connectionManager.connectionOrFaile
                .getXmppClient()
                ?.leaveMuc(iframeEvent.data.url);
              break;
            }
            case "updateWritingStatusChatList": {
              writingStatusMessageStore.set(iframeEvent.data);
              break;
            }
            case "addChatMessage": {
              if (
                iframeEvent.data.author?.userUuid == undefined ||
                iframeEvent.data.text == undefined
              ) {
                break;
              }

              let userData = defaultUserData;
              const mucRoomDefault = mucRoomsStore.getDefaultRoom();
              if (mucRoomDefault) {
                userData = mucRoomDefault.getUserDataByUuid(
                  iframeEvent.data.author?.userUuid
                );
              }

              for (const chatMessageText of iframeEvent.data.text) {
                chatMessagesStore.addExternalMessage(userData, chatMessageText);
              }
              break;
            }
            case "comingUser": {
              for (const target of iframeEvent.data.targets) {
                let userData = defaultUserData;
                const mucRoomDefault = mucRoomsStore.getDefaultRoom();
                if (mucRoomDefault) {
                  userData = mucRoomDefault.getUserDataByUuid(target.userUuid);
                }

                if (ChatMessageTypes.userIncoming === iframeEvent.data.type) {
                  chatMessagesStore.addIncomingUser(userData);
                }
                if (ChatMessageTypes.userOutcoming === iframeEvent.data.type) {
                  chatMessagesStore.addOutcomingUser(userData);
                }
              }
              break;
            }
            case "peerConexionStatus": {
              chatPeerConnectionInProgress.set(iframeEvent.data);
              if (iframeEvent.data) {
                timelineOpenedStore.set(true);
              }
              break;
            }
          }
        }
      }
    });
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
