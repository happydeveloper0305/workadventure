import { POSTHOG_API_KEY, POSTHOG_URL } from "../Enum/EnvironmentVariable";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let window: any;

class AnalyticsClient {
    private posthogPromise: Promise<typeof import("posthog-js").default> | undefined;

    constructor() {
        if (POSTHOG_API_KEY && POSTHOG_URL) {
            this.posthogPromise = import("posthog-js").then(({ default: posthog }) => {
                posthog.init(POSTHOG_API_KEY, { api_host: POSTHOG_URL });
                //the posthog toolbar need a reference in window to be able to work
                window.posthog = posthog;
                return posthog;
            });
        }
    }

    identifyUser(uuid: string, email: string | null): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.identify(uuid, { uuid, email, wa: true });
            })
            .catch((e) => console.error(e));
    }

    loggedWithSso(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa-logged-sso");
            })
            .catch((e) => console.error(e));
    }

    loggedWithToken(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa-logged-token");
            })
            .catch((e) => console.error(e));
    }

    enteredRoom(roomId: string, roomGroup: string | null): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("$pageView", { roomId, roomGroup });
                posthog.capture("enteredRoom");
            })
            .catch((e) => console.error(e));
    }

    openedMenu(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa-opened-menu");
            })
            .catch((e) => console.error(e));
    }

    launchEmote(emote: string): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa-emote-launch", { emote });
            })
            .catch((e) => console.error(e));
    }

    enteredJitsi(roomName: string, roomId: string): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa-entered-jitsi", { roomName, roomId });
            })
            .catch((e) => console.error(e));
    }

    validationName(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa-name-validation");
            })
            .catch((e) => console.error(e));
    }

    validationWoka(scene: string): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa-woka-validation", { scene });
            })
            .catch((e) => console.error(e));
    }

    validationVideo(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa-video-validation");
            })
            .catch((e) => console.error(e));
    }

    /** New feature analytics **/
    openedChat(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa-opened-chat");
            })
            .catch((e) => console.error(e));
    }

    openRegister(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa-opened-register");
            })
            .catch((e) => console.error(e));
    }

    openInvite(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa-opened-invite");
            })
            .catch((e) => console.error(e));
    }

    lockDiscussion(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_lockroom");
            })
            .catch((e) => console.error(e));
    }

    screenSharing(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa-screensharing");
            })
            .catch((e) => console.error(e));
    }

    follow(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_follow");
            })
            .catch((e) => console.error(e));
    }

    camera(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_camera");
            })
            .catch((e) => console.error(e));
    }

    microphone(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_microphone");
            })
            .catch((e) => console.error(e));
    }

    settingMicrophone(value: string): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_setting_microphone", {
                    checkbox: value,
                });
            })
            .catch((e) => console.error(e));
    }

    settingCamera(value: string): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_setting_camera", {
                    checkbox: value,
                });
            })
            .catch((e) => console.error(e));
    }

    settingNotification(value: string): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_setting_notification", {
                    checkbox: value,
                });
            })
            .catch((e) => console.error(e));
    }

    settingFullscreen(value: string): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_setting_fullscreen", {
                    checkbox: value,
                });
            })
            .catch((e) => console.error(e));
    }

    settingAskWebsite(value: string): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_setting_ask_website", {
                    checkbox: value,
                });
            })
            .catch((e) => console.error(e));
    }

    settingRequestFollow(value: string): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_setting_request_follow", {
                    checkbox: value,
                });
            })
            .catch((e) => console.error(e));
    }

    settingDecreaseAudioVolume(value: string): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_setting_decrease_audio_volume", {
                    checkbox: value,
                });
            })
            .catch((e) => console.error(e));
    }

    login(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_login");
            })
            .catch((e) => console.error(e));
    }

    logout(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_logout");
            })
            .catch((e) => console.error(e));
    }

    switchMultiIframe(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_multiiframe_switch");
            })
            .catch((e) => console.error(e));
    }

    closeMultiIframe(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_multiiframe_close");
            })
            .catch((e) => console.error(e));
    }

    fullScreenMultiIframe(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_multiiframe_fullscreen");
            })
            .catch((e) => console.error(e));
    }

    stackOpenCloseMultiIframe(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_multiiframe_stack_open_close");
            })
            .catch((e) => console.error(e));
    }

    menuCredit(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_menu_credit");
            })
            .catch((e) => console.error(e));
    }

    menuProfile(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_menu_profile");
            })
            .catch((e) => console.error(e));
    }

    menuSetting() {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_menu_setting");
            })
            .catch((e) => console.error(e));
    }

    menuInvite(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_menu_invite");
            })
            .catch((e) => console.error(e));
    }

    globalMessage(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_menu_globalmessage");
            })
            .catch((e) => console.error(e));
    }

    menuContact(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_menu_contact");
            })
            .catch((e) => console.error(e));
    }

    inviteCopyLink(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_menu_invite_copylink");
            })
            .catch((e) => console.error(e));
    }

    inviteCopyLinkWalk(value: string): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_menu_invite_copylink_walk", {
                    checkbox: value,
                });
            })
            .catch((e) => console.error(e));
    }

    editCompanion(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_edit_companion");
            })
            .catch((e) => console.error(e));
    }

    editCamera(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_edit_camera");
            })
            .catch((e) => console.error(e));
    }

    editName(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_edit_name");
            })
            .catch((e) => console.error(e));
    }

    editWoka(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_edit_woka");
            })
            .catch((e) => console.error(e));
    }

    selectWoka(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_wokascene_select");
            })
            .catch((e) => console.error(e));
    }

    selectCustomWoka(): void {
        this.posthogPromise
            ?.then((posthog) => {
                posthog.capture("wa_wokascene_custom");
            })
            .catch((e) => console.error(e));
    }
}
export const analyticsClient = new AnalyticsClient();
