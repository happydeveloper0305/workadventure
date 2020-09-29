import {API_URL} from "../Enum/EnvironmentVariable";
import {
    BatchMessage,
    ClientToServerMessage,
    GroupDeleteMessage,
    GroupUpdateMessage,
    ItemEventMessage,
    JoinRoomMessage,
    PositionMessage,
    RoomJoinedMessage,
    ServerToClientMessage,
    SetPlayerDetailsMessage,
    SetUserIdMessage,
    SilentMessage,
    UserJoinedMessage,
    UserLeftMessage,
    UserMovedMessage,
    UserMovesMessage,
    ViewportMessage,
    WebRtcDisconnectMessage,
    WebRtcSignalToClientMessage,
    WebRtcSignalToServerMessage,
    WebRtcStartMessage
} from "../Messages/generated/messages_pb"

import {UserSimplePeerInterface} from "../WebRtc/SimplePeer";
import Direction = PositionMessage.Direction;
import {ProtobufClientUtils} from "../Network/ProtobufClientUtils";
import {
    EventMessage,
    GroupCreatedUpdatedMessageInterface, ItemEventMessageInterface,
    MessageUserJoined,
    RoomJoinedMessageInterface,
    ViewportInterface, WebRtcDisconnectMessageInterface,
    WebRtcSignalReceivedMessageInterface,
    WebRtcSignalSentMessageInterface,
    WebRtcStartMessageInterface
} from "./ConnexionModels";


export class RoomConnection implements RoomConnection {
    private readonly socket: WebSocket;
    private userId: number|null = null;
    private listeners: Map<string, Function[]> = new Map<string, Function[]>();
    private static websocketFactory: null|((url: string)=>any) = null; // eslint-disable-line @typescript-eslint/no-explicit-any

    public static setWebsocketFactory(websocketFactory: (url: string)=>any): void { // eslint-disable-line @typescript-eslint/no-explicit-any
        RoomConnection.websocketFactory = websocketFactory;
    }

    public constructor(token: string) {
        let url = API_URL.replace('http://', 'ws://').replace('https://', 'wss://');
        url += '?token='+token;

        if (RoomConnection.websocketFactory) {
            this.socket = RoomConnection.websocketFactory(url);
        } else {
            this.socket = new WebSocket(url);
        }

        this.socket.binaryType = 'arraybuffer';

        this.socket.onopen = (ev) => {
            //console.log('WS connected');
        };

        this.socket.onmessage = (messageEvent) => {
            const arrayBuffer: ArrayBuffer = messageEvent.data;
            const message = ServerToClientMessage.deserializeBinary(new Uint8Array(arrayBuffer));

            if (message.hasBatchmessage()) {
                for (const subMessage of (message.getBatchmessage() as BatchMessage).getPayloadList()) {
                    let event: string;
                    let payload;
                    if (subMessage.hasUsermovedmessage()) {
                        event = EventMessage.USER_MOVED;
                        payload = subMessage.getUsermovedmessage();
                    } else if (subMessage.hasGroupupdatemessage()) {
                        event = EventMessage.GROUP_CREATE_UPDATE;
                        payload = subMessage.getGroupupdatemessage();
                    } else if (subMessage.hasGroupdeletemessage()) {
                        event = EventMessage.GROUP_DELETE;
                        payload = subMessage.getGroupdeletemessage();
                    } else if (subMessage.hasUserjoinedmessage()) {
                        event = EventMessage.JOIN_ROOM;
                        payload = subMessage.getUserjoinedmessage();
                    } else if (subMessage.hasUserleftmessage()) {
                        event = EventMessage.USER_LEFT;
                        payload = subMessage.getUserleftmessage();
                    } else if (subMessage.hasItemeventmessage()) {
                        event = EventMessage.ITEM_EVENT;
                        payload = subMessage.getItemeventmessage();
                    } else {
                        throw new Error('Unexpected batch message type');
                    }

                    this.dispatch(event, payload);
                }
            } else if (message.hasRoomjoinedmessage()) {
                const roomJoinedMessage = message.getRoomjoinedmessage() as RoomJoinedMessage;

                const users: Array<MessageUserJoined> = roomJoinedMessage.getUserList().map(this.toMessageUserJoined.bind(this));
                const groups: Array<GroupCreatedUpdatedMessageInterface> = roomJoinedMessage.getGroupList().map(this.toGroupCreatedUpdatedMessage.bind(this));
                const items: { [itemId: number] : unknown } = {};
                for (const item of roomJoinedMessage.getItemList()) {
                    items[item.getItemid()] = JSON.parse(item.getStatejson());
                }

                this.resolveJoinRoom({
                    users,
                    groups,
                    items
                })
            } else if (message.hasSetuseridmessage()) {
                this.userId = (message.getSetuseridmessage() as SetUserIdMessage).getUserid();
            } else if (message.hasErrormessage()) {
                console.error(EventMessage.MESSAGE_ERROR, message.getErrormessage()?.getMessage());
            } else if (message.hasWebrtcsignaltoclientmessage()) {
                this.dispatch(EventMessage.WEBRTC_SIGNAL, message.getWebrtcsignaltoclientmessage());
            } else if (message.hasWebrtcscreensharingsignaltoclientmessage()) {
                this.dispatch(EventMessage.WEBRTC_SCREEN_SHARING_SIGNAL, message.getWebrtcscreensharingsignaltoclientmessage());
            } else if (message.hasWebrtcstartmessage()) {
                console.log('Received WebRtcStartMessage');
                this.dispatch(EventMessage.WEBRTC_START, message.getWebrtcstartmessage());
            } else if (message.hasWebrtcdisconnectmessage()) {
                this.dispatch(EventMessage.WEBRTC_DISCONNECT, message.getWebrtcdisconnectmessage());
            } else {
                throw new Error('Unknown message received');
            }

        }
    }

