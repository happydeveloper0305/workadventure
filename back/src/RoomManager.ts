import { clearInterval } from "timers";
import {
    AdminGlobalMessage,
    AdminMessage,
    AdminPusherToBackMessage,
    AdminRoomMessage,
    BanMessage,
    BatchToPusherMessage,
    BatchToPusherRoomMessage,
    PusherToBackMessage,
    RefreshRoomPromptMessage,
    RoomMessage,
    ServerToAdminClientMessage,
    WorldFullWarningToRoomMessage,
    ZoneMessage,
    RoomsList,
    PingMessage,
    ChatMessagePrompt,
    ServerToClientMessage,
    VariableRequest,
} from "@workadventure/messages";
import { RoomManagerServer } from "@workadventure/messages/src/ts-proto-generated/services";
import {
    sendUnaryData,
    ServerDuplexStream,
    ServerErrorResponse,
    ServerUnaryCall,
    ServerWritableStream,
} from "@grpc/grpc-js";
import Debug from "debug";
import { Value } from "@workadventure/messages/src/ts-proto-generated/google/protobuf/struct";
import { Empty } from "@workadventure/messages/src/ts-proto-generated/google/protobuf/empty";
import { socketManager } from "./Services/SocketManager";
import {
    emitError,
    emitErrorOnAdminSocket,
    emitErrorOnRoomSocket,
    emitErrorOnZoneSocket,
} from "./Services/MessageHelpers";
import { User, UserSocket } from "./Model/User";
import { GameRoom } from "./Model/GameRoom";
import { Admin } from "./Model/Admin";
import { getMapStorageClient } from "./Services/MapStorageClient";

const debug = Debug("roommanager");

export type AdminSocket = ServerDuplexStream<AdminPusherToBackMessage, ServerToAdminClientMessage>;
export type ZoneSocket = ServerWritableStream<ZoneMessage, BatchToPusherMessage>;
export type RoomSocket = ServerWritableStream<RoomMessage, BatchToPusherRoomMessage>;
export type VariableSocket = ServerWritableStream<VariableRequest, unknown>;

// Maximum time to wait for a pong answer to a ping before closing connection.
// Note: PONG_TIMEOUT must be less than PING_INTERVAL
const PONG_TIMEOUT = 70000; // PONG_TIMEOUT is > 1 minute because of Chrome heavy throttling. See: https://docs.google.com/document/d/11FhKHRcABGS4SWPFGwoL6g0ALMqrFKapCk5ZTKKupEk/edit#
const PING_INTERVAL = 80000;

