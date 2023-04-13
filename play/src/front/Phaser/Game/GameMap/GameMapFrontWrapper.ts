import { AreaDataProperties, GameMapProperties } from "@workadventure/map-editor";
import type { AreaChangeCallback, AreaData, GameMap } from "@workadventure/map-editor";
import type {
    ITiledMap,
    ITiledMapLayer,
    ITiledMapObject,
    ITiledMapProperty,
    ITiledMapTileLayer,
    Json,
} from "@workadventure/tiled-map-type-guard";
import type { Observable } from "rxjs";
import { Subject } from "rxjs";
import { MathUtils } from "@workadventure/math-utils";
import { PathTileType } from "../../../Utils/PathfindingManager";
import { DEPTH_OVERLAY_INDEX } from "../DepthIndexes";
import type { GameScene } from "../GameScene";
import { Entity } from "../../ECS/Entity";
import { TexturesHelper } from "../../Helpers/TexturesHelper";
import { ITiledPlace } from "../GameMapPropertiesListener";

export type DynamicArea = {
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    properties: { [key: string]: unknown };
};
import { EntitiesManager } from "./EntitiesManager";
import TilemapLayer = Phaser.Tilemaps.TilemapLayer;

export type LayerChangeCallback = (
    layersChangedByAction: Array<ITiledMapLayer>,
    allLayersOnNewPosition: Array<ITiledMapLayer>
) => void;

export type TiledAreaChangeCallback = (
    areasChangedByAction: Array<ITiledMapObject>,
    allAreasOnNewPosition: Array<ITiledMapObject>
) => void;

export type DynamicAreaChangeCallback = (
    areasChangedByAction: Array<DynamicArea>,
    allAreasOnNewPosition: Array<DynamicArea>
) => void;

export type PropertyChangeCallback = (
    newValue: string | number | boolean | undefined,
    oldValue: string | number | boolean | undefined,
    allProps: Map<string, string | boolean | number>
) => void;

export class GameMapFrontWrapper {
    private scene: GameScene;
    private gameMap: GameMap;

    private oldKey: number | undefined;
    /**
     * key is the index of the current tile.
     */
    private key: number | undefined;
    /**
     * oldPosition is the previous position of the player.
     */
    private oldPosition: { x: number; y: number } | undefined;
    /**
     * position is the current position of the player.
     */
    private position: { x: number; y: number } | undefined;

    /**
     * Manager for renderable, interactive objects that players can work with.
     */
    private entitiesManager: EntitiesManager;

    public readonly phaserMap: Phaser.Tilemaps.Tilemap;
    public readonly phaserLayers: TilemapLayer[] = [];
    public readonly tiledAreas: ITiledMapObject[] = [];
    /**
     * Areas that we can do CRUD operations on via scripting API
     */
    public readonly dynamicAreas: Map<string, DynamicArea> = new Map<string, DynamicArea>();

    public collisionGrid: number[][];
    private entitiesCollisionLayer: Phaser.Tilemaps.TilemapLayer;

    private perLayerCollisionGridCache: Map<number, (0 | 2 | 1)[][]> = new Map<number, (0 | 2 | 1)[][]>();

    private lastProperties = new Map<string, string | boolean | number>();
    private propertiesChangeCallbacks = new Map<string, Array<PropertyChangeCallback>>();

    private enterLayerCallbacks = Array<LayerChangeCallback>();
    private leaveLayerCallbacks = Array<LayerChangeCallback>();

    private enterTiledAreaCallbacks = Array<TiledAreaChangeCallback>();
    private leaveTiledAreaCallbacks = Array<TiledAreaChangeCallback>();

    private enterDynamicAreaCallbacks = Array<DynamicAreaChangeCallback>();
    private leaveDynamicAreaCallbacks = Array<DynamicAreaChangeCallback>();

    /**
     * Firing on map change, containing newest collision grid array
     */
    private mapChangedSubject = new Subject<number[][]>();

    constructor(
        scene: GameScene,
        gameMap: GameMap,
        phaserMap: Phaser.Tilemaps.Tilemap,
        terrains: Array<Phaser.Tilemaps.Tileset>
    ) {
        this.scene = scene;
        this.gameMap = gameMap;
        this.phaserMap = phaserMap;

        let depth = -2;
        for (const layer of this.gameMap.flatLayers) {
            if (layer.type === "tilelayer") {
                this.phaserLayers.push(
                    phaserMap
                        .createLayer(layer.name, terrains, (layer.x || 0) * 32, (layer.y || 0) * 32)
                        .setDepth(depth)
                        .setScrollFactor(layer.parallaxx ?? 1, layer.parallaxy ?? 1)
                        .setAlpha(layer.opacity)
                        .setVisible(layer.visible)
                        .setSize(layer.width, layer.height)
                );
            }
            if (layer.type === "objectgroup" && layer.name === "floorLayer") {
                depth = DEPTH_OVERLAY_INDEX;
            }
        }

        // NOTE: We leave "zone" for legacy reasons
        this.gameMap.tiledObjects
            .filter((object) => ["zone", "area"].includes(object.class ?? ""))
            .forEach((tiledArea: ITiledMapObject) => {
                this.tiledAreas.push(tiledArea);
            });

        this.collisionGrid = [];
        this.entitiesCollisionLayer = phaserMap.createBlankLayer("__entitiesCollisionLayer", terrains);
        this.entitiesCollisionLayer.setDepth(-2).setCollisionByProperty({ collides: true });

        this.phaserLayers.push(this.entitiesCollisionLayer);

        this.entitiesManager = new EntitiesManager(this.scene, this);
        for (const entityData of this.gameMap.getGameMapEntities()?.getEntities() ?? []) {
            this.entitiesManager.addEntity(entityData, TexturesHelper.ENTITIES_TEXTURES_DIRECTORY);
        }

        this.updateCollisionGrid(undefined, false);
    }

