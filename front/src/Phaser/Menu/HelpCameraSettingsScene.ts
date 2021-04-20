import {mediaManager} from "../../WebRtc/MediaManager";
import {HtmlUtils} from "../../WebRtc/HtmlUtils";
import {localUserStore} from "../../Connexion/LocalUserStore";

export const HelpCameraSettingsSceneName = 'HelpCameraSettingsScene';
const helpCameraSettings = 'helpCameraSettings';
/**
 * The scene that show how to permit Camera and Microphone access if there are not already allowed
 */
export class HelpCameraSettingsScene extends Phaser.Scene {
    private helpCameraSettingsElement!: Phaser.GameObjects.DOMElement;
    private helpCameraSettingsOpened: boolean = false;

    constructor() {
        super({key: HelpCameraSettingsSceneName});
    }

    preload() {
        this.load.html(helpCameraSettings, 'resources/html/helpCameraSettings.html');
    }

    create(){
        localUserStore.setHelpCameraSettingsShown();
        this.createHelpCameraSettings();
    }

    private createHelpCameraSettings() : void {
        const middleX = this.getMiddleX();
        this.helpCameraSettingsElement = this.add.dom(middleX, -800, undefined, {overflow: 'scroll'}).createFromCache(helpCameraSettings);
        this.revealMenusAfterInit(this.helpCameraSettingsElement, helpCameraSettings);
        this.helpCameraSettingsElement.addListener('click');
        this.helpCameraSettingsElement.on('click',  (event:MouseEvent) => {
            event.preventDefault();
            if((event?.target as HTMLInputElement).id === 'helpCameraSettingsFormRefresh') {
                window.location.reload();
            }else if((event?.target as HTMLInputElement).id === 'helpCameraSettingsFormContinue') {
                this.closeHelpCameraSettingsOpened();
            }
        });

        if(!mediaManager.constraintsMedia.audio || !mediaManager.constraintsMedia.video){
            this.openHelpCameraSettingsOpened();
        }
    }

    private openHelpCameraSettingsOpened(): void{
        HtmlUtils.getElementByIdOrFail<HTMLDivElement>('webRtcSetup').style.display = 'none';
        this.helpCameraSettingsOpened = true;
        if(window.navigator.userAgent.includes('Firefox')){
            HtmlUtils.getElementByIdOrFail<HTMLParagraphElement>('browserHelpSetting').innerHTML ='<img src="/resources/objects/help-setting-camera-permission-firefox.png"/>';
        }else if(window.navigator.userAgent.includes('Chrome')){
            HtmlUtils.getElementByIdOrFail<HTMLParagraphElement>('browserHelpSetting').innerHTML ='<img src="/resources/objects/help-setting-camera-permission-chrome.png"/>';
        }
        const middleY = this.getMiddleY();
        const middleX = this.getMiddleX();
        this.tweens.add({
            targets: this.helpCameraSettingsElement,
            y: middleY,
            x: middleX,
            duration: 1000,
            ease: 'Power3',
            overflow: 'scroll'
        });
    }

    private closeHelpCameraSettingsOpened(): void{
        const middleX = this.getMiddleX();
        const helpCameraSettingsInfo = this.helpCameraSettingsElement.getChildByID('helpCameraSettings') as HTMLParagraphElement;
        helpCameraSettingsInfo.innerText = '';
        helpCameraSettingsInfo.style.display = 'none';
        this.helpCameraSettingsOpened = false;
        this.tweens.add({
            targets: this.helpCameraSettingsElement,
            y: -400,
            x: middleX,
            duration: 1000,
            ease: 'Power3',
            overflow: 'scroll'
        });
    }

    private revealMenusAfterInit(menuElement: Phaser.GameObjects.DOMElement, rootDomId: string) {
        //Dom elements will appear inside the viewer screen when creating before being moved out of it, which create a flicker effect.
        //To prevent this, we put a 'hidden' attribute on the root element, we remove it only after the init is done.
        setTimeout(() => {
            (menuElement.getChildByID(rootDomId) as HTMLElement).hidden = false;
        }, 250);
    }

    update(time: number, delta: number): void {
        const middleX = this.getMiddleX();
        const middleY = this.getMiddleY();
        this.tweens.add({
            targets: this.helpCameraSettingsElement,
            x: middleX,
            y: middleY,
            duration: 1000,
            ease: 'Power3'
        });
    }

    public onResize(ev: UIEvent): void {
        const middleX = this.getMiddleX();
        const middleY = this.getMiddleY();
        this.tweens.add({
            targets: this.helpCameraSettingsElement,
            x: middleX,
            y: middleY,
            duration: 1000,
            ease: 'Power3'
        });
    }

    private getMiddleX() : number{
        const middleX = ((window.innerWidth) - ((
            this.helpCameraSettingsElement
            && this.helpCameraSettingsElement.node
            && this.helpCameraSettingsElement.node.getBoundingClientRect().width > 0
                ? this.helpCameraSettingsElement.node.getBoundingClientRect().width : 300 /*FIXME to use a const will be injected in HTMLElement*/)*2)) / 2;
        return (middleX > 0 ? middleX / 2 : 0);
    }

    private getMiddleY() : number{
        console.log('this.helpCameraSettingsElement.node.getBoundingClientRect()', this.helpCameraSettingsElement.node.getBoundingClientRect());
        const middleY = ((window.innerHeight) - (
            (this.helpCameraSettingsElement
            && this.helpCameraSettingsElement.node
            && this.helpCameraSettingsElement.node.getBoundingClientRect().height > 0
                ? this.helpCameraSettingsElement.node.getBoundingClientRect().height : 400 /*FIXME to use a const will be injected in HTMLElement*/)*2)) / 2;
        return (middleY > 0 ? middleY / 2 : 0);
    }

}