    private dispatch(event: string, payload: unknown): void {
        const listeners = this.listeners.get(event);
        if (listeners === undefined) {
            return;
        }
        for (const listener of listeners) {
            listener(payload);
        }
    }

    public emitPlayerDetailsMessage(userName: string, characterLayersSelected: string[]) {
        const message = new SetPlayerDetailsMessage();
        message.setName(userName);
        message.setCharacterlayersList(characterLayersSelected);

        const clientToServerMessage = new ClientToServerMessage();
        clientToServerMessage.setSetplayerdetailsmessage(message);

        this.socket.send(clientToServerMessage.serializeBinary().buffer);
    }

    public closeConnection(): void {
        this.socket?.close();
    }

    private resolveJoinRoom!: (value?: (RoomJoinedMessageInterface | PromiseLike<RoomJoinedMessageInterface> | undefined)) => void;

    public joinARoom(roomId: string, startX: number, startY: number, direction: string, moving: boolean, viewport: ViewportInterface): Promise<RoomJoinedMessageInterface> {
        const promise = new Promise<RoomJoinedMessageInterface>((resolve, reject) => {
            this.resolveJoinRoom = resolve;

            const positionMessage = this.toPositionMessage(startX, startY, direction, moving);
            const viewportMessage = this.toViewportMessage(viewport);

            const joinRoomMessage = new JoinRoomMessage();
            joinRoomMessage.setRoomid(roomId);
            joinRoomMessage.setPosition(positionMessage);
            joinRoomMessage.setViewport(viewportMessage);

            //console.log('Sending position ', positionMessage.getX(), positionMessage.getY());
            const clientToServerMessage = new ClientToServerMessage();
            clientToServerMessage.setJoinroommessage(joinRoomMessage);

            this.socket.send(clientToServerMessage.serializeBinary().buffer);
        })
        return promise;
    }

    private toPositionMessage(x : number, y : number, direction : string, moving: boolean): PositionMessage {
        const positionMessage = new PositionMessage();
        positionMessage.setX(Math.floor(x));
        positionMessage.setY(Math.floor(y));
        let directionEnum: PositionMessage.DirectionMap[keyof PositionMessage.DirectionMap];
        switch (direction) {
            case 'up':
                directionEnum = Direction.UP;
                break;
            case 'down':
                directionEnum = Direction.DOWN;
                break;
            case 'left':
                directionEnum = Direction.LEFT;
                break;
            case 'right':
                directionEnum = Direction.RIGHT;
                break;
            default:
                throw new Error("Unexpected direction");
        }
        positionMessage.setDirection(directionEnum);
        positionMessage.setMoving(moving);

        return positionMessage;
    }