    public setLayerVisibility(layerName: string, visible: boolean): void {
        const phaserLayer = this.findPhaserLayer(layerName);
        if (phaserLayer != undefined) {
            phaserLayer.setVisible(visible);
            phaserLayer.setCollisionByProperty({ collides: true }, visible);
            this.updateCollisionGrid(phaserLayer);
        } else {
            const phaserLayers = this.findPhaserLayers(layerName + "/");
            if (phaserLayers.length === 0) {
                console.warn(
                    'Could not find layer with name that contains "' +
                        layerName +
                        '" when calling WA.hideLayer / WA.showLayer'
                );
                return;
            }
            for (let i = 0; i < phaserLayers.length; i++) {
                phaserLayers[i].setVisible(visible);
                phaserLayers[i].setCollisionByProperty({ collides: true }, visible);
            }
            this.updateCollisionGrid(undefined, false);
        }
    }

    /**
     *
     * @param x Top left of the starting position in world coordinates
     * @param y Top left of the starting position in world coordinates
     * @param name The key to differentiate between different collisionGrid modificators
     * @param collisionGrid Collisions map representing tiles
     * @returns
     */
    public modifyToCollisionsLayer(x: number, y: number, name: string, collisionGrid: number[][]): void {
        const coords = this.entitiesCollisionLayer.worldToTileXY(x, y, true);
        for (let y = 0; y < collisionGrid.length; y += 1) {
            for (let x = 0; x < collisionGrid[y].length; x += 1) {
                // add tiles
                if (collisionGrid[y][x] === 1) {
                    const tile = this.entitiesCollisionLayer.putTileAt(-1, coords.x + x, coords.y + y);
                    tile.properties["collides"] = true;
                    continue;
                }
                // remove tiles
                if (collisionGrid[y][x] === -1) {
                    this.entitiesCollisionLayer.removeTileAt(coords.x + x, coords.y + y, false);
                }
            }
        }
        this.entitiesCollisionLayer.setCollisionByProperty({ collides: true });
        this.updateCollisionGrid(this.entitiesCollisionLayer, false);
    }

    public getPropertiesForIndex(index: number): Array<ITiledMapProperty> {
        return this.gameMap.getPropertiesForIndex(index);
    }

    public getCollisionGrid(): number[][] {
        return this.collisionGrid;
    }

    private updateCollisionGrid(modifiedLayer?: TilemapLayer, useCache = true): void {
        const map = this.gameMap.getMap();
        // initialize collision grid to write on
        if (map.height === undefined || map.width === undefined) {
            this.collisionGrid = [];
            return;
        }
        const grid: number[][] = Array.from(Array(map.height), (_) => Array(map.width).fill(PathTileType.Walkable));
        if (modifiedLayer) {
            // recalculate cache for certain layer if needed
            this.perLayerCollisionGridCache.set(modifiedLayer.layerIndex, this.getLayerCollisionGrid(modifiedLayer));
        }
        // go through all tilemap layers on map. Maintain order
        for (const layer of this.phaserLayers) {
            if (!layer.visible) {
                continue;
            }
            if (!useCache) {
                this.perLayerCollisionGridCache.set(layer.layerIndex, this.getLayerCollisionGrid(layer));
            }
            const cachedLayer = this.perLayerCollisionGridCache.get(layer.layerIndex);
            if (!cachedLayer) {
                // no cache, calculate collision grid for this layer
                this.perLayerCollisionGridCache.set(layer.layerIndex, this.getLayerCollisionGrid(layer));
            } else {
                for (let y = 0; y < map.height; y += 1) {
                    for (let x = 0; x < map.width; x += 1) {
                        // currently no case where we can make tile non-collidable with collidable object beneath, skip position
                        if (grid[y][x] === PathTileType.Exit && cachedLayer[y][x] === PathTileType.Collider) {
                            grid[y][x] = cachedLayer[y][x];
                            continue;
                        }
                        if (grid[y][x] !== PathTileType.Walkable) {
                            continue;
                        }
                        grid[y][x] = cachedLayer[y][x];
                    }
                }
            }
        }
        this.collisionGrid = grid;
        this.mapChangedSubject.next(this.collisionGrid);
    }

