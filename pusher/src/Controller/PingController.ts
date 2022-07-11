import { BaseHttpController } from "./BaseHttpController";
import { apiClientRepository } from "../Services/ApiClientRepository";
import { PingMessage } from "../Messages/generated/messages_pb";
import { Metadata } from "grpc";

export class PingController extends BaseHttpController {
    // Returns a map mapping map name to file name of the map
    routes(): void {
        /**
         * @openapi
         * /ping:
         *   get:
         *     description: Returns a "pong" message. This endpoint can be useful to check if the application is alive.
         *     produces:
         *      - "text/plain;charset=UTF-8"
         *     responses:
         *       200:
         *         description: OK
         *         content:
         *           text/plain:
         *             schema:
         *               type: string
         *               example: pong
         *
         */
        this.app.get("/ping", (req, res) => {
            res.status(200).send("pong");
            return;
        });

        /**
         * @openapi
         * /ping-back:
         *   get:
         *     description: Returns a "pong" message if all back servers could be reached.
         *     produces:
         *      - "text/plain;charset=UTF-8"
         *     responses:
         *       200:
         *         description: OK
         *         content:
         *           text/plain:
         *             schema:
         *               type: string
         *               example: pong
         *       503:
         *         description: One or more back servers are unreachable
         *         content:
         *           text/plain:
         *             schema:
         *               type: string
         *               example: ko
         *
         */
        this.app.get("/ping-backs", (req, res) => {
            (async (): Promise<void> => {
                const clients = await apiClientRepository.getAllClients();

                const promises: Promise<PingMessage>[] = [];
                for (const client of clients) {
                    promises.push(
                        new Promise<PingMessage>((resolve, reject) => {
                            client.ping(
                                new PingMessage(),
                                new Metadata(),
                                {
                                    deadline: Date.now() + 1000,
                                },
                                (error, result) => {
                                    if (error) {
                                        reject(error);
                                    } else {
                                        resolve(result);
                                    }
                                }
                            );
                        })
                    );
                }

                // Note: this call will take at most 1 second because we won't wait more for all the promises to resolve.
                const pingsResult = await Promise.allSettled(promises);

                for (const pingResult of pingsResult) {
                    if (pingResult.status === "rejected") {
                        res.status(503).send("ko");
                        return;
                    }
                }

                res.status(200).send("pong");
                return;
            })().catch((e) => console.error(e));
        });
    }
}
