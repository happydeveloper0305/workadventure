import { WokaDetail, WokaDetailsResult, WokaList, wokaPartNames } from "../Messages/JsonMessages/PlayerTextures";
import { WokaServiceInterface } from "./WokaServiceInterface";

class LocalWokaService implements WokaServiceInterface {
    /**
     * Returns the list of all available Wokas & Woka Parts for the current user.
     */
    async getWokaList(roomId: string, token: string): Promise<WokaList | undefined> {
        const wokaData: WokaList = await require("../../data/woka.json");
        if (!wokaData) {
            return undefined;
        }
        return wokaData;
    }

    /**
     * Returns the URL of all the images for the given texture ids.
     *
     * Key: texture id
     * Value: URL
     *
     * If one of the textures cannot be found, undefined is returned (and the user should be redirected to Woka choice page!)
     */
    async fetchWokaDetails(textureIds: string[]): Promise<WokaDetailsResult | undefined> {
        const wokaData: WokaList = await require("../../data/woka.json");
        const textures = new Map<
            string,
            {
                url: string;
                layer: string;
            }
        >();
        const searchIds = new Set(textureIds);

        for (const part of wokaPartNames) {
            const wokaPartType = wokaData[part];
            if (!wokaPartType) {
                continue;
            }

            for (const collection of wokaPartType.collections) {
                for (const id of searchIds) {
                    const texture = collection.textures.find((texture) => texture.id === id);

                    if (texture) {
                        textures.set(id, {
                            url: texture.url,
                            layer: part,
                        });
                        searchIds.delete(id);
                    }
                }
            }
        }

        if (textureIds.length !== textures.size) {
            return undefined;
        }

        const details: WokaDetail[] = [];

        textures.forEach((value, key) => {
            details.push({
                id: key,
                url: value.url,
                layer: value.layer,
            });
        });

        return details;
    }
}

export const localWokaService = new LocalWokaService();
