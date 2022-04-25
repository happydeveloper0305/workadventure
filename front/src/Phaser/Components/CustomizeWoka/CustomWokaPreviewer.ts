import { Easing } from "../../../types";
import { getPlayerAnimations, PlayerAnimationDirections, PlayerAnimationTypes } from "../../Player/Animation";

export enum CustomWokaBodyPart {
    Body = "Body",
    Eyes = "Eyes",
    Hair = "Hair",
    Clothes = "Clothes",
    Hat = "Hat",
    Accessory = "Accessory",
}

export enum CustomWokaBodyPartOrder {
    Body,
    Eyes,
    Hair,
    Clothes,
    Hat,
    Accessory,
}

export interface CustomWokaPreviewerConfig {
    color: number;
    borderThickness: number;
    borderColor: number;
    bodyPartsOffsetX: number;
}

export class CustomWokaPreviewer extends Phaser.GameObjects.Container {
    private background: Phaser.GameObjects.Image;
    private frame: Phaser.GameObjects.Graphics;
    private sprites: Record<CustomWokaBodyPart, Phaser.GameObjects.Sprite>;
    private turnIcon: Phaser.GameObjects.Image;

    private animationDirection: PlayerAnimationDirections = PlayerAnimationDirections.Down;
    private moving: boolean = true;

    private turnIconTween?: Phaser.Tweens.Tween;

    private config: CustomWokaPreviewerConfig;

    public readonly SIZE: number = 50;

    constructor(scene: Phaser.Scene, x: number, y: number, config: CustomWokaPreviewerConfig) {
        super(scene, x, y);

        this.config = config;

        this.sprites = {
            [CustomWokaBodyPart.Accessory]: this.scene.add
                .sprite(this.config.bodyPartsOffsetX, 0, "")
                .setVisible(false),
            [CustomWokaBodyPart.Body]: this.scene.add.sprite(this.config.bodyPartsOffsetX, 0, "").setVisible(false),
            [CustomWokaBodyPart.Clothes]: this.scene.add.sprite(this.config.bodyPartsOffsetX, 0, "").setVisible(false),
            [CustomWokaBodyPart.Eyes]: this.scene.add.sprite(this.config.bodyPartsOffsetX, 0, "").setVisible(false),
            [CustomWokaBodyPart.Hair]: this.scene.add.sprite(this.config.bodyPartsOffsetX, 0, "").setVisible(false),
            [CustomWokaBodyPart.Hat]: this.scene.add.sprite(this.config.bodyPartsOffsetX, 0, "").setVisible(false),
        };

        this.background = this.scene.add.image(0, 0, "floorTexture0");
        this.frame = this.scene.add.graphics();
        this.turnIcon = this.scene.add
            .image(this.background.displayWidth * 0.35, this.background.displayHeight * 0.35, "iconTurn")
            .setScale(0.2)
            .setAlpha(0.75);

        this.drawFrame();
        this.setSize(this.SIZE, this.SIZE);
        this.setInteractive({ cursor: "pointer" });

        this.add([
            this.background,
            this.frame,
            this.sprites.Body,
            this.sprites.Eyes,
            this.sprites.Hair,
            this.sprites.Clothes,
            this.sprites.Hat,
            this.sprites.Accessory,
            this.turnIcon,
        ]);

        this.bindEventHandlers();

        this.scene.add.existing(this);
    }

    public update(): void {
        this.animate();
    }

    public changeAnimation(direction: PlayerAnimationDirections, moving: boolean): void {
        this.animationDirection = direction;
        this.moving = moving;
    }

    public updateSprite(textureKey: string, bodyPart: CustomWokaBodyPart): void {
        this.sprites[bodyPart].anims.stop();
        this.sprites[bodyPart].setTexture(textureKey).setVisible(textureKey !== "");
        if (textureKey === "") {
            return;
        }
        getPlayerAnimations(textureKey).forEach((d) => {
            this.scene.anims.create({
                key: d.key,
                frames: this.scene.anims.generateFrameNumbers(d.frameModel, { frames: d.frames }),
                frameRate: d.frameRate,
                repeat: d.repeat,
            });
        });
        // Needed, otherwise, animations are not handled correctly.
        if (this.scene) {
            this.scene.sys.updateList.add(this.sprites[bodyPart]);
        }
    }

    public isMoving(): boolean {
        return this.moving;
    }

    public getAnimationDirection(): PlayerAnimationDirections {
        return this.animationDirection;
    }

    private bindEventHandlers(): void {
        this.on(Phaser.Input.Events.POINTER_UP, () => {
            const direction = this.getNextAnimationDirection();
            const moving = direction === PlayerAnimationDirections.Down ? !this.moving : this.moving;
            this.changeAnimation(direction, moving);

            this.turnIconTween?.stop();
            this.turnIcon.setScale(0.2);
            this.turnIconTween = this.scene.tweens.add({
                targets: [this.turnIcon],
                duration: 100,
                scale: 0.15,
                yoyo: true,
                ease: Easing.SineEaseIn,
            });
        });
    }

    private drawFrame(): void {
        this.frame.clear();
        this.frame.lineStyle(this.config.borderThickness, 0xadafbc);
        this.frame.strokeRect(-this.SIZE / 2, -this.SIZE / 2, this.SIZE, this.SIZE);
    }

    private animate(): void {
        for (const bodyPartKey in this.sprites) {
            const sprite = this.sprites[bodyPartKey as CustomWokaBodyPart];
            if (!sprite.anims) {
                console.error("ANIMS IS NOT DEFINED!!!");
                return;
            }
            const textureKey = sprite.texture.key;
            if (textureKey === "__MISSING") {
                continue;
            }
            if (
                this.moving &&
                (!sprite.anims.currentAnim || sprite.anims.currentAnim.key !== this.animationDirection)
            ) {
                sprite.play(textureKey + "-" + this.animationDirection + "-" + PlayerAnimationTypes.Walk, true);
            } else if (!this.moving) {
                sprite.anims.play(textureKey + "-" + this.animationDirection + "-" + PlayerAnimationTypes.Idle, true);
            }
        }
    }

    private getNextAnimationDirection(): PlayerAnimationDirections {
        switch (this.animationDirection) {
            case PlayerAnimationDirections.Down:
                return PlayerAnimationDirections.Left;
            case PlayerAnimationDirections.Left:
                return PlayerAnimationDirections.Up;
            case PlayerAnimationDirections.Up:
                return PlayerAnimationDirections.Right;
            case PlayerAnimationDirections.Right:
                return PlayerAnimationDirections.Down;
        }
    }
}