const roomManager = {
    joinRoom: (call: UserSocket): void => {
        console.log("joinRoom called");

        let room: GameRoom | null = null;
        let user: User | null = null;
        let pongTimeoutId: NodeJS.Timer | undefined;

        call.on("data", (message: PusherToBackMessage) => {
            // On each message, let's reset the pong timeout
            if (pongTimeoutId) {
                clearTimeout(pongTimeoutId);
                pongTimeoutId = undefined;
            }

            (async () => {
                if (!message.message) {
                    console.error("Empty message received");
                    return;
                }

                try {
                    if (room === null || user === null) {
                        if (message.message.$case === "joinRoomMessage") {
                            socketManager
                                .handleJoinRoom(call, message.message.joinRoomMessage)
                                .then(({ room: gameRoom, user: myUser }) => {
                                    if (call.writable) {
                                        room = gameRoom;
                                        user = myUser;
                                    } else {
                                        // Connection may have been closed before the init was finished, so we have to manually disconnect the user.
                                        // TODO: Remove this debug line
                                        console.info(
                                            "message handleJoinRoom connection have been closed before. Check 'call.writable': ",
                                            call.writable
                                        );
                                        socketManager.leaveRoom(gameRoom, myUser);
                                    }
                                })
                                .catch((e) => {
                                    console.error("message handleJoinRoom error: ", e);
                                    emitError(call, e);
                                });
                        } else {
                            throw new Error("The first message sent MUST be of type JoinRoomMessage");
                        }
                    } else {
                        switch (message.message.$case) {
                            case "joinRoomMessage": {
                                throw new Error("Cannot call JoinRoomMessage twice!");
                            }
                            case "userMovesMessage": {
                                socketManager.handleUserMovesMessage(room, user, message.message.userMovesMessage);
                                break;
                            }
                            case "itemEventMessage": {
                                socketManager.handleItemEvent(room, user, message.message.itemEventMessage);
                                break;
                            }
                            case "variableMessage": {
                                await socketManager.handleVariableEvent(room, user, message.message.variableMessage);
                                break;
                            }
                            case "webRtcSignalToServerMessage": {
                                socketManager.emitVideo(room, user, message.message.webRtcSignalToServerMessage);
                                break;
                            }
                            case "webRtcScreenSharingSignalToServerMessage": {
                                socketManager.emitScreenSharing(
                                    room,
                                    user,
                                    message.message.webRtcScreenSharingSignalToServerMessage
                                );
                                break;
                            }
                            case "queryMessage": {
                                await socketManager.handleQueryMessage(room, user, message.message.queryMessage);
                                break;
                            }
                            case "emotePromptMessage": {
                                socketManager.handleEmoteEventMessage(room, user, message.message.emotePromptMessage);
                                break;
                            }
                            case "followRequestMessage": {
                                socketManager.handleFollowRequestMessage(
                                    room,
                                    user,
                                    message.message.followRequestMessage
                                );
                                break;
                            }
                            case "followConfirmationMessage": {
                                socketManager.handleFollowConfirmationMessage(
                                    room,
                                    user,
                                    message.message.followConfirmationMessage
                                );
                                break;
                            }
                            case "followAbortMessage": {
                                socketManager.handleFollowAbortMessage(room, user, message.message.followAbortMessage);
                                break;
                            }
                            case "lockGroupPromptMessage": {
                                socketManager.handleLockGroupPromptMessage(
                                    room,
                                    user,
                                    message.message.lockGroupPromptMessage
                                );
                                break;
                            }
                            case "editMapCommandMessage": {
                                socketManager.handleEditMapCommandMessage(
                                    room,
                                    user,
                                    message.message.editMapCommandMessage
                                );
                                break;
                            }
                            case "sendUserMessage": {
                                socketManager.handleSendUserMessage(user, message.message.sendUserMessage);
                                break;
                            }
                            case "banUserMessage": {
                                socketManager.handleBanUserMessage(room, user, message.message.banUserMessage);
                                break;
                            }
                            case "setPlayerDetailsMessage": {
                                socketManager.handleSetPlayerDetails(
                                    room,
                                    user,
                                    message.message.setPlayerDetailsMessage
                                );
                                break;
                            }
                            case "pingMessage": {
                                // Do nothing
                                break;
                            }
                            case "askPositionMessage": {
                                socketManager.handleAskPositionMessage(room, user, message.message.askPositionMessage);
                                break;
                            }
                            default: {
                                const _exhaustiveCheck: never = message.message;
                            }
                        }
                    }
                } catch (e) {
                    console.error(
                        "An error occurred while managing a message of type PusherToBackMessage:" +
                            message.message.$case,
                        e
                    );
                    emitError(call, e);
                    call.end();
                }
            })().catch((e) => console.error(e));
        });

        const closeConnection = () => {
            if (user !== null && room !== null) {
                socketManager.leaveRoom(room, user);
            }
            if (pingIntervalId) {
                clearInterval(pingIntervalId);
            }
            if (pongTimeoutId) {
                clearTimeout(pongTimeoutId);
                pongTimeoutId = undefined;
            }
            call.end();
            room = null;
            user = null;
        };

        call.on("end", () => {
            debug("joinRoom ended for user %s", user?.name);
            closeConnection();
        });

        call.on("error", (err: Error) => {
            console.error("An error occurred in joinRoom stream for user", user?.name, ":", err);
            closeConnection();
        });

        // Let's set up a ping mechanism
        const serverToClientMessage: ServerToClientMessage = {
            message: {
                $case: "batchMessage",
                batchMessage: {
                    event: "",
                    payload: [
                        {
                            message: {
                                $case: "pingMessage",
                                pingMessage: {},
                            },
                        },
                    ],
                },
            },
        };

        // Ping requests are sent from the server because the setTimeout on the browser is unreliable when the tab is hidden.
        const pingIntervalId = setInterval(() => {
            call.write(serverToClientMessage);

            if (pongTimeoutId) {
                console.warn("Warning, emitting a new ping message before previous pong message was received.");
                clearTimeout(pongTimeoutId);
            }

            pongTimeoutId = setTimeout(() => {
                console.log(
                    "Connection lost with user ",
                    user?.uuid,
                    user?.name,
                    user?.userJid,
                    "in room",
                    room?.roomUrl
                );
                closeConnection();
            }, PONG_TIMEOUT);
        }, PING_INTERVAL);
    },

    listenZone(call: ZoneSocket): void {
        debug("listenZone called");
        const zoneMessage = call.request;

        socketManager.addZoneListener(call, zoneMessage.roomId, zoneMessage.x, zoneMessage.y).catch((e) => {
            emitErrorOnZoneSocket(call, e);
        });

        call.on("cancelled", () => {
            debug("listenZone cancelled");
            socketManager
                .removeZoneListener(call, zoneMessage.roomId, zoneMessage.x, zoneMessage.y)
                .catch((e) => console.error(e));
            call.end();
        });

        call.on("close", () => {
            debug("listenZone connection closed");
            socketManager
                .removeZoneListener(call, zoneMessage.roomId, zoneMessage.x, zoneMessage.y)
                .catch((e) => console.error(e));
        }).on("error", (e) => {
            console.error("An error occurred in listenZone stream:", e);
            socketManager
                .removeZoneListener(call, zoneMessage.roomId, zoneMessage.x, zoneMessage.y)
                .catch((e) => console.error(e));
            call.end();
        });
    },

    listenRoom(call: RoomSocket): void {
        debug("listenRoom called");
        const roomMessage = call.request;

        socketManager.addRoomListener(call, roomMessage.roomId).catch((e) => {
            emitErrorOnRoomSocket(call, e);
        });

        call.on("cancelled", () => {
            debug("listenRoom cancelled");
            socketManager.removeRoomListener(call, roomMessage.roomId).catch((e) => console.error(e));
            call.end();
        });

        call.on("close", () => {
            debug("listenRoom connection closed");
            socketManager.removeRoomListener(call, roomMessage.roomId).catch((e) => console.error(e));
        }).on("error", (e) => {
            console.error("An error occurred in listenRoom stream:", e);
            socketManager.removeRoomListener(call, roomMessage.roomId).catch((e) => console.error(e));
            call.end();
        });
    },

    adminRoom(call: AdminSocket): void {
        console.log("adminRoom called");

        const admin = new Admin(call);
        let room: GameRoom | null = null;

        call.on("data", (message: AdminPusherToBackMessage) => {
            try {
                if (!message.message) {
                    console.error("Received an empty message in adminRoom");
                    return;
                }
                if (room === null) {
                    if (message.message.$case === "subscribeToRoom") {
                        const roomId = message.message.subscribeToRoom;
                        socketManager
                            .handleJoinAdminRoom(admin, roomId)
                            .then((gameRoom: GameRoom) => {
                                room = gameRoom;
                            })
                            .catch((e) => console.error(e));
                    } else {
                        throw new Error("The first message sent MUST be of type JoinRoomMessage");
                    }
                }
            } catch (e) {
                emitErrorOnAdminSocket(call, e);
                call.end();
            }
        });

        call.on("end", () => {
            debug("joinRoom ended");
            if (room !== null) {
                socketManager.leaveAdminRoom(room, admin);
            }
            call.end();
            room = null;
        });

        call.on("error", (err: Error) => {
            console.error("An error occurred in joinAdminRoom stream:", err);
        });
    },
    sendAdminMessage(call: ServerUnaryCall<AdminMessage, Empty>, callback: sendUnaryData<Empty>): void {
        const adminMessage = call.request;
        socketManager
            .sendAdminMessage(adminMessage.roomId, adminMessage.recipientUuid, adminMessage.message, adminMessage.type)
            .catch((e) => console.error(e));

        callback(null, {});
    },
    sendGlobalAdminMessage(call: ServerUnaryCall<AdminGlobalMessage, Empty>, callback: sendUnaryData<Empty>): void {
        throw new Error("Not implemented yet");
        // TODO
        callback(null, {});
    },
    ban(call: ServerUnaryCall<BanMessage, Empty>, callback: sendUnaryData<Empty>): void {
        // FIXME Work in progress
        socketManager
            .banUser(call.request.roomId, call.request.recipientUuid, call.request.message)
            .catch((e) => console.error(e));

        callback(null, {});
    },
    sendAdminMessageToRoom(call: ServerUnaryCall<AdminRoomMessage, Empty>, callback: sendUnaryData<Empty>): void {
        // FIXME: we could improve return message by returning a Success|ErrorMessage message
        socketManager
            .sendAdminRoomMessage(call.request.roomId, call.request.message, call.request.type)
            .catch((e) => console.error(e));
        callback(null, {});
    },
    sendWorldFullWarningToRoom(
        call: ServerUnaryCall<WorldFullWarningToRoomMessage, Empty>,
        callback: sendUnaryData<Empty>
    ): void {
        // FIXME: we could improve return message by returning a Success|ErrorMessage message
        socketManager.dispatchWorldFullWarning(call.request.roomId).catch((e) => console.error(e));
        callback(null, {});
    },
    sendRefreshRoomPrompt(
        call: ServerUnaryCall<RefreshRoomPromptMessage, Empty>,
        callback: sendUnaryData<Empty>
    ): void {
        // FIXME: we could improve return message by returning a Success|ErrorMessage message
        socketManager.dispatchRoomRefresh(call.request.roomId).catch((e) => console.error(e));
        callback(null, {});
    },
    getRooms(call: ServerUnaryCall<Empty, Empty>, callback: sendUnaryData<RoomsList>): void {
        callback(null, socketManager.getAllRooms());
    },
    ping(call: ServerUnaryCall<PingMessage, Empty>, callback: sendUnaryData<PingMessage>): void {
        callback(null, call.request);
    },
    sendChatMessagePrompt(call: ServerUnaryCall<ChatMessagePrompt, Empty>, callback: sendUnaryData<Empty>): void {
        socketManager
            .dispatchChatMessagePrompt(call.request)
            .then(() => {
                callback(null, {});
            })
            .catch((err) => {
                console.error(err);
                callback(err as ServerErrorResponse, {});
            });
    },
    readVariable(call, callback) {
        socketManager
            .readVariable(call.request.room, call.request.name)
            .then((value) => {
                callback(null, Value.wrap(value === undefined ? undefined : JSON.parse(value)));
            })
            .catch((error) => {
                throw error;
            });
    },
    listenVariable(call) {
        socketManager.addVariableListener(call).catch((e) => {
            call.end();
        });

        call.on("cancelled", () => {
            socketManager.removeVariableListener(call).catch((e) => console.error(e));
            call.end();
        });

        call.on("close", () => {
            socketManager.removeVariableListener(call).catch((e) => console.error(e));
        }).on("error", (e) => {
            socketManager.removeVariableListener(call).catch((e) => console.error(e));
            call.end(e);
        });
    },
    saveVariable(call, callback) {
        socketManager
            .saveVariable(call.request.room, call.request.name, JSON.stringify(call.request.value))
            .then(() => {
                callback(null);
            })
            .catch((error) => {
                throw error;
            });
    },
    handleMapStorageUploadMapDetected(call) {
        /**
         * We are calling the mapstorage connected to this back server and asking to purge the wamUrl from memory.
         * We are not sure this particular mapstorage has this particular WAM map in memory. But since the message
         * is dispatched to all back servers, one of the back servers will be connected to the correct map storage.
         */
        getMapStorageClient().handleClearAfterUpload(
            {
                wamUrl: call.request.wamUrl,
            },
            (err) => {
                if (err) {
                    console.error(err);
                    return;
                }
                Promise.all(socketManager.getWorlds().values())
                    .then((gameRooms) => {
                        for (const gameRoom of gameRooms) {
                            if (gameRoom.wamUrl === call.request.wamUrl) {
                                gameRoom.sendRefreshRoomMessageToUsers();
                            }
                        }
                    })
                    .catch((error) => {
                        console.error(error);
                    });
            }
        );
    },
} satisfies RoomManagerServer;

export { roomManager };