    public getTileDimensions(): { width: number; height: number } {
        return this.gameMap.getTileDimensions();
    }

    public getTileIndexAt(x: number, y: number): { x: number; y: number } {
        return this.gameMap.getTileIndexAt(x, y);
    }

    /**
     * Sets the position of the current player (in pixels)
     * This will trigger events if properties are changing.
     */
    public setPosition(x: number, y: number) {
        const map = this.getMap();
        if (!map.width || !map.height) {
            return;
        }
        this.oldPosition = this.position;
        this.position = { x, y };
        const areasChanged = this.gameMap.getGameMapAreas()?.triggerAreasChange(this.oldPosition, this.position);
        const tiledAreasChanged = this.triggerTiledAreasChange(this.oldPosition, this.position);
        const dynamicAreasChanged = this.triggerDynamicAreasChange(this.oldPosition, this.position);
        if (areasChanged || tiledAreasChanged || dynamicAreasChanged) {
            this.triggerAllProperties();
        }

        this.oldKey = this.key;

        const xMap = Math.floor(x / (map.tilewidth ?? this.gameMap.getDefaultTileSize()));
        const yMap = Math.floor(y / (map.tileheight ?? this.gameMap.getDefaultTileSize()));
        const key = xMap + yMap * map.width;

        if (key === this.key) {
            return;
        }

        this.key = key;

        this.triggerAllProperties();
        this.triggerLayersChange();
    }

    public getCurrentProperties(): Map<string, string | boolean | number> {
        return this.lastProperties;
    }

    public clearCurrentProperties(): void {
        return this.lastProperties.clear();
    }

    public getMap(): ITiledMap {
        return this.gameMap.getMap();
    }

    /**
     * Registers a callback called when the user moves to a tile where the property propName is different from the last tile the user was on.
     */
    public onPropertyChange(propName: string, callback: PropertyChangeCallback) {
        let callbacksArray = this.propertiesChangeCallbacks.get(propName);
        if (callbacksArray === undefined) {
            callbacksArray = new Array<PropertyChangeCallback>();
            this.propertiesChangeCallbacks.set(propName, callbacksArray);
        }
        callbacksArray.push(callback);
    }

    /**
     * Registers a callback called when the user moves inside another layer.
     */
    public onEnterLayer(callback: LayerChangeCallback) {
        this.enterLayerCallbacks.push(callback);
    }

    /**
     * Registers a callback called when the user moves outside another layer.
     */
    public onLeaveLayer(callback: LayerChangeCallback) {
        this.leaveLayerCallbacks.push(callback);
    }

    /**
     * Registers a callback called when the user moves inside another Tiled Area.
     */
    public onEnterTiledArea(callback: TiledAreaChangeCallback) {
        this.enterTiledAreaCallbacks.push(callback);
    }

    /**
     * Registers a callback called when the user moves outside another Tiled Area.
     */
    public onLeaveTiledArea(callback: TiledAreaChangeCallback) {
        this.leaveTiledAreaCallbacks.push(callback);
    }

    /**
     * Registers a callback called when the user moves inside another Dynamic Area.
     */
    public onEnterDynamicArea(callback: DynamicAreaChangeCallback) {
        this.enterDynamicAreaCallbacks.push(callback);
    }

    /**
     * Registers a callback called when the user moves outside another Dynamic Area.
     */
    public onLeaveDynamicArea(callback: DynamicAreaChangeCallback) {
        this.leaveDynamicAreaCallbacks.push(callback);
    }

    public findLayer(layerName: string): ITiledMapLayer | undefined {
        return this.gameMap.findLayer(layerName);
    }

    public findObject(objectName: string, objectClass?: string): ITiledMapObject | undefined {
        return this.gameMap.findObject(objectName, objectClass);
    }

    public findPhaserLayer(layerName: string): TilemapLayer | undefined {
        return this.phaserLayers.find((layer) => layer.layer.name === layerName);
    }

    public findPhaserLayers(groupName: string): TilemapLayer[] {
        return this.phaserLayers.filter((l) => l.layer.name.includes(groupName));
    }

    public addTerrain(terrain: Phaser.Tilemaps.Tileset): void {
        for (const phaserLayer of this.phaserLayers) {
            phaserLayer.tileset.push(terrain);
        }
    }

    public putTile(tile: string | number | null, x: number, y: number, layer: string): void {
        const phaserLayer = this.findPhaserLayer(layer);
        if (phaserLayer) {
            if (tile === null) {
                phaserLayer.putTileAt(-1, x, y);
            } else {
                const tileIndex = this.gameMap.getIndexForTileType(tile);
                if (tileIndex === undefined) {
                    console.error("The tile '" + tile + "' that you want to place doesn't exist.");
                    return;
                }
                this.gameMap.putTileInFlatLayer(tileIndex, x, y, layer);
                const phaserTile = phaserLayer.putTileAt(tileIndex, x, y);
                for (const property of this.gameMap.getTileProperty(tileIndex)) {
                    if (property.name === GameMapProperties.COLLIDES && property.value) {
                        phaserTile.setCollision(true);
                    }
                }
            }
            this.updateCollisionGrid(phaserLayer);
        } else {
            console.error("The layer '" + layer + "' does not exist (or is not a tilelaye).");
        }
    }

