import { AdminPusherToBackMessage, ServerToAdminClientMessage } from "../../Messages/generated/messages_pb";
import { compressors } from "hyper-express";
import { ClientDuplexStream } from "grpc";

export type AdminConnection = ClientDuplexStream<AdminPusherToBackMessage, ServerToAdminClientMessage>;

export interface ExAdminSocketInterface extends compressors.WebSocket {
    adminConnection: AdminConnection;
    disconnecting: boolean;
}
