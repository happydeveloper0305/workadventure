import type { SignalData } from "simple-peer";
import type { RoomConnection } from "./RoomConnection";
import type { BodyResourceDescriptionInterface } from "../Phaser/Entity/PlayerTextures";
import { AvailabilityStatus, PositionMessage } from "../Messages/ts-proto-generated/protos/messages";

export interface MessageUserMovedInterface {
    userId: number;
    position: PositionMessage;
}

export interface MessageUserJoined {
    userId: number;
    name: string;
    characterLayers: BodyResourceDescriptionInterface[];
    position: PositionMessage;
    availabilityStatus: AvailabilityStatus;
    visitCardUrl: string | null;
    companion: string | null;
    userUuid: string;
    outlineColor: number | undefined;
}

export interface PositionInterface {
    x: number;
    y: number;
}

export interface GroupCreatedUpdatedMessageInterface {
    position: PositionInterface;
    groupId: number;
    groupSize?: number;
    locked?: boolean;
}

export interface GroupUsersUpdateMessageInterface {
    groupId: number;
    userIds: number[];
}

export interface WebRtcDisconnectMessageInterface {
    userId: number;
}

export interface WebRtcSignalReceivedMessageInterface {
    userId: number;
    signal: SignalData;
    webRtcUser: string | undefined;
    webRtcPassword: string | undefined;
}

export interface ViewportInterface {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export interface ItemEventMessageInterface {
    itemId: number;
    event: string;
    state: unknown;
    parameters: unknown;
}

export interface RoomJoinedMessageInterface {
    //users: MessageUserPositionInterface[],
    //groups: GroupCreatedUpdatedMessageInterface[],
    items: { [itemId: number]: unknown };
    variables: Map<string, unknown>;
    characterLayers: BodyResourceDescriptionInterface[];
}

export interface PlayGlobalMessageInterface {
    type: string;
    content: string;
    broadcastToWorld: boolean;
}

export interface OnConnectInterface {
    connection: RoomConnection;
    room: RoomJoinedMessageInterface;
}
