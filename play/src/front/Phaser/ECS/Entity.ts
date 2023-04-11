import {
    AtLeast,
    EntityData,
    EntityDataProperties,
    GameMapProperties,
    TextHeaderPropertyData,
} from "@workadventure/map-editor";
import type OutlinePipelinePlugin from "phaser3-rex-plugins/plugins/outlinepipeline-plugin.js";
import { get, Unsubscriber } from "svelte/store";
import * as _ from "lodash";
import { SimpleCoWebsite } from "../../WebRtc/CoWebsite/SimpleCoWebsite";
import { coWebsiteManager } from "../../WebRtc/CoWebsiteManager";
import { ActionsMenuAction, actionsMenuStore } from "../../Stores/ActionsMenuStore";
import { mapEditorModeStore, mapEditorEntityModeStore } from "../../Stores/MapEditorStore";
import { createColorStore } from "../../Stores/OutlineColorStore";
import { ActivatableInterface } from "../Game/ActivatableInterface";
import { GameScene } from "../Game/GameScene";
import { OutlineableInterface } from "../Game/OutlineableInterface";

export enum EntityEvent {
    Moved = "EntityEvent:Moved",
    Delete = "EntityEvent:Delete",
    PropertiesUpdated = "EntityEvent:PropertiesUpdated",
    PropertyActivated = "EntityEvent:PropertyActivated",
}

// NOTE: Tiles-based entity for now. Individual images later on
export class Entity extends Phaser.GameObjects.Image implements ActivatableInterface, OutlineableInterface {
    public readonly activationRadius: number = 96;
    private readonly outlineColorStore = createColorStore();
    private readonly outlineColorStoreUnsubscribe: Unsubscriber;

    private entityData: Required<EntityData>;

    private activatable: boolean;
    private oldPosition: { x: number; y: number };

    constructor(scene: GameScene, data: EntityData) {
        super(scene, data.x, data.y, data.prefab.imagePath);
        this.setOrigin(0);

        this.oldPosition = this.getPosition();

        this.entityData = {
            ...data,
            properties: data.properties ?? {},
        };

        this.activatable = this.hasAnyPropertiesSet();
        if (this.activatable) {
            this.setInteractive({ pixelPerfect: true, cursor: "pointer" });
            this.scene.input.setDraggable(this);
        }

        this.setDepth(this.y + this.displayHeight + (this.entityData.prefab.depthOffset ?? 0));

        this.outlineColorStoreUnsubscribe = this.outlineColorStore.subscribe((color) => {
            if (color === undefined) {
                this.getOutlinePlugin()?.remove(this);
            } else {
                this.getOutlinePlugin()?.remove(this);
                this.getOutlinePlugin()?.add(this, {
                    thickness: 2,
                    outlineColor: color,
                });
            }

            if (this.scene instanceof GameScene) {
                this.scene.markDirty();
            } else {
                throw new Error("Not the Game Scene");
            }
        });

        this.scene.add.existing(this);
    }

    public updateEntity(dataToModify: AtLeast<EntityData, "id">): void {
        _.merge(this.entityData, dataToModify);

        this.setPosition(this.entityData.x, this.entityData.y);
        this.oldPosition = this.getPosition();
        this.activatable = this.hasAnyPropertiesSet();
        if (this.activatable) {
            this.setInteractive({ pixelPerfect: true, cursor: "pointer" });
            this.scene.input.setDraggable(this);
        } else if (!get(mapEditorModeStore)) {
            this.disableInteractive();
        }
    }

    public destroy(): void {
        this.outlineColorStoreUnsubscribe();
        super.destroy();
    }

    public getPosition(): { x: number; y: number } {
        return { x: this.x, y: this.y };
    }

    public activate(): void {
        if (!(get(mapEditorModeStore) && get(mapEditorEntityModeStore) === "EDIT")) {
            this.toggleActionsMenu();
        }
    }

    public TestActivation(): void {
        this.toggleActionsMenu();
    }

    public deactivate(): void {
        actionsMenuStore.clear();
    }

    public getCollisionGrid(): number[][] | undefined {
        return this.entityData.prefab.collisionGrid;
    }

    public getReversedCollisionGrid(): number[][] | undefined {
        return this.entityData.prefab.collisionGrid?.map((row) => row.map((value) => (value === 1 ? -1 : value)));
    }

    public setFollowOutlineColor(color: number): void {
        this.outlineColorStore.setFollowColor(color);
    }

    public removeFollowOutlineColor(): void {
        this.outlineColorStore.removeFollowColor();
    }

    public setApiOutlineColor(color: number): void {
        this.outlineColorStore.setApiColor(color);
    }

