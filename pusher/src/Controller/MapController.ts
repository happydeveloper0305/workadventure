import { HttpRequest, HttpResponse, TemplatedApp } from "uWebSockets.js";
import { BaseController } from "./BaseController";
import { parse } from "query-string";
import { adminApi } from "../Services/AdminApi";
import { ADMIN_API_URL } from "../Enum/EnvironmentVariable";
import { GameRoomPolicyTypes } from "../Model/PusherRoom";
import { MapDetailsData } from "../Services/AdminApi/MapDetailsData";
import { socketManager } from "../Services/SocketManager";
import { AuthTokenData, jwtTokenManager } from "../Services/JWTTokenManager";
import { v4 } from "uuid";

export class MapController extends BaseController {
    constructor(private App: TemplatedApp) {
        super();
        this.App = App;
        this.getMapUrl();
    }

    // Returns a map mapping map name to file name of the map
    getMapUrl() {
        this.App.options("/map", (res: HttpResponse, req: HttpRequest) => {
            this.addCorsHeaders(res);

            res.end();
        });

        this.App.get("/map", (res: HttpResponse, req: HttpRequest) => {
            res.onAborted(() => {
                console.warn("/map request was aborted");
            });

            const query = parse(req.getQuery());

            if (typeof query.playUri !== "string") {
                console.error("Expected playUri parameter in /map endpoint");
                res.writeStatus("400 Bad request");
                this.addCorsHeaders(res);
                res.end("Expected playUri parameter");
                return;
            }

            // If no admin URL is set, let's react on '/_/[instance]/[map url]' URLs
            if (!ADMIN_API_URL) {
                const roomUrl = new URL(query.playUri);

                const match = /\/_\/[^/]+\/(.+)/.exec(roomUrl.pathname);
                if (!match) {
                    res.writeStatus("404 Not Found");
                    this.addCorsHeaders(res);
                    res.end(JSON.stringify({}));
                    return;
                }

                const mapUrl = roomUrl.protocol + "//" + match[1];

                res.writeStatus("200 OK");
                this.addCorsHeaders(res);
                res.end(
                    JSON.stringify({
                        mapUrl,
                        policy_type: GameRoomPolicyTypes.ANONYMOUS_POLICY,
                        roomSlug: "", // Deprecated
                        group: null,
                        tags: [],
                        textures: [],
                        contactPage: undefined,
                    } as MapDetailsData)
                );

                return;
            }

            (async () => {
                try {
                    let userId: string | undefined = undefined;
                    if (query.authToken != undefined) {
                        let authTokenData: AuthTokenData;
                        try {
                            authTokenData = jwtTokenManager.verifyJWTToken(query.authToken as string);
                            userId = authTokenData.identifier;
                        } catch (e) {
                            // Decode token, in this case we don't need to create new token.
                            authTokenData = jwtTokenManager.verifyJWTToken(query.authToken as string, true);
                            userId = authTokenData.identifier;
                            console.info("JWT expire, but decoded", userId);
                        }
                    }
                    const mapDetails = await adminApi.fetchMapDetails(query.playUri as string, userId);

                    res.writeStatus("200 OK");
                    this.addCorsHeaders(res);
                    res.end(JSON.stringify(mapDetails));
                } catch (e) {
                    this.errorToResponse(e, res);
                }
            })();
        });
    }
}
