import { RoomApiServer as RoomApiServerInterface } from "@workadventure/messages/src/ts-proto-generated/room-api";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { apiClientRepository } from "../pusher/services/ApiClientRepository";
import AuthenticationGuard from "./guards/AuthenticationGuard";
import { GuardError } from "./types/GuardError";

export default {
    readVariable: function (call, callback) {
        AuthenticationGuard(call.metadata, call.request.room)
            .then(() => {
                apiClientRepository
                    .getClient(call.request.room)
                    .then((apiClient) => {
                        apiClient.readVariable(call.request, (error, response) => {
                            if (error) {
                                return callback(error);
                            }

                            return callback(null, response);
                        });
                    })
                    .catch((error) => {
                        console.error("Internal authentication error:", error);
                        return callback({
                            code: Status.INTERNAL,
                            details: "Internal error, please contact us!",
                        });
                    });
            })
            .catch((error) => {
                if (error instanceof GuardError) {
                    return callback({
                        code: error.code,
                        details: error.details,
                    });
                }

                if ("code" in error && "details" in error) {
                    return callback({
                        code: error.code,
                        details: error.details,
                    });
                }

                console.error("Internal authentication error:", error);
                return callback({
                    code: Status.INTERNAL,
                    details: "Internal error, please contact us!",
                });
            });
    },
    listenVariable: (call) => {
        AuthenticationGuard(call.metadata, call.request.room)
            .then(() => {
                apiClientRepository
                    .getClient(call.request.room)
                    .then((apiClient) => {
                        const variableListener = apiClient.listenVariable(call.request);

                        variableListener.on("data", (response) => {
                            call.write(response);
                        });

                        variableListener.on("cancelled", () => {
                            call.end();
                        });

                        variableListener.on("error", (e) => {
                            call.end(e);
                        });

                        call.on("cancelled", () => {
                            variableListener.cancel();
                            call.end();
                        });
                        call.on("error", (e) => {
                            variableListener.cancel();
                            call.end();
                        });
                    })
                    .catch((error) => {
                        console.error("Error on creating api client!", error);
                        call.destroy(new Error("Internal error, please contact us!"));
                        return;
                    });
            })
            .catch((error) => {
                return call.destroy(error);
            });
    },
    saveVariable: (call, callback) => {
        AuthenticationGuard(call.metadata, call.request.room)
            .then((authentication) => {
                apiClientRepository
                    .getClient(call.request.room)
                    .then((apiClient) => {
                        apiClient.saveVariable(call.request, (error, response) => {
                            if (error) {
                                return callback(error);
                            }

                            callback(null, response);
                        });
                    })
                    .catch((error) => {
                        console.error("Error on creating api client!", error);
                        return callback({
                            code: Status.INTERNAL,
                            details: "Internal error, please contact us!",
                        });
                    });
            })
            .catch((error) => {
                if (error instanceof GuardError) {
                    return callback({
                        code: error.code,
                        details: error.details,
                    });
                }

                if ("code" in error && "details" in error) {
                    return callback({
                        code: error.code,
                        details: error.details,
                    });
                }

                console.error("Internal authentication error:", error);
                return callback({
                    code: Status.INTERNAL,
                    details: "Internal error, please contact us!",
                });
            });
    },
} satisfies RoomApiServerInterface;