    public removeApiOutlineColor(): void {
        this.outlineColorStore.removeApiColor();
    }

    public setEditColor(color: number): void {
        this.outlineColorStore.setEditColor(color);
    }

    public removeEditColor(): void {
        this.outlineColorStore.removeEditColor();
    }

    public setPointedToEditColor(color: number): void {
        this.outlineColorStore.setPointedToEditColor(color);
    }

    public removePointedToEditColor(): void {
        this.outlineColorStore.removePointedToEditColor();
    }

    public pointerOverOutline(color: number): void {
        this.outlineColorStore.pointerOver(color);
    }

    public pointerOutOutline(): void {
        this.outlineColorStore.pointerOut();
    }

    public characterCloseByOutline(color: number): void {
        this.outlineColorStore.characterCloseBy(color);
    }

    public characterFarAwayOutline(): void {
        this.outlineColorStore.characterFarAway();
    }

    public delete() {
        this.emit(EntityEvent.Delete);
    }

    private getOutlinePlugin(): OutlinePipelinePlugin | undefined {
        return this.scene.plugins.get("rexOutlinePipeline") as unknown as OutlinePipelinePlugin | undefined;
    }

    private hasAnyPropertiesSet(): boolean {
        if (!this.entityData.properties) {
            return false;
        }
        const propValues = Object.values(this.entityData.properties);
        for (const value of propValues) {
            if (value !== undefined && value !== null) {
                return true;
            }
        }
        return false;
    }

    private toggleActionsMenu(): void {
        if (get(actionsMenuStore) !== undefined) {
            actionsMenuStore.clear();
            return;
        }
        actionsMenuStore.initialize(TextHeaderPropertyData.parse(this.entityData.properties.textHeader ?? ""));
        for (const action of this.getDefaultActionsMenuActions()) {
            actionsMenuStore.addAction(action);
        }
    }

    private getDefaultActionsMenuActions(): ActionsMenuAction[] {
        if (!this.entityData.properties) {
            return [];
        }
        const actions: ActionsMenuAction[] = [];
        const properties = this.entityData.properties;

        if (properties.jitsiRoom) {
            const roomName = properties.jitsiRoom.roomName;
            const roomConfig = properties.jitsiRoom.jitsiRoomConfig;
            actions.push({
                actionName: properties.jitsiRoom.buttonLabel ?? "",
                protected: true,
                priority: 1,
                callback: () => {
                    this.emit(
                        EntityEvent.PropertyActivated,
                        {
                            propertyName: GameMapProperties.JITSI_ROOM,
                            propertyValue: roomName,
                        },
                        {
                            propertyName: GameMapProperties.JITSI_CONFIG,
                            propertyValue: JSON.stringify(roomConfig),
                        }
                    );
                },
            });
        }
        if (properties.openWebsite) {
            const link = properties.openWebsite.link;
            const newTab = properties.openWebsite.newTab;
            actions.push({
                actionName: properties.openWebsite.buttonLabel ?? "",
                protected: true,
                priority: 1,
                callback: () => {
                    if (newTab) {
                        this.emit(EntityEvent.PropertyActivated, {
                            propertyName: GameMapProperties.OPEN_TAB,
                            propertyValue: link,
                        });
                    } else {
                        const coWebsite = new SimpleCoWebsite(new URL(link));
                        coWebsiteManager.addCoWebsiteToStore(coWebsite, undefined);
                        coWebsiteManager.loadCoWebsite(coWebsite).catch(() => {
                            console.error("Error during loading a co-website: " + coWebsite.getUrl());
                        });
                    }
                },
            });
        }
        if (properties.playAudio) {
            const audioLink = properties.playAudio.audioLink;
            actions.push({
                actionName: properties.playAudio.buttonLabel ?? "",
                protected: true,
                priority: 1,
                callback: () => {
                    this.emit(EntityEvent.PropertyActivated, {
                        propertyName: GameMapProperties.PLAY_AUDIO,
                        propertyValue: audioLink,
                    });
                },
            });
        }
        if (properties.textHeader) {
            //
        }
        return actions;
    }

    public isActivatable(): boolean {
        return this.activatable;
    }

    public getEntityData(): Required<EntityData> {
        return this.entityData;
    }

    public getProperties(): EntityDataProperties {
        return this.entityData.properties;
    }

    public setProperty<K extends keyof EntityDataProperties>(key: K, value: EntityDataProperties[K]): void {
        this.entityData.properties[key] = value;
        this.emit(EntityEvent.PropertiesUpdated, key, value);
    }

    public getOldPosition(): { x: number; y: number } {
        return this.oldPosition;
    }
}
