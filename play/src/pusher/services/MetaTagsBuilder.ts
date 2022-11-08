import { ITiledMap } from "@workadventure/tiled-map-type-guard";
import type { MetaTagsData, RequiredMetaTagsData, MapDetailsData } from "@workadventure/messages";
import { isMapDetailsData } from "@workadventure/messages";
import { adminService } from "./AdminService";
import axios from "axios";
import { ADMIN_API_URL } from "../enums/EnvironmentVariable";
import type { RoomRedirect } from "../../messages/JsonMessages/RoomRedirect";
import { isRoomRedirect } from "../../messages/JsonMessages/RoomRedirect";
import type { ErrorApiData } from "../../messages/JsonMessages/ErrorApiData";

export const MetaTagsDefaultValue: RequiredMetaTagsData = {
    title: "WorkAdventure",
    description: "Create your own digital office, Metaverse and meet online with the world.",
    favIcons: [
        {
            rel: "icon",
            sizes: "16x16",
            src: "/static/images/favicons/favicon-16x16.png",
        },
        {
            rel: "icon",
            sizes: "32x32",
            src: "/static/images/favicons/favicon-32x32.png",
        },
        {
            rel: "apple-touch-icon",
            sizes: "57x57",
            src: "/static/images/favicons/apple-icon-57x57.png",
        },
        {
            rel: "apple-touch-icon",
            sizes: "/static/images/favicons/apple-icon-60x60.png",
            src: "60x60",
        },
        {
            rel: "apple-touch-icon",
            sizes: "/static/images/favicons/apple-icon-72x72.png",
            src: "72x72",
        },
        {
            rel: "apple-touch-icon",
            sizes: "/static/images/favicons/apple-icon-76x76.png",
            src: "76x76",
        },
        {
            rel: "icon",
            sizes: "96x96",
            src: "/static/images/favicons/favicon-96x96.png",
        },
        {
            rel: "apple-touch-icon",
            sizes: "114x114",
            src: "static/images/favicons/apple-icon-114x114.png",
        },
        {
            rel: "apple-touch-icon",
            sizes: "120x120",
            src: "/static/images/favicons/apple-icon-120x120.png",
        },
        {
            rel: "apple-touch-icon",
            sizes: "144x144",
            src: "/static/images/favicons/apple-icon-144x144.png",
        },
        {
            rel: "apple-touch-icon",
            sizes: "152x152",
            src: "/static/images/favicons/apple-icon-152x152.png",
        },
        {
            rel: "apple-touch-icon",
            sizes: "180x180",
            src: "/static/images/favicons/apple-icon-180x180.png",
        },
        {
            rel: "icon",
            sizes: "192x192",
            src: "/static/images/favicons/android-icon-192x192.png",
        },
    ],
    manifestIcons: [
        {
            src: "/static/images/favicons/apple-icon-57x57.png",
            sizes: "57x57",
            type: "image/png",
        },
        {
            src: "/static/images/favicons/apple-icon-60x60.png",
            sizes: "60x60",
            type: "image/png",
        },
        {
            src: "/static/images/favicons/apple-icon-72x72.png",
            sizes: "72x72",
            type: "image/png",
        },
        {
            src: "/static/images/favicons/apple-icon-76x76.png",
            sizes: "76x76",
            type: "image/png",
        },
        {
            src: "/static/images/favicons/apple-icon-114x114.png",
            sizes: "114x114",
            type: "image/png",
        },
        {
            src: "/static/images/favicons/apple-icon-120x120.png",
            sizes: "120x120",
            type: "image/png",
        },
        {
            src: "/static/images/favicons/apple-icon-144x144.png",
            sizes: "144x144",
            type: "image/png",
        },
        {
            src: "/static/images/favicons/apple-icon-152x152.png",
            sizes: "152x152",
            type: "image/png",
        },
        {
            src: "/static/images/favicons/apple-icon-180x180.png",
            sizes: "180x180",
            type: "image/png",
        },
        {
            src: "/static/images/favicons/apple-icon.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
        },

        {
            src: "/static/images/favicons/android-icon-36x36.png",
            sizes: "36x36",
            type: "image/png",
        },
        {
            src: "/static/images/favicons/android-icon-48x48.png",
            sizes: "48x48",
            type: "image/png",
        },
        {
            src: "/static/images/favicons/android-icon-72x72.png",
            sizes: "72x72",
            type: "image/png",
        },
        {
            src: "/static/images/favicons/android-icon-96x96.png",
            sizes: "96x96",
            type: "image/png",
        },
        {
            src: "/static/images/favicons/android-icon-144x144.png",
            sizes: "144x144",
            type: "image/png",
        },
        {
            src: "/static/images/favicons/android-icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
        },

        {
            src: "/static/images/favicons/favicon-16x16.png",
            sizes: "16x16",
            type: "image/png",
        },
        {
            src: "/static/images/favicons/favicon-32x32.png",
            sizes: "32x32",
            type: "image/png",
        },
        {
            src: "/static/images/favicons/favicon-96x96.png",
            sizes: "96x96",
            type: "image/png",
        },
        {
            src: "/static/images/favicons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
        },
    ],
    appName: "WorkAdventure",
    shortAppName: "WA",
    themeColor: "#000000",
    cardImage: "https://workadventu.re/images/general/logo-og.png",
};

