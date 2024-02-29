import { coWebsiteManager } from "../../WebRtc/CoWebsiteManager";
import type { Game } from "../Game/Game";
import { ResizableScene } from "../Login/ResizableScene";
import { HtmlUtils } from "../../WebRtc/HtmlUtils";
import { HdpiManager } from "./HdpiManager";
import ScaleManager = Phaser.Scale.ScaleManager;

export const MAX_ZOOM_OUT_EXPLORER_MODE = 0.4;
export const INITIAL_ZOOM_OUT_EXPLORER_MODE = 1;

export enum WaScaleManagerEvent {
    RefreshFocusOnTarget = "wa-scale-manager:refresh-focus-on-target",
}

export type WaScaleManagerFocusTarget = { x: number; y: number; width?: number; height?: number };

export class WaScaleManager {
    private hdpiManager: HdpiManager;
    private scaleManager: ScaleManager | undefined;
    private game!: Game;
    private actualZoom = 1;
    private _saveZoom = 1;

    private focusTarget?: WaScaleManagerFocusTarget;

    public constructor(private minGamePixelsNumber: number, private absoluteMinPixelNumber: number) {
        this.hdpiManager = new HdpiManager(minGamePixelsNumber, absoluteMinPixelNumber);
    }

    public setGame(game: Game): void {
        this.scaleManager = game.scale;
        this.game = game;
    }

    public applyNewSize(camera?: Phaser.Cameras.Scene2D.Camera) {
        if (this.scaleManager === undefined) {
            return;
        }
        const { width, height } = coWebsiteManager.getGameSize();
        const devicePixelRatio = window.devicePixelRatio ?? 1;
        const { game: gameSize, real: realSize } = this.hdpiManager.getOptimalGameSize({
            width: width * devicePixelRatio,
            height: height * devicePixelRatio,
        });

        if (realSize.width !== 0 && gameSize.width !== 0 && devicePixelRatio !== 0) {
            this.actualZoom = realSize.width / gameSize.width / devicePixelRatio;
        }

        // The performance shows us that resizing the game size outside its real size causes many lags and bad game performance.
        //      So we apply this condition: if the game size is greater than the real size, we don't zoom through the canvas.
        //      To zoom in and out, we use the camera. This is used in the Explorer mode. The zoom is calculated using the optimal zoom level.
        if (gameSize.width <= realSize.width && gameSize.height <= realSize.height) {
            this.scaleManager.resize(gameSize.width, gameSize.height);
            this.scaleManager.setZoom(this.actualZoom);
            camera?.setZoom(1);
        } else {
            camera?.setZoom(
                this.hdpiManager.zoomModifier * this.hdpiManager.getOptimalZoomLevel(realSize.width * realSize.height)
            );
        }

        // Override bug in canvas resizing in Phaser. Let's resize the canvas ourselves
        const style = this.scaleManager.canvas.style;
        style.width = Math.ceil(realSize.width !== 0 ? realSize.width / devicePixelRatio : 0) + "px";
        style.height = Math.ceil(realSize.height !== 0 ? realSize.height / devicePixelRatio : 0) + "px";

        // Resize the game element at the same size at the canvas
        const gameStyle = HtmlUtils.getElementByIdOrFail<HTMLDivElement>("game").style;
        gameStyle.width = style.width;
        gameStyle.height = style.height;

        // Note: onResize will be called twice (once here and once in Game.ts), but we have no better way.
        for (const scene of this.game.scene.getScenes(true)) {
            if (scene instanceof ResizableScene) {
                // We are delaying the call to the "render" event because otherwise, the "camera" coordinates are not correctly updated.
                scene.events.once(Phaser.Scenes.Events.RENDER, () => scene.onResize());
            }
        }

        this.game.markDirty();
    }

    /**
     * Use this in case of resizing while focusing on something
     */
    public refreshFocusOnTarget(camera?: Phaser.Cameras.Scene2D.Camera): void {
        if (!this.focusTarget) {
            return;
        }
        if (this.focusTarget.width && this.focusTarget.height) {
            this.setZoomModifier(
                this.getTargetZoomModifierFor(this.focusTarget.width, this.focusTarget.height),
                camera
            );
        }

        this.game.events.emit(WaScaleManagerEvent.RefreshFocusOnTarget, this.focusTarget);
    }

    public setFocusTarget(targetDimensions?: WaScaleManagerFocusTarget): void {
        this.focusTarget = targetDimensions;
    }

    public getTargetZoomModifierFor(viewportWidth: number, viewportHeight: number) {
        const { width: gameWidth, height: gameHeight } = coWebsiteManager.getGameSize();
        const devicePixelRatio = window.devicePixelRatio ?? this.hdpiManager.maxZoomOut;

        const { real: realSize } = this.hdpiManager.getOptimalGameSize({
            width: gameWidth * devicePixelRatio,
            height: gameHeight * devicePixelRatio,
        });
        const desiredZoom = Math.min(realSize.width / viewportWidth, realSize.height / viewportHeight);
        const realPixelNumber = gameWidth * devicePixelRatio * gameHeight * devicePixelRatio;
        return desiredZoom / (this.hdpiManager.getOptimalZoomLevel(realPixelNumber) || 1);
    }

    public get zoomModifier(): number {
        return this.hdpiManager.zoomModifier;
    }

    public set zoomModifier(zoomModifier: number) {
        this.setZoomModifier(zoomModifier);
    }

    public setZoomModifier(zoomModifier: number, camera?: Phaser.Cameras.Scene2D.Camera): void {
        this.hdpiManager.zoomModifier = zoomModifier;
        this.applyNewSize(camera);
    }

    public handleZoomByFactor(zoomFactor: number, camera: Phaser.Cameras.Scene2D.Camera): void {
        if (zoomFactor > 1 && this.zoomModifier * zoomFactor - this.zoomModifier > 0.1)
            this.setZoomModifier(this.zoomModifier * 1.1, camera);
        else if (zoomFactor < 1 && this.zoomModifier - this.zoomModifier * zoomFactor > 0.1)
            this.setZoomModifier(this.zoomModifier * 0.9, camera);
        else this.setZoomModifier(this.zoomModifier * zoomFactor, camera);

        if (this.focusTarget) {
            this.game.events.emit(WaScaleManagerEvent.RefreshFocusOnTarget, this.focusTarget);
        }
    }

    public getFocusTarget(): WaScaleManagerFocusTarget | undefined {
        return this.focusTarget;
    }

    public saveZoom(): void {
        this._saveZoom = this.hdpiManager.zoomModifier;
    }

    public getSaveZoom(): number {
        return this._saveZoom;
    }

    public restoreZoom(): void {
        this.hdpiManager.zoomModifier = this._saveZoom;
        this.applyNewSize();
    }

    public getActualZoom(): number {
        return this.actualZoom;
    }

    /**
     * This is used to scale back the ui components to counter-act the zoom.
     */
    public get uiScalingFactor(): number {
        return this.actualZoom > 1 ? 1 : 1.2;
    }

    public set maxZoomOut(maxZoomOut: number) {
        this.hdpiManager.maxZoomOut = maxZoomOut;
    }
    public get maxZoomOut(): number {
        return this.hdpiManager.maxZoomOut;
    }

    public get isMaximumZoomReached(): boolean {
        return this.hdpiManager.isMaximumZoomReached;
    }
}

export const waScaleManager = new WaScaleManager(640 * 480, 196 * 196);
