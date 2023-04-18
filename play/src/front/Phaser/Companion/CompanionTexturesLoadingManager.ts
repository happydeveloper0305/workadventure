import CancelablePromise from "cancelable-promise";
import { CompanionTexture, CompanionCollectionList, companionCollectionList } from "@workadventure/messages";
import { gameManager } from "../Game/GameManager";
import { localUserStore } from "../../Connexion/LocalUserStore";
import type { SuperLoaderPlugin } from "../Services/SuperLoaderPlugin";
import { ABSOLUTE_PUSHER_URL } from "../../Enum/ComputedConst";
import LoaderPlugin = Phaser.Loader.LoaderPlugin;

export function companionListMetakey() {
    return "companion-list" + gameManager.currentStartedRoom.href;
}

let companionTextureList: CompanionCollectionList | null = null;
export class CompanionTexturesLoadingManager {
    constructor(private superLoad: SuperLoaderPlugin, private loader: LoaderPlugin) {}

    loadTextures(processListCallback: (_l: CompanionCollectionList) => void) {
        if (companionTextureList) return processListCallback(companionTextureList);

        this.superLoad
            .json(
                companionListMetakey(),
                new URL(
                    `companion/list?roomUrl=` + encodeURIComponent(gameManager.currentStartedRoom.href),
                    ABSOLUTE_PUSHER_URL
                ).toString(),
                undefined,
                {
                    responseType: "text",
                    headers: {
                        Authorization: localUserStore.getAuthToken() ?? "",
                    },
                    withCredentials: true,
                },
                (_key, _type, data) => {
                    companionTextureList = companionCollectionList.parse(data);
                    processListCallback(companionTextureList);
                }
            )
            .catch((e: unknown) => {
                console.error("Could not fetch companion list from pusher", e);
            });
    }

    public lazyLoadById(textureId: string | null): CancelablePromise<string> | undefined {
        if (!textureId) return undefined;
        return new CancelablePromise((resolve, reject, cancel) => {
            cancel(() => {
                return;
            });

            this.loadTextures((companionList) => {
                const texture = companionList.companion.collections
                    .flatMap((collection) => collection.textures)
                    .find((t) => t.id === textureId);
                if (!texture) {
                    console.error(`Companion texture ${textureId} not found`);
                    return reject(`Companion texture '${textureId}' not found!`);
                }

                this.loadByTexture(texture, resolve);

                this.loader.start(); // It's only automatically started during the Scene preload.
            });
        });
    }

    public loadByTexture(texture: CompanionTexture, onLoaded: (_textureId: string) => void = () => {}) {
        if (this.loader.textureManager.exists(texture.id)) return onLoaded(texture.id);

        this.loader.spritesheet(texture.id, texture.url, { frameWidth: 32, frameHeight: 32, endFrame: 12 });
        this.loader.once(`filecomplete-spritesheet-${texture.id}`, () => onLoaded(texture.id));
    }
}