export class MetaTagsBuilder {
    private mapDetails: MapDetailsData | RoomRedirect | ErrorApiData | undefined;

    constructor(private url: string) {}

    public async getMeta(userAgent: string): Promise<RequiredMetaTagsData> {
        if (ADMIN_API_URL) {
            const metaTags = await this.getMetaFromAdmin();
            if (metaTags) {
                return { ...MetaTagsDefaultValue, ...metaTags };
            }
        }
        // Let's only populate the metadata for bots. For normal users, this is useless and it wastes time
        // downloading the map from the Pusher.
        userAgent = userAgent.toLowerCase();
        // "bot" covers Twitter and Google
        // "facebook" covers obviously Facebook
        // "preview" covers Bing and Microsoft products
        if (userAgent.includes("bot") || userAgent.includes("facebook") || userAgent.includes("preview")) {
            return (await this.getMetaFromFile()) || MetaTagsDefaultValue;
        }

        return MetaTagsDefaultValue;
    }

    private async fetchMapDetailsData(): Promise<MapDetailsData | undefined> {
        if (!ADMIN_API_URL) {
            return undefined;
        }

        const fetchedData = await this.fetchMapDetails();

        const checkMapDetails = isMapDetailsData.safeParse(fetchedData);
        return checkMapDetails.success ? checkMapDetails.data : undefined;
    }

    private async fetchMapDetails(): Promise<MapDetailsData | RoomRedirect | ErrorApiData | undefined> {
        if (!ADMIN_API_URL) {
            return undefined;
        }
        if (this.mapDetails) {
            return this.mapDetails;
        }

        this.mapDetails = await adminService.fetchMapDetails(this.url);

        return this.mapDetails;
    }

    private async getMetaFromAdmin(): Promise<MetaTagsData | undefined> {
        try {
            const mapDetails = await this.fetchMapDetailsData();
            if (mapDetails === undefined) {
                return undefined;
            }
            return mapDetails.metatags ?? undefined;
        } catch (e) {
            console.error("Error on getting map details", e);
            return undefined;
        }
    }

    private async fetchMapFile(): Promise<ITiledMap | undefined> {
        // Note: we could probably read the map file ONLY if the request comes from a bot.
        // Otherwise, the map file is already read in the Game scene!

        // FIXME: This is incorrect, we need to fetch the mapUrl from the adminService.
        // FIXME: This is incorrect, we need to fetch the mapUrl from the adminService.
        // FIXME: This is incorrect, we need to fetch the mapUrl from the adminService.
        // FIXME: This is incorrect, we need to fetch the mapUrl from the adminService.
        // FIXME: This is incorrect, we need to fetch the mapUrl from the adminService.
        // Then, we need to cache the call to the mapUrl to avoid too many calls (possibly setting up axios to use etags too!)
        const urlObject = new URL(this.url);
        let mapUrl = urlObject.pathname;
        const urlParsed = mapUrl.substring(1).split("/");
        mapUrl = "http://" + urlParsed.splice(2, urlParsed.length - 1).join("/");

        const fetchedData = await axios.get(mapUrl);

        const checkMapFile = ITiledMap.safeParse(fetchedData.data);
        return checkMapFile.success ? checkMapFile.data : undefined;
    }

    private metaValuesFromMapFile(mapFile: ITiledMap): RequiredMetaTagsData {
        if (!mapFile.properties) {
            return MetaTagsDefaultValue;
        }

        const mapNameProperty = mapFile.properties.find((property) => property.name === "mapName");
        const mapDescriptionProperty = mapFile.properties.find((property) => property.name === "mapDescription");

        return {
            title: mapNameProperty?.value
                ? `${MetaTagsDefaultValue.title} - ${String(mapNameProperty.value)}`
                : MetaTagsDefaultValue.title,
            description: mapDescriptionProperty?.value
                ? String(mapDescriptionProperty.value)
                : MetaTagsDefaultValue.description,
            favIcons: MetaTagsDefaultValue.favIcons,
            manifestIcons: MetaTagsDefaultValue.manifestIcons,
            appName: MetaTagsDefaultValue.appName,
            shortAppName: MetaTagsDefaultValue.shortAppName,
            themeColor: MetaTagsDefaultValue.themeColor,
            cardImage: MetaTagsDefaultValue.cardImage,
        };
    }

    private async getMetaFromFile(): Promise<RequiredMetaTagsData | undefined> {
        let mapFile: ITiledMap | undefined;

        try {
            mapFile = await this.fetchMapFile();
        } catch (e) {
            console.error("Error on getting map file", e);
        }

        if (!mapFile) {
            return mapFile;
        }

        return this.metaValuesFromMapFile(mapFile);
    }

    public async getRedirectUrl(): Promise<string | undefined> {
        const mapDetails = await this.fetchMapDetails();
        const safeParse = isRoomRedirect.safeParse(mapDetails);
        if (safeParse.success) {
            return safeParse.data.redirectUrl;
        }
        return undefined;
    }
}
