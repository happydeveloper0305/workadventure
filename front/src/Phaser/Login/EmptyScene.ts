import { Scene } from "phaser";

export const EmptySceneName = "EmptyScene";

export class EmptyScene extends Scene {
    constructor() {
        super({
            key: EmptySceneName,
        });
    }

    preload() {}

    create() {}

    update(time: number, delta: number): void {}
}