    public canEntityBePlaced(
        topLeftPos: { x: number; y: number },
        width: number,
        height: number,
        collisionGrid?: number[][],
        oldTopLeftPos?: { x: number; y: number }
    ): boolean {
        const isOutOfBounds = this.scene
            .getGameMapFrontWrapper()
            .isOutOfMapBounds(topLeftPos.x, topLeftPos.y, width, height);
        if (isOutOfBounds) {
            return false;
        }
        // no collision grid means we can place it anywhere on the map
        if (!collisionGrid) {
            return true;
        }
        // prevent entity's old position from blocking it when repositioning
        const positionsToIgnore: Map<string, number> = new Map<string, number>();
        const tileDim = this.scene.getGameMapFrontWrapper().getTileDimensions();
        if (oldTopLeftPos) {
            for (let y = 0; y < collisionGrid.length; y += 1) {
                for (let x = 0; x < collisionGrid[y].length; x += 1) {
                    if (collisionGrid[y][x] === 1) {
                        const xIndex = Math.floor((oldTopLeftPos.x + x * tileDim.width) / tileDim.width);
                        const yIndex = Math.floor((oldTopLeftPos.y + y * tileDim.height) / tileDim.height);
                        positionsToIgnore.set(`x:${xIndex}y:${yIndex}`, 1);
                    }
                }
            }
        }
        for (let y = 0; y < collisionGrid.length; y += 1) {
            for (let x = 0; x < collisionGrid[y].length; x += 1) {
                // this tile in collisionGrid is non-collidible. We can skip calculations for it
                if (collisionGrid[y][x] === 0) {
                    continue;
                }
                const xIndex = Math.floor((topLeftPos.x + x * tileDim.width) / tileDim.width);
                const yIndex = Math.floor((topLeftPos.y + y * tileDim.height) / tileDim.height);
                // current position is being blocked by entity's old position. We can ignore that
                // NOTE: Is it possible for position to be blocked by 2 different things?
                if (positionsToIgnore.has(`x:${xIndex}y:${yIndex}`)) {
                    continue;
                }
                if (
                    !this.scene
                        .getGameMapFrontWrapper()
                        .isSpaceAvailable(topLeftPos.x + x * tileDim.width, topLeftPos.y + y * tileDim.height)
                ) {
                    return false;
                }
            }
        }
        return true;
    }

    public isSpaceAvailable(topLeftX: number, topLeftY: number): boolean {
        if (this.collisionGrid.length === 0) {
            return false;
        }
        if (
            this.isOutOfMapBounds(topLeftX, topLeftY, this.getTileDimensions().width, this.getTileDimensions().height)
        ) {
            return false;
        }
        const playersPositions = [
            ...Array.from(this.scene.getRemotePlayersRepository().getPlayers().values()).map(
                (player) => player.position
            ),
            this.scene.CurrentPlayer.getPosition(),
        ];

        // check if position is not occupied by a WOKA
        for (const position of playersPositions) {
            if (
                MathUtils.isOverlappingWithRectangle(position, {
                    x: topLeftX,
                    y: topLeftY,
                    width: this.getTileDimensions().width,
                    height: this.getTileDimensions().height,
                })
            ) {
                return false;
            }
        }
        // TODO: Check if it's colliding with other players

        // Check if position is not colliding
        const height = this.collisionGrid.length;
        const width = this.collisionGrid[0].length;
        const xIndex = Math.floor(topLeftX / this.getTileDimensions().width);
        const yIndex = Math.floor(topLeftY / this.getTileDimensions().height);
        if (yIndex >= height || yIndex < 0 || xIndex >= width || xIndex < 0) {
            return false;
        }
        if (this.collisionGrid[yIndex][xIndex] !== 0) {
            return false;
        }
        return true;
    }

    public isOutOfMapBounds(topLeftX: number, topLeftY: number, width = 0, height = 0): boolean {
        const mapWidth = this.collisionGrid[0].length * this.getTileDimensions().width;
        const mapHeight = this.collisionGrid.length * this.getTileDimensions().height;
        if (topLeftX < 0 || topLeftX + width > mapWidth || topLeftY < 0 || topLeftY + height > mapHeight) {
            return true;
        }
        return false;
    }

    public setLayerProperty(
        layerName: string,
        propertyName: string,
        propertyValue: string | number | undefined | boolean
    ) {
        const layer = this.findLayer(layerName);
        if (layer === undefined) {
            console.warn('Could not find layer "' + layerName + '" when calling setProperty');
            return;
        }
        this.gameMap.setTiledObjectProperty(layer, propertyName, propertyValue);
        this.triggerAllProperties();
        this.triggerLayersChange();
    }

