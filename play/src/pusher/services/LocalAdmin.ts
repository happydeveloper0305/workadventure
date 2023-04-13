import path from "path";
import type { MapDetailsData, RoomRedirect, AdminApiData, ErrorApiData } from "@workadventure/messages";
import { OpidWokaNamePolicy } from "@workadventure/messages";
import {
    DISABLE_ANONYMOUS,
    ENABLE_CHAT,
    ENABLE_CHAT_UPLOAD,
    PUBLIC_MAP_STORAGE_URL,
    START_ROOM_URL,
    OPID_WOKA_NAME_POLICY,
    ENABLE_CHAT_ONLINE_LIST,
    ENABLE_CHAT_DISCONNECTED_LIST,
} from "../enums/EnvironmentVariable";
import type { AdminInterface } from "./AdminInterface";
import type { AdminBannedData, FetchMemberDataByUuidResponse } from "./AdminApi";
import { localWokaService } from "./LocalWokaService";
import { MetaTagsDefaultValue } from "./MetaTagsBuilder";

/**
 * A local class mocking a real admin if no admin is configured.
 */
class LocalAdmin implements AdminInterface {
    async fetchMemberDataByUuid(
        userIdentifier: string,
        accessToken: string | undefined,
        playUri: string,
        ipAddress: string,
        characterLayers: string[],
        locale?: string
    ): Promise<FetchMemberDataByUuidResponse> {
        let canEdit = false;
        const roomUrl = new URL(playUri);
        const match = /\/~\/(.+)/.exec(roomUrl.pathname);
        if (match) {
            canEdit = true;
        }
        const mucRooms = [{ name: "Connected users", url: playUri, type: "default", subscribe: false }];
        if (ENABLE_CHAT) {
            mucRooms.push({ name: "Welcome", url: `${playUri}/forum/welcome`, type: "forum", subscribe: false });
        }
        return {
            email: userIdentifier,
            userUuid: userIdentifier,
            tags: [],
            messages: [],
            visitCardUrl: null,
            textures: (await localWokaService.fetchWokaDetails(characterLayers)) ?? [],
            userRoomToken: undefined,
            mucRooms,
            activatedInviteUser: true,
            canEdit,
        };
    }

    fetchMapDetails(
        playUri: string,
        authToken?: string,
        locale?: string
    ): Promise<MapDetailsData | RoomRedirect | ErrorApiData> {
        const roomUrl = new URL(playUri);

        if (roomUrl.pathname === "/") {
            roomUrl.pathname = START_ROOM_URL;
            return Promise.resolve({
                redirectUrl: roomUrl.toString(),
            });
        }

        let mapUrl = undefined;
        let wamUrl = undefined;
        const canEdit = false;
        const entityCollectionsUrls = [];

        let match = /\/~\/(.+)/.exec(roomUrl.pathname);
        if (match) {
            if (path.extname(roomUrl.pathname) === ".tmj") {
                return Promise.resolve({
                    redirectUrl: roomUrl.toString().replace(".tmj", ".wam"),
                });
            }
            wamUrl = `${PUBLIC_MAP_STORAGE_URL}/${match[1]}`;
            entityCollectionsUrls.push(`${PUBLIC_MAP_STORAGE_URL}/entityCollections`);
        } else {
            match = /\/_\/[^/]+\/(.+)/.exec(roomUrl.pathname);
            if (!match) {
                return Promise.resolve({
                    type: "error",
                    code: "UNSUPPORTED_URL_FORMAT",
                    title: "Unsupported URL format",
                    details: "Unsupported path: " + roomUrl.pathname,
                    image: "",
                    subtitle: "",
                });
            }
            mapUrl = roomUrl.protocol + "//" + match[1];
        }

        const opidWokaNamePolicyCheck = OpidWokaNamePolicy.safeParse(OPID_WOKA_NAME_POLICY);

        return Promise.resolve({
            mapUrl,
            wamUrl,
            canEdit,
            entityCollectionsUrls,
            authenticationMandatory: DISABLE_ANONYMOUS,
            contactPage: null,
            mucRooms: null,
            group: null,
            iframeAuthentication: null,
            opidLogoutRedirectUrl: null,
            opidUsernamePolicy: opidWokaNamePolicyCheck.success ? opidWokaNamePolicyCheck.data : null,
            miniLogo: null,
            loadingLogo: null,
            loginSceneLogo: null,
            showPoweredBy: true,
            loadingCowebsiteLogo: null,
            enableChat: ENABLE_CHAT,
            enableChatUpload: ENABLE_CHAT_UPLOAD,
            enableChatOnlineList: ENABLE_CHAT_ONLINE_LIST,
            enableChatDisconnectedList: ENABLE_CHAT_DISCONNECTED_LIST,
            metatags: {
                ...MetaTagsDefaultValue,
            },
        });
    }

    async fetchMemberDataByToken(
        organizationMemberToken: string,
        playUri: string | null,
        locale?: string
    ): Promise<AdminApiData> {
        return Promise.reject(new Error("No admin backoffice set!"));
    }

    fetchWellKnownChallenge(host: string): Promise<string> {
        return Promise.reject(new Error("No admin backoffice set!"));
    }

    reportPlayer(
        reportedUserUuid: string,
        reportedUserComment: string,
        reporterUserUuid: string,
        roomUrl: string,
        locale?: string
    ): Promise<unknown> {
        return Promise.reject(new Error("No admin backoffice set!"));
    }

    async verifyBanUser(
        userUuid: string,
        ipAddress: string,
        roomUrl: string,
        locale?: string
    ): Promise<AdminBannedData> {
        return Promise.reject(new Error("No admin backoffice set!"));
    }

    async getUrlRoomsFromSameWorld(roomUrl: string, locale?: string): Promise<string[]> {
        return Promise.reject(new Error("No admin backoffice set!"));
    }

    getProfileUrl(accessToken: string, playUri: string): string {
        new Error("No admin backoffice set!");
        return "";
    }

    async logoutOauth(token: string): Promise<void> {
        return Promise.reject(new Error("No admin backoffice set!"));
    }

    banUserByUuid(
        uuidToBan: string,
        playUri: string,
        name: string,
        message: string,
        byUserEmail: string
    ): Promise<boolean> {
        return Promise.reject(new Error("No admin backoffice set!"));
    }
}

export const localAdmin = new LocalAdmin();