    private toViewportMessage(viewport: ViewportInterface): ViewportMessage {
        const viewportMessage = new ViewportMessage();
        viewportMessage.setLeft(Math.floor(viewport.left));
        viewportMessage.setRight(Math.floor(viewport.right));
        viewportMessage.setTop(Math.floor(viewport.top));
        viewportMessage.setBottom(Math.floor(viewport.bottom));

        return viewportMessage;
    }

    public sharePosition(x : number, y : number, direction : string, moving: boolean, viewport: ViewportInterface) : void{
        if(!this.socket){
            return;
        }

        const positionMessage = this.toPositionMessage(x, y, direction, moving);

        const viewportMessage = this.toViewportMessage(viewport);

        const userMovesMessage = new UserMovesMessage();
        userMovesMessage.setPosition(positionMessage);
        userMovesMessage.setViewport(viewportMessage);

        //console.log('Sending position ', positionMessage.getX(), positionMessage.getY());
        const clientToServerMessage = new ClientToServerMessage();
        clientToServerMessage.setUsermovesmessage(userMovesMessage);

        this.socket.send(clientToServerMessage.serializeBinary().buffer);
    }

    public setSilent(silent: boolean): void {
        const silentMessage = new SilentMessage();
        silentMessage.setSilent(silent);

        const clientToServerMessage = new ClientToServerMessage();
        clientToServerMessage.setSilentmessage(silentMessage);

        this.socket.send(clientToServerMessage.serializeBinary().buffer);
    }

    public setViewport(viewport: ViewportInterface): void {
        const viewportMessage = new ViewportMessage();
        viewportMessage.setTop(Math.round(viewport.top));
        viewportMessage.setBottom(Math.round(viewport.bottom));
        viewportMessage.setLeft(Math.round(viewport.left));
        viewportMessage.setRight(Math.round(viewport.right));

        const clientToServerMessage = new ClientToServerMessage();
        clientToServerMessage.setViewportmessage(viewportMessage);

        this.socket.send(clientToServerMessage.serializeBinary().buffer);
    }

    public onUserJoins(callback: (message: MessageUserJoined) => void): void {
        this.onMessage(EventMessage.JOIN_ROOM, (message: UserJoinedMessage) => {
            callback(this.toMessageUserJoined(message));
        });
    }

    // TODO: move this to protobuf utils
    private toMessageUserJoined(message: UserJoinedMessage): MessageUserJoined {
        const position = message.getPosition();
        if (position === undefined) {
            throw new Error('Invalid JOIN_ROOM message');
        }
        return {
            userId: message.getUserid(),
            name: message.getName(),
            characterLayers: message.getCharacterlayersList(),
            position: ProtobufClientUtils.toPointInterface(position)
        }
    }

    public onUserMoved(callback: (message: UserMovedMessage) => void): void {
        this.onMessage(EventMessage.USER_MOVED, callback);
        //this.socket.on(EventMessage.USER_MOVED, callback);
    }

    /**
     * Registers a listener on a message that is part of a batch
     */
    private onMessage(eventName: string, callback: Function): void {
        let callbacks = this.listeners.get(eventName);
        if (callbacks === undefined) {
            callbacks = new Array<Function>();
            this.listeners.set(eventName, callbacks);
        }
        callbacks.push(callback);
    }

    public onUserLeft(callback: (userId: number) => void): void {
        this.onMessage(EventMessage.USER_LEFT, (message: UserLeftMessage) => {
            callback(message.getUserid());
        });
    }

    public onGroupUpdatedOrCreated(callback: (groupCreateUpdateMessage: GroupCreatedUpdatedMessageInterface) => void): void {
        this.onMessage(EventMessage.GROUP_CREATE_UPDATE, (message: GroupUpdateMessage) => {
            callback(this.toGroupCreatedUpdatedMessage(message));
        });
    }

    private toGroupCreatedUpdatedMessage(message: GroupUpdateMessage): GroupCreatedUpdatedMessageInterface {
        const position = message.getPosition();
        if (position === undefined) {
            throw new Error('Missing position in GROUP_CREATE_UPDATE');
        }

        return {
            groupId: message.getGroupid(),
            position: position.toObject()
        }
    }

