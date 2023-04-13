import {
    Command,
    CommandConfig,
    GameMap,
    UpdateAreaCommand,
    DeleteAreaCommand,
    UpdateEntityCommand,
    CreateAreaCommand,
    CreateEntityCommand,
    DeleteEntityCommand,
    EntityCollection,
    EntityPrefab,
    EntityRawPrefab,
    WAMFileFormat,
} from "@workadventure/map-editor";
import { EditMapCommandMessage } from "@workadventure/messages";
import { ITiledMap } from "@workadventure/tiled-map-type-guard";
import { fileSystem } from "./fileSystem";

// TODO: dynamic imports?
import furnitureCollection from "./entities/collections/FurnitureCollection.json";
import officeCollection from "./entities/collections/OfficeCollection.json";

class MapsManager {
    private loadedMaps: Map<string, GameMap>;
    private loadedMapsCommandsQueue: Map<string, EditMapCommandMessage[]>;
    private loadedCollections: Map<string, EntityCollection>;

    private saveMapIntervals: Map<string, NodeJS.Timer>;
    private mapLastChangeTimestamp: Map<string, number>;

    /**
     * Attempt to save the map from memory to file every time interval
     */
    private readonly AUTO_SAVE_INTERVAL_MS: number = 15 * 1000; // 15 seconds
    /**
     * Time after which the command will be removed from the commands queue
     */
    private readonly COMMAND_TIME_IN_QUEUE_MS: number = this.AUTO_SAVE_INTERVAL_MS * 2;
    /**
     * Kill saving map interval after given time of no changes done to the map
     */
    private readonly NO_CHANGE_DETECTED_MS: number = 1 * 60 * 1000; // 1 minute

    constructor() {
        this.loadedMaps = new Map<string, GameMap>();
        this.loadedMapsCommandsQueue = new Map<string, EditMapCommandMessage[]>();
        this.saveMapIntervals = new Map<string, NodeJS.Timer>();
        this.mapLastChangeTimestamp = new Map<string, number>();

        this.loadedCollections = new Map<string, EntityCollection>();

        for (const collection of [furnitureCollection, officeCollection]) {
            const parsedCollectionPrefabs: EntityPrefab[] = [];
            for (const rawPrefab of collection.collection) {
                parsedCollectionPrefabs.push(
                    this.parseRawEntityPrefab(collection.collectionName, rawPrefab as EntityRawPrefab)
                );
            }
            const parsedCollection: EntityCollection = structuredClone(collection) as EntityCollection;
            parsedCollection.collection = parsedCollectionPrefabs;
            this.loadedCollections.set(parsedCollection.collectionName, parsedCollection);
        }
    }

    public executeCommand(mapKey: string, commandConfig: CommandConfig, commandId?: string): void {
        const gameMap = this.getGameMap(mapKey);
        if (!gameMap) {
            throw new Error('Could not find GameMap with key "' + mapKey + '"');
        }
        this.mapLastChangeTimestamp.set(mapKey, +new Date());
        if (!this.saveMapIntervals.has(mapKey)) {
            this.startSavingMapInterval(mapKey, this.AUTO_SAVE_INTERVAL_MS);
        }
        let command: Command | undefined;
        switch (commandConfig.type) {
            case "UpdateAreaCommand": {
                command = new UpdateAreaCommand(gameMap, commandConfig, commandId);
                command.execute();
                break;
            }
            case "CreateAreaCommand": {
                command = new CreateAreaCommand(gameMap, commandConfig, commandId);
                command.execute();
                break;
            }
            case "DeleteAreaCommand": {
                command = new DeleteAreaCommand(gameMap, commandConfig, commandId);
                command.execute();
                break;
            }
            case "UpdateEntityCommand": {
                command = new UpdateEntityCommand(gameMap, commandConfig, commandId);
                command.execute();
                break;
            }
            case "CreateEntityCommand": {
                command = new CreateEntityCommand(gameMap, commandConfig, commandId);
                command.execute();
                break;
            }
            case "DeleteEntityCommand": {
                command = new DeleteEntityCommand(gameMap, commandConfig, commandId);
                command.execute();
                break;
            }
            default: {
                const _exhaustiveCheck: never = commandConfig;
                break;
            }
        }
    }