    /**
     * Trigger all the callbacks (used when exiting a map)
     */
    public triggerExitCallbacks(): void {
        const emptyProps = new Map<string, string | boolean | number>();
        for (const [oldPropName, oldPropValue] of this.lastProperties.entries()) {
            // We found a property that disappeared
            this.trigger(oldPropName, oldPropValue, undefined, emptyProps);
        }
    }

    public getRandomPositionFromLayer(layerName: string): { x: number; y: number } {
        const layer = this.findLayer(layerName) as ITiledMapTileLayer;
        if (!layer) {
            throw new Error(`No layer "${layerName}" was found`);
        }
        const tiles = layer.data;
        if (!tiles) {
            throw new Error(`No tiles in "${layerName}" were found`);
        }
        if (typeof tiles === "string") {
            throw new Error("The content of a JSON map must be filled as a JSON array, not as a string");
        }
        const possiblePositions: { x: number; y: number }[] = [];
        tiles.forEach((objectKey: number, key: number) => {
            if (objectKey === 0) {
                return;
            }
            possiblePositions.push({ x: key % layer.width, y: Math.floor(key / layer.width) });
        });
        if (possiblePositions.length > 0) {
            return MathUtils.randomFromArray(possiblePositions);
        }
        throw new Error("No possible position found");
    }

    public getTiledObjectProperty(
        object: { properties?: ITiledMapProperty[] },
        propertyName: string
    ): Json | undefined {
        return this.gameMap.getTiledObjectProperty(object, propertyName);
    }

    public getObjectWithName(name: string): ITiledMapObject | undefined {
        return this.gameMap.getObjectWithName(name);
    }

    /**
     * Registers a callback called when the user moves inside another area.
     */
    public onEnterArea(callback: AreaChangeCallback) {
        this.gameMap.onEnterArea(callback);
    }

    /**
     * Registers a callback called when the user moves outside another area.
     */
    public onLeaveArea(callback: AreaChangeCallback) {
        this.gameMap.getGameMapAreas()?.onLeaveArea(callback);
    }

    public setAreaProperty<K extends keyof AreaDataProperties>(
        id: string,
        propertyName: K,
        propertyValue: AreaDataProperties[K]
    ): void {
        const area = this.getArea(id);
        if (area === undefined) {
            console.warn('Could not find area "' + id + '" when calling setProperty');
            return;
        }
        this.gameMap.setAreaProperty(area, propertyName, propertyValue);
        this.triggerAllProperties();
        this.gameMap.getGameMapAreas()?.triggerAreasChange(this.oldPosition, this.position);
    }

    public setDynamicAreaProperty(areaName: string, propertyName: string, propertyValue: unknown): void {
        const area = this.dynamicAreas.get(areaName);
        if (area === undefined) {
            console.warn('Could not find dynamic area "' + areaName + '" when calling setProperty');
            return;
        }
        area.properties[propertyName] = propertyValue;
        this.triggerAllProperties();
        this.triggerDynamicAreasChange(this.oldPosition, this.position);
    }

    public getAreas(): Map<string, AreaData> | undefined {
        return this.gameMap.getGameMapAreas()?.getAreas();
    }

    public addArea(area: AreaData): void {
        this.gameMap.getGameMapAreas()?.addArea(area, true, this.position);
    }

    public addDynamicArea(area: DynamicArea): boolean {
        if (this.dynamicAreas.has(area.name)) {
            return false;
        }
        this.dynamicAreas.set(area.name, area);

        if (this.isPlayerInsideDynamicArea(area.name)) {
            this.triggerSpecificDynamicAreaOnEnter(area);
        }
        return true;
    }

    public triggerSpecificAreaOnEnter(area: AreaData): void {
        this.gameMap.getGameMapAreas()?.triggerSpecificAreaOnEnter(area);
    }

    public triggerSpecificAreaOnLeave(area: AreaData): void {
        this.gameMap.getGameMapAreas()?.triggerSpecificAreaOnLeave(area);
    }

    public triggerSpecificDynamicAreaOnEnter(area: DynamicArea): void {
        for (const callback of this.enterDynamicAreaCallbacks) {
            callback([area], []);
        }
    }

    public triggerSpecificDynamicAreaOnLeave(area: DynamicArea): void {
        for (const callback of this.leaveDynamicAreaCallbacks) {
            callback([area], []);
        }
    }

    public getAreaByName(name: string): AreaData | undefined {
        return this.gameMap.getGameMapAreas()?.getAreaByName(name);
    }

    public getArea(id: string): AreaData | undefined {
        return this.gameMap.getGameMapAreas()?.getArea(id);
    }

    public getDynamicArea(name: string): DynamicArea | undefined {
        return this.dynamicAreas.get(name);
    }

