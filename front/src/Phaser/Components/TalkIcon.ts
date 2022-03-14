import { Easing } from "../../types";

export class TalkIcon extends Phaser.GameObjects.Image {
    private shown: boolean;
    private showAnimationTween?: Phaser.Tweens.Tween;

    private defaultPosition: { x: number; y: number };
    private defaultScale: number;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, "iconTalk");

        this.defaultPosition = { x, y };
        this.defaultScale = 0.3;

        this.shown = false;
        this.setAlpha(0);
        this.setScale(this.defaultScale);

        this.scene.add.existing(this);
    }

    public show(show: boolean = true, forceClose: boolean = false): void {
        if (this.shown === show && !forceClose) {
            return;
        }
        this.showAnimation(show, forceClose);
    }

    private showAnimation(show: boolean = true, forceClose: boolean = false) {
        if (forceClose && !show) {
            this.showAnimationTween?.stop();
        } else if (this.showAnimationTween?.isPlaying()) {
            return;
        }
        this.shown = show;
        if (show) {
            this.y += 50;
            this.scale = 0.05;
            this.alpha = 0;
        }
        this.showAnimationTween = this.scene.tweens.add({
            targets: [this],
            duration: 350,
            alpha: show ? 1 : 0,
            y: this.defaultPosition.y,
            scale: this.defaultScale,
            ease: Easing.BackEaseOut,
            onComplete: () => {
                this.showAnimationTween = undefined;
            },
        });
    }

    public isShown(): boolean {
        return this.shown;
    }
}