    public getCommandsNewerThan(mapKey: string, commandId: string): EditMapCommandMessage[] {
        // shouldn't we just apply every command on this list to the new client?
        const queue = this.loadedMapsCommandsQueue.get(mapKey);
        if (queue) {
            const commandIndex = queue.findIndex((command) => command.id === commandId);
            return queue.slice(commandIndex !== -1 ? commandIndex + 1 : 0);
        }
        return [];
    }

    public getGameMap(key: string): GameMap | undefined {
        return this.loadedMaps.get(key);
    }

    public getLoadedMaps(): string[] {
        return Array.from(this.loadedMaps.keys());
    }

    public isMapAlreadyLoaded(key: string): boolean {
        return this.loadedMaps.has(key);
    }

    public loadWAMToMemory(key: string, wam: WAMFileFormat): void {
        this.loadedMaps.set(key, new GameMap(this.getMockITiledMap(), wam));
    }

    public getEntityCollections(): EntityCollection[] {
        return Array.from(this.loadedCollections.values());
    }

    public getEntityPrefab(collectionName: string, entityId: string): EntityPrefab | undefined {
        return this.loadedCollections.get(collectionName)?.collection.find((entity) => entity.id === entityId);
    }

    public clearAfterUpload(key: string): void {
        console.log(`UPLOAD DETECTED. CLEAR CACHE FOR: ${key}`);
        this.loadedMaps.delete(key);
        this.loadedMapsCommandsQueue.delete(key);
        this.clearSaveMapInterval(key);
    }

    public addCommandToQueue(mapKey: string, message: EditMapCommandMessage): void {
        if (!this.loadedMapsCommandsQueue.has(mapKey)) {
            this.loadedMapsCommandsQueue.set(mapKey, []);
        }
        const queue = this.loadedMapsCommandsQueue.get(mapKey);
        if (queue !== undefined) {
            queue.push(message);
            this.setCommandDeletionTimeout(mapKey, message.id);
        }
        this.loadedMaps.get(mapKey)?.updateLastCommandIdProperty(message.id);
    }

    private getMockITiledMap(): ITiledMap {
        return {
            layers: [],
            tiledversion: "",
            tilesets: [],
            type: "map",
        };
    }

    private clearSaveMapInterval(key: string): boolean {
        const interval = this.saveMapIntervals.get(key);
        if (interval) {
            clearInterval(interval);
            this.saveMapIntervals.delete(key);
            this.mapLastChangeTimestamp.delete(key);
            return true;
        }
        return false;
    }

    private setCommandDeletionTimeout(mapKey: string, commandId: string): void {
        setTimeout(() => {
            const queue = this.loadedMapsCommandsQueue.get(mapKey);
            if (!queue || queue.length === 0) {
                return;
            }
            if (queue[0].id === commandId) {
                queue.splice(0, 1);
            }
        }, this.COMMAND_TIME_IN_QUEUE_MS);
    }

    private startSavingMapInterval(key: string, intervalMS: number): void {
        this.saveMapIntervals.set(
            key,
            setInterval(() => {
                (async () => {
                    console.log(`saving map ${key}`);
                    const gameMap = this.loadedMaps.get(key);
                    if (gameMap) {
                        await fileSystem.writeStringAsFile(key, JSON.stringify(gameMap.getWam()));
                    }
                    const lastChangeTimestamp = this.mapLastChangeTimestamp.get(key);
                    if (lastChangeTimestamp === undefined) {
                        return;
                    }
                    if (lastChangeTimestamp + this.NO_CHANGE_DETECTED_MS < +new Date()) {
                        console.log(`NO CHANGES ON THE MAP ${key} DETECTED. STOP AUTOSAVING`);
                        this.clearSaveMapInterval(key);
                    }
                })().catch((e) => console.error(e));
            }, intervalMS)
        );
    }

    private parseRawEntityPrefab(collectionName: string, rawPrefab: EntityRawPrefab): EntityPrefab {
        return {
            ...rawPrefab,
            collectionName,
            id: `${rawPrefab.name}:${rawPrefab.color}:${rawPrefab.direction}`,
        };
    }
}

export const mapsManager = new MapsManager();
