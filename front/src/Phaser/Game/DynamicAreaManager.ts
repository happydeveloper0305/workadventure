import { Subscription } from "rxjs";
import { CreateAreaEvent, ModifyAreaEvent } from "../../Api/Events/CreateAreaEvent";
import { iframeListener } from "../../Api/IframeListener";
import { GameMap } from "./GameMap";
import { AreaType } from "./GameMapAreas";

export class DynamicAreaManager {
    private readonly gameMap: GameMap;
    private readonly subscription: Subscription;

    constructor(gameMap: GameMap) {
        this.gameMap = gameMap;

        this.registerIFrameEventAnswerers();

        this.subscription = iframeListener.modifyAreaStream.subscribe((modifyAreaEvent: ModifyAreaEvent) => {
            const area = this.gameMap.getAreaByName(modifyAreaEvent.name, AreaType.Dynamic);
            if (!area) {
                throw new Error(`Could not find dynamic area with the name "${modifyAreaEvent.name}" in your map`);
            }

            const insideBefore = this.gameMap.isPlayerInsideAreaByName(modifyAreaEvent.name, AreaType.Dynamic);

            if (modifyAreaEvent.x !== undefined) {
                area.x = modifyAreaEvent.x;
            }
            if (modifyAreaEvent.y !== undefined) {
                area.y = modifyAreaEvent.y;
            }
            if (modifyAreaEvent.width !== undefined) {
                area.width = modifyAreaEvent.width;
            }
            if (modifyAreaEvent.height !== undefined) {
                area.height = modifyAreaEvent.height;
            }

            const insideAfter = this.gameMap.isPlayerInsideAreaByName(modifyAreaEvent.name, AreaType.Dynamic);

            if (insideBefore && !insideAfter) {
                this.gameMap.triggerSpecificAreaOnLeave(area);
            } else if (!insideBefore && insideAfter) {
                this.gameMap.triggerSpecificAreaOnEnter(area);
            }
        });
    }

    private registerIFrameEventAnswerers(): void {
        iframeListener.registerAnswerer("createArea", (createAreaEvent: CreateAreaEvent) => {
            if (this.gameMap.getAreaByName(createAreaEvent.name, AreaType.Dynamic)) {
                throw new Error(`An area with the name "${createAreaEvent.name}" already exists in your map`);
            }

            this.gameMap.addArea(
                {
                    ...createAreaEvent,
                    id: -1,
                    gid: -1,
                    visible: true,
                    rotation: 0,
                    type: "area",
                    class: "area",
                    ellipse: false,
                    polygon: [],
                    polyline: [],
                    properties: [],
                },
                AreaType.Dynamic
            );
        });

        iframeListener.registerAnswerer("getArea", (name: string) => {
            const area = this.gameMap.getAreaByName(name, AreaType.Dynamic);
            if (area === undefined) {
                throw new Error(`Cannot find area with name "${name}"`);
            }
            return {
                name: area.name,
                width: area.width,
                height: area.height,
                x: area.x,
                y: area.y,
            };
        });

        iframeListener.registerAnswerer("deleteArea", (name: string) => {
            this.gameMap.deleteAreaByName(name, AreaType.Dynamic);
        });
    }

    close(): void {
        this.subscription.unsubscribe();
    }
}