    public updateArea(id: string, config: Partial<AreaData>): void {
        const gameMapAreas = this.gameMap.getGameMapAreas();
        if (!gameMapAreas) {
            return;
        }
        const area = gameMapAreas.updateArea(id, config);
        if (this.position && area && gameMapAreas.isPlayerInsideArea(id, this.position)) {
            this.triggerSpecificAreaOnEnter(area);
        }
    }

    public deleteArea(id: string): void {
        this.gameMap.getGameMapAreas()?.deleteArea(id, this.position);
    }

    public deleteDynamicArea(name: string): void {
        this.dynamicAreas.delete(name);
    }

    public isPlayerInsideArea(id: string): boolean {
        if (!this.position) {
            return false;
        }
        return this.gameMap.getGameMapAreas()?.isPlayerInsideArea(id, this.position) || false;
    }

    public isPlayerInsideDynamicArea(name: string): boolean {
        if (!this.position) {
            return false;
        }
        return this.getDynamicAreasOnPosition(this.position).findIndex((area) => area.name === name) !== -1;
    }

    public getMapChangedObservable(): Observable<number[][]> {
        return this.mapChangedSubject.asObservable();
    }

    public getFlatLayers(): ITiledMapLayer[] {
        return this.gameMap.flatLayers;
    }

    public getTiledAreas(): ITiledMapObject[] {
        return this.tiledAreas;
    }

    public getExitUrls(): Array<string> {
        return this.gameMap.exitUrls;
    }

    public hasStartTile(): boolean {
        return this.gameMap.hasStartTile;
    }

    public getGameMap(): GameMap {
        return this.gameMap;
    }

    public getEntitiesManager(): EntitiesManager {
        return this.entitiesManager;
    }

    public getActivatableEntities(): Entity[] {
        return this.entitiesManager.getActivatableEntities();
    }

    public handleEntityActionTrigger(): void {
        this.triggerAllProperties();
    }

    /**
     * Parse map-editor AreaData to ITiledMapObject format in order to handle properties changes
     */
    public mapAreaToTiledObject(areaData: AreaData): ITiledPlace {
        return {
            id: areaData.id,
            type: "area",
            class: "area",
            name: areaData.name,
            visible: true,
            x: areaData.x,
            y: areaData.y,
            width: areaData.width,
            height: areaData.height,
            properties: this.mapAreaPropertiesToTiledProperties(areaData.properties),
        };
    }

    public mapDynamicAreaToTiledObject(dynamicArea: DynamicArea): ITiledPlace {
        return {
            id: dynamicArea.name,
            type: "area",
            class: "area",
            name: dynamicArea.name,
            visible: true,
            x: dynamicArea.x,
            y: dynamicArea.y,
            width: dynamicArea.width,
            height: dynamicArea.height,
            properties: this.mapDynamicAreaPropertiesToTiledProperties(dynamicArea.properties),
        };
    }

    private mapDynamicAreaPropertiesToTiledProperties(dynamicAreaProperties: {
        [key: string]: unknown;
    }): ITiledMapProperty[] {
        const properties: ITiledMapProperty[] = [];
        for (const key in dynamicAreaProperties) {
            const property = dynamicAreaProperties[key];
            if (typeof property === "string") {
                properties.push({ name: key, type: "string", value: property });
                continue;
            }
            if (typeof property === "number") {
                properties.push({ name: key, type: "float", value: property });
                continue;
            }
            if (typeof property === "boolean") {
                properties.push({ name: key, type: "bool", value: property });
                continue;
            }
        }
        return properties;
    }

    private mapAreaPropertiesToTiledProperties(areaProperties: AreaDataProperties): ITiledMapProperty[] {
        const properties: ITiledMapProperty[] = [];

        if (areaProperties.focusable) {
            properties.push({ name: GameMapProperties.FOCUSABLE, type: "bool", value: true });
            if (areaProperties.focusable.zoom_margin) {
                properties.push({
                    name: GameMapProperties.ZOOM_MARGIN,
                    type: "float",
                    value: areaProperties.focusable.zoom_margin,
                });
            }
        }
        if (areaProperties.jitsiRoom) {
            properties.push({
                name: GameMapProperties.JITSI_ROOM,
                type: "string",
                value: areaProperties.jitsiRoom.roomName ?? "",
            });
            if (areaProperties.jitsiRoom.jitsiRoomConfig) {
                properties.push({
                    name: GameMapProperties.JITSI_CONFIG,
                    type: "class",
                    value: areaProperties.jitsiRoom.jitsiRoomConfig,
                });
            }
        }
        if (areaProperties.openWebsite) {
            if (areaProperties.openWebsite.newTab) {
                properties.push({
                    name: GameMapProperties.OPEN_TAB,
                    type: "string",
                    value: areaProperties.openWebsite.link,
                });
            } else {
                properties.push({
                    name: GameMapProperties.OPEN_WEBSITE,
                    type: "string",
                    value: areaProperties.openWebsite.link,
                });
            }
        }
        if (areaProperties.playAudio) {
            properties.push({
                name: GameMapProperties.PLAY_AUDIO,
                type: "string",
                value: areaProperties.playAudio.audioLink,
            });
        }
        if (areaProperties.start) {
            properties.push({
                name: GameMapProperties.START,
                type: "bool",
                value: areaProperties.start,
            });
        }
        if (areaProperties.silent) {
            properties.push({
                name: GameMapProperties.SILENT,
                type: "bool",
                value: areaProperties.silent,
            });
        }

        return properties;
    }