    public onGroupDeleted(callback: (groupId: number) => void): void {
        this.onMessage(EventMessage.GROUP_DELETE, (message: GroupDeleteMessage) => {
            callback(message.getGroupid());
        });
    }

    public onConnectError(callback: (error: Event) => void): void {
        this.socket.addEventListener('error', callback)
    }

    public onConnect(callback: (event: Event) => void): void {
        this.socket.addEventListener('open', callback)
    }

    public sendWebrtcSignal(signal: unknown, receiverId: number) {
        const webRtcSignal = new WebRtcSignalToServerMessage();
        webRtcSignal.setReceiverid(receiverId);
        webRtcSignal.setSignal(JSON.stringify(signal));

        const clientToServerMessage = new ClientToServerMessage();
        clientToServerMessage.setWebrtcsignaltoservermessage(webRtcSignal);

        this.socket.send(clientToServerMessage.serializeBinary().buffer);
    }

    public sendWebrtcScreenSharingSignal(signal: unknown, receiverId: number) {
        const webRtcSignal = new WebRtcSignalToServerMessage();
        webRtcSignal.setReceiverid(receiverId);
        webRtcSignal.setSignal(JSON.stringify(signal));

        const clientToServerMessage = new ClientToServerMessage();
        clientToServerMessage.setWebrtcscreensharingsignaltoservermessage(webRtcSignal);

        this.socket.send(clientToServerMessage.serializeBinary().buffer);
    }

    public receiveWebrtcStart(callback: (message: UserSimplePeerInterface) => void) {
        this.onMessage(EventMessage.WEBRTC_START, (message: WebRtcStartMessage) => {
            callback({
                userId: message.getUserid(),
                name: message.getName(),
                initiator: message.getInitiator()
            });
        });
    }

    public receiveWebrtcSignal(callback: (message: WebRtcSignalReceivedMessageInterface) => void) {
        this.onMessage(EventMessage.WEBRTC_SIGNAL, (message: WebRtcSignalToClientMessage) => {
            callback({
                userId: message.getUserid(),
                signal: JSON.parse(message.getSignal())
            });
        });
    }

    public receiveWebrtcScreenSharingSignal(callback: (message: WebRtcSignalReceivedMessageInterface) => void) {
        this.onMessage(EventMessage.WEBRTC_SCREEN_SHARING_SIGNAL, (message: WebRtcSignalToClientMessage) => {
            callback({
                userId: message.getUserid(),
                signal: JSON.parse(message.getSignal())
            });
        });
    }

    public onServerDisconnected(callback: (event: CloseEvent) => void): void {
        this.socket.addEventListener('close', (event) => {
            console.log('Socket closed with code '+event.code+". Reason: "+event.reason);
            if (event.code === 1000) {
                // Normal closure case
                return;
            }
            callback(event);
        });

    }

    public getUserId(): number|null {
        return this.userId;
    }

    disconnectMessage(callback: (message: WebRtcDisconnectMessageInterface) => void): void {
        this.onMessage(EventMessage.WEBRTC_DISCONNECT, (message: WebRtcDisconnectMessage) => {
            callback({
                userId: message.getUserid()
            });
        });
    }

    emitActionableEvent(itemId: number, event: string, state: unknown, parameters: unknown): void {
        const itemEventMessage = new ItemEventMessage();
        itemEventMessage.setItemid(itemId);
        itemEventMessage.setEvent(event);
        itemEventMessage.setStatejson(JSON.stringify(state));
        itemEventMessage.setParametersjson(JSON.stringify(parameters));

        const clientToServerMessage = new ClientToServerMessage();
        clientToServerMessage.setItemeventmessage(itemEventMessage);

        this.socket.send(clientToServerMessage.serializeBinary().buffer);
    }

    onActionableEvent(callback: (message: ItemEventMessageInterface) => void): void {
        this.onMessage(EventMessage.ITEM_EVENT, (message: ItemEventMessage) => {
            callback({
                itemId: message.getItemid(),
                event: message.getEvent(),
                parameters: JSON.parse(message.getParametersjson()),
                state: JSON.parse(message.getStatejson())
            });
        });
    }
}
