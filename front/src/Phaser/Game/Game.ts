const Events = Phaser.Core.Events;

/**
 * A specialization of the main Phaser Game scene.
 * It comes with an optimization to skip rendering.
 *
 * Beware, the "step" function might vary in future versions of Phaser.
 */
export class Game extends Phaser.Game {
    public step(time: number, delta: number)
    {
        // @ts-ignore
        if (this.pendingDestroy)
        {
            // @ts-ignore
            return this.runDestroy();
        }

        const eventEmitter = this.events;

        //  Global Managers like Input and Sound update in the prestep

        eventEmitter.emit(Events.PRE_STEP, time, delta);

        //  This is mostly meant for user-land code and plugins

        eventEmitter.emit(Events.STEP, time, delta);

        //  Update the Scene Manager and all active Scenes

        this.scene.update(time, delta);

        //  Our final event before rendering starts

        eventEmitter.emit(Events.POST_STEP, time, delta);

        // This "if" is the changed introduced by the new "Game" class to avoid rendering unnecessarily.
        if (this.isDirty()) {
            const renderer = this.renderer;

            //  Run the Pre-render (clearing the canvas, setting background colors, etc)

            renderer.preRender();

            eventEmitter.emit(Events.PRE_RENDER, renderer, time, delta);

            //  The main render loop. Iterates all Scenes and all Cameras in those scenes, rendering to the renderer instance.

            this.scene.render(renderer);

            //  The Post-Render call. Tidies up loose end, takes snapshots, etc.

            renderer.postRender();

            //  The final event before the step repeats. Your last chance to do anything to the canvas before it all starts again.

            eventEmitter.emit(Events.POST_RENDER, renderer, time, delta);
        } else {
            // @ts-ignore
            this.scene.isProcessing = false;
        }
    }

    private isDirty(): boolean {
        //  Loop through the scenes in forward order
        for (let i = 0; i < this.scene.scenes.length; i++)
        {
            const scene = this.scene.scenes[i];
            const sys = scene.sys;

            if (sys.settings.visible && sys.settings.status >= Phaser.Scenes.LOADING && sys.settings.status < Phaser.Scenes.SLEEPING)
            {
                // @ts-ignore
                if(typeof scene.isDirty === 'function') {
                    // @ts-ignore
                    const isDirty = scene.isDirty() || scene.tweens.getAllTweens().length > 0;
                    if (isDirty) {
                        return true;
                    }
                } else {
                    return true;
                }
            }
        }

        return false;
    }
}