    private triggerAllProperties(): void {
        const newProps = this.getProperties(this.key ?? 0);
        const oldProps = this.lastProperties;
        this.lastProperties = newProps;

        // Let's compare the 2 maps:
        // First new properties vs oldProperties
        for (const [newPropName, newPropValue] of newProps.entries()) {
            const oldPropValue = oldProps.get(newPropName);
            if (oldPropValue !== newPropValue) {
                this.trigger(newPropName, oldPropValue, newPropValue, newProps);
            }
        }

        for (const [oldPropName, oldPropValue] of oldProps.entries()) {
            if (!newProps.has(oldPropName)) {
                // We found a property that disappeared
                this.trigger(oldPropName, oldPropValue, undefined, newProps);
            }
        }
    }

    private getLayerCollisionGrid(layer: TilemapLayer): (1 | 2 | 0)[][] {
        let isExitLayer = false;
        for (const property of layer.layer.properties as { [key: string]: string | number | boolean }[]) {
            if (property.name && property.name === "exitUrl") {
                isExitLayer = true;
                break;
            }
        }
        return layer.layer.data.map((row) =>
            row.map((tile) =>
                tile.properties?.[GameMapProperties.COLLIDES]
                    ? 1
                    : (isExitLayer && tile.index !== -1) ||
                      tile.properties?.[GameMapProperties.EXIT_URL] ||
                      tile.properties?.[GameMapProperties.EXIT_SCENE_URL]
                    ? 2
                    : 0
            )
        );
    }

    private getProperties(key: number): Map<string, string | boolean | number> {
        let properties = new Map<string, string | boolean | number>();
        // CHECK FOR AREAS PROPERTIES
        if (this.position) {
            const areasProperties = this.gameMap.getGameMapAreas()?.getProperties(this.position);
            if (areasProperties) {
                properties = areasProperties;
            }
        }

        // CHECK FOR DYNAMIC AREAS PROPERTIES
        if (this.position) {
            const dynamicAreasProperties = this.getDynamicAreasProperties(this.position);
            if (dynamicAreasProperties) {
                for (const [key, value] of dynamicAreasProperties) {
                    properties.set(key, value);
                }
            }
        }

        // CHECK FOR TILED AREAS PROPERTIES
        if (this.position) {
            const tiledAreasOnPosition = this.getTiledAreasOnPosition(this.position);
            for (const tiledArea of tiledAreasOnPosition) {
                if (tiledArea.properties) {
                    for (const property of tiledArea.properties) {
                        if (property.value === undefined) {
                            continue;
                        }
                        properties.set(property.name, property.value as string | number | boolean);
                    }
                }
            }
        }

        // CHECK FOR ENTITIES PROPERTIES
        if (this.entitiesManager) {
            for (const [key, value] of this.entitiesManager.getProperties()) {
                properties.set(key, value);
            }
        }

        // CHECK FOR LAYERS PROPERTIES
        for (const layer of this.getFlatLayers()) {
            if (layer.type !== "tilelayer") {
                continue;
            }

            let tileIndex: number | undefined = undefined;
            if (layer.data) {
                const tiles = layer.data as number[];
                if (tiles[key] == 0) {
                    continue;
                }
                tileIndex = tiles[key];
            }

            // There is a tile in this layer, let's embed the properties
            if (layer.properties !== undefined) {
                for (const layerProperty of layer.properties) {
                    if (layerProperty.value === undefined) {
                        continue;
                    }
                    properties.set(layerProperty.name, layerProperty.value as string | number | boolean);
                }
            }

            if (tileIndex) {
                this.gameMap.getTileProperty(tileIndex).forEach((property) => {
                    if (property.value) {
                        properties.set(property.name, property.value as string | number | boolean);
                    } else if (properties.has(property.name)) {
                        properties.delete(property.name);
                    }
                });
            }
        }

        return properties;
    }

    private trigger(
        propName: string,
        oldValue: string | number | boolean | undefined,
        newValue: string | number | boolean | undefined,
        allProps: Map<string, string | boolean | number>
    ) {
        const callbacksArray = this.propertiesChangeCallbacks.get(propName);
        if (callbacksArray !== undefined) {
            for (const callback of callbacksArray) {
                callback(newValue, oldValue, allProps);
            }
        }
    }

