import { ADMIN_API_TOKEN, ADMIN_API_URL, ADMIN_URL } from "../Enum/EnvironmentVariable";
import Axios from "axios";
import { GameRoomPolicyTypes } from "_Model/PusherRoom";
import { CharacterTexture } from "./AdminApi/CharacterTexture";
import { MapDetailsData } from "./AdminApi/MapDetailsData";
import { RoomRedirect } from "./AdminApi/RoomRedirect";

export interface AdminApiData {
    roomUrl: string;
    email: string | null;
    mapUrlStart: string;
    tags: string[];
    policy_type: number;
    userUuid: string;
    messages?: unknown[];
    textures: CharacterTexture[];
}

export interface AdminBannedData {
    is_banned: boolean;
    message: string;
}

export interface FetchMemberDataByUuidResponse {
    userUuid: string;
    tags: string[];
    visitCardUrl: string | null;
    textures: CharacterTexture[];
    messages: unknown[];
    anonymous?: boolean;
}

class AdminApi {
    /**
     * @var playUri: is url of the room
     * @var userId: can to be undefined or email or uuid
     * @return MapDetailsData|RoomRedirect
     */
    async fetchMapDetails(playUri: string, userId?: string): Promise<MapDetailsData | RoomRedirect> {
        if (!ADMIN_API_URL) {
            return Promise.reject(new Error("No admin backoffice set!"));
        }

        const params: { playUri: string; userId?: string } = {
            playUri,
            userId,
        };

        const res = await Axios.get(ADMIN_API_URL + "/api/map", {
            headers: { Authorization: `${ADMIN_API_TOKEN}` },
            params,
        });
        return res.data;
    }

    async fetchMemberDataByUuid(
        userIdentifier: string | null,
        roomId: string,
        ipAddress: string
    ): Promise<FetchMemberDataByUuidResponse> {
        if (!ADMIN_API_URL) {
            return Promise.reject(new Error("No admin backoffice set!"));
        }
        const res = await Axios.get(ADMIN_API_URL + "/api/room/access", {
            params: { userIdentifier, roomId, ipAddress },
            headers: { Authorization: `${ADMIN_API_TOKEN}` },
        });
        return res.data;
    }

    async fetchMemberDataByToken(organizationMemberToken: string): Promise<AdminApiData> {
        if (!ADMIN_API_URL) {
            return Promise.reject(new Error("No admin backoffice set!"));
        }
        //todo: this call can fail if the corresponding world is not activated or if the token is invalid. Handle that case.
        const res = await Axios.get(ADMIN_API_URL + "/api/login-url/" + organizationMemberToken, {
            headers: { Authorization: `${ADMIN_API_TOKEN}` },
        });
        return res.data;
    }

    async fetchCheckUserByToken(organizationMemberToken: string): Promise<AdminApiData> {
        if (!ADMIN_API_URL) {
            return Promise.reject(new Error("No admin backoffice set!"));
        }
        //todo: this call can fail if the corresponding world is not activated or if the token is invalid. Handle that case.
        const res = await Axios.get(ADMIN_API_URL + "/api/check-user/" + organizationMemberToken, {
            headers: { Authorization: `${ADMIN_API_TOKEN}` },
        });
        return res.data;
    }

    reportPlayer(
        reportedUserUuid: string,
        reportedUserComment: string,
        reporterUserUuid: string,
        reportWorldSlug: string
    ) {
        return Axios.post(
            `${ADMIN_API_URL}/api/report`,
            {
                reportedUserUuid,
                reportedUserComment,
                reporterUserUuid,
                reportWorldSlug,
            },
            {
                headers: { Authorization: `${ADMIN_API_TOKEN}` },
            }
        );
    }

    async verifyBanUser(userUuid: string, ipAddress: string, roomUrl: string): Promise<AdminBannedData> {
        if (!ADMIN_API_URL) {
            return Promise.reject(new Error("No admin backoffice set!"));
        }
        //todo: this call can fail if the corresponding world is not activated or if the token is invalid. Handle that case.
        return Axios.get(
            ADMIN_API_URL +
                "/api/ban" +
                "?ipAddress=" +
                encodeURIComponent(ipAddress) +
                "&token=" +
                encodeURIComponent(userUuid) +
                "&roomUrl=" +
                encodeURIComponent(roomUrl),
            { headers: { Authorization: `${ADMIN_API_TOKEN}` } }
        ).then((data) => {
            return data.data;
        });
    }

    async getUrlRoomsFromSameWorld(roomUrl: string): Promise<string[]> {
        if (!ADMIN_API_URL) {
            return Promise.reject(new Error("No admin backoffice set!"));
        }

        return Axios.get(ADMIN_API_URL + "/api/room/sameWorld" + "?roomUrl=" + encodeURIComponent(roomUrl), {
            headers: { Authorization: `${ADMIN_API_TOKEN}` },
        }).then((data) => {
            return data.data;
        });
    }

    /*TODO add constant to use profile companny*/
    getProfileUrl(accessToken: string): string {
        if (!ADMIN_URL) {
            throw new Error("No admin backoffice set!");
        }

        return ADMIN_URL + `/profile?token=${accessToken}`;
    }
}

export const adminApi = new AdminApi();