    private triggerLayersChange(): void {
        const layersByOldKey = this.oldKey ? this.gameMap.getLayersByKey(this.oldKey) : [];
        const layersByNewKey = this.key ? this.gameMap.getLayersByKey(this.key) : [];

        const enterLayers = new Set(layersByNewKey);
        const leaveLayers = new Set(layersByOldKey);

        enterLayers.forEach((layer) => {
            if (leaveLayers.has(layer)) {
                leaveLayers.delete(layer);
                enterLayers.delete(layer);
            }
        });

        if (enterLayers.size > 0) {
            const layerArray = Array.from(enterLayers);
            for (const callback of this.enterLayerCallbacks) {
                callback(layerArray, layersByNewKey);
            }
        }

        if (leaveLayers.size > 0) {
            const layerArray = Array.from(leaveLayers);
            for (const callback of this.leaveLayerCallbacks) {
                callback(layerArray, layersByNewKey);
            }
        }
    }

    private triggerTiledAreasChange(
        oldPosition: { x: number; y: number } | undefined,
        position: { x: number; y: number } | undefined
    ): boolean {
        const areasByOldPosition = oldPosition ? this.getTiledAreasOnPosition(oldPosition) : [];
        const areasByNewPosition = position ? this.getTiledAreasOnPosition(position) : [];

        const enterAreas = new Set(areasByNewPosition);
        const leaveAreas = new Set(areasByOldPosition);

        enterAreas.forEach((area) => {
            if (leaveAreas.has(area)) {
                leaveAreas.delete(area);
                enterAreas.delete(area);
            }
        });

        let areasChange = false;
        if (enterAreas.size > 0) {
            const areasArray = Array.from(enterAreas);

            for (const callback of this.enterTiledAreaCallbacks) {
                callback(areasArray, areasByNewPosition);
            }
            areasChange = true;
        }

        if (leaveAreas.size > 0) {
            const areasArray = Array.from(leaveAreas);
            for (const callback of this.leaveTiledAreaCallbacks) {
                callback(areasArray, areasByNewPosition);
            }
            areasChange = true;
        }
        return areasChange;
    }

    private getTiledAreasOnPosition(position: { x: number; y: number }, offsetY = 16): ITiledMapObject[] {
        const overlappedTiledAreas: ITiledMapObject[] = [];
        for (const tiledArea of this.tiledAreas) {
            if (
                MathUtils.isOverlappingWithRectangle(
                    { x: position.x, y: position.y + offsetY },
                    { x: tiledArea.x, y: tiledArea.y, width: tiledArea.width ?? 0, height: tiledArea.height ?? 0 }
                )
            ) {
                overlappedTiledAreas.push(tiledArea);
            }
        }
        return overlappedTiledAreas;
    }

    private triggerDynamicAreasChange(
        oldPosition: { x: number; y: number } | undefined,
        position: { x: number; y: number } | undefined
    ): boolean {
        const areasByOldPosition = oldPosition ? this.getDynamicAreasOnPosition(oldPosition) : [];
        const areasByNewPosition = position ? this.getDynamicAreasOnPosition(position) : [];

        const enterAreas = new Set(areasByNewPosition);
        const leaveAreas = new Set(areasByOldPosition);

        enterAreas.forEach((area) => {
            if (leaveAreas.has(area)) {
                leaveAreas.delete(area);
                enterAreas.delete(area);
            }
        });

        let areasChange = false;
        if (enterAreas.size > 0) {
            const areasArray = Array.from(enterAreas);

            for (const callback of this.enterDynamicAreaCallbacks) {
                callback(areasArray, areasByNewPosition);
            }
            areasChange = true;
        }

        if (leaveAreas.size > 0) {
            const areasArray = Array.from(leaveAreas);
            for (const callback of this.leaveDynamicAreaCallbacks) {
                callback(areasArray, areasByNewPosition);
            }
            areasChange = true;
        }
        return areasChange;
    }

    private getDynamicAreasOnPosition(position: { x: number; y: number }, offsetY = 16): DynamicArea[] {
        const overlappedDynamicAreas: DynamicArea[] = [];
        for (const dynamicArea of this.dynamicAreas.values()) {
            if (
                MathUtils.isOverlappingWithRectangle(
                    { x: position.x, y: position.y + offsetY },
                    { x: dynamicArea.x, y: dynamicArea.y, width: dynamicArea.width, height: dynamicArea.height }
                )
            ) {
                overlappedDynamicAreas.push(dynamicArea);
            }
        }
        return overlappedDynamicAreas;
    }

    private getDynamicAreasProperties(position: { x: number; y: number }): Map<string, string | number | boolean> {
        const properties = new Map<string, string | number | boolean>();
        for (const dynamicArea of this.getDynamicAreasOnPosition(position, 16)) {
            if (dynamicArea.properties === undefined) {
                continue;
            }
            for (const key in dynamicArea.properties) {
                const property = dynamicArea.properties[key];
                if (property === undefined) {
                    continue;
                }
                if (typeof property === "string" || typeof property === "number" || typeof property === "boolean") {
                    properties.set(key, property);
                }
            }
        }
        return properties;
    }
}
