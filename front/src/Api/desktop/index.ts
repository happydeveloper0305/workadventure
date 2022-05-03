import { requestedCameraState, requestedMicrophoneState, silentStore } from "../../Stores/MediaStore";
import { get } from "svelte/store";
import { WorkAdventureDesktopApi } from "../../Interfaces/DesktopAppInterfaces";

declare global {
    interface Window {
        WAD?: WorkAdventureDesktopApi;
    }
}

class DesktopApi {
    isSilent: boolean = false;

    init() {
        if (!window?.WAD?.desktop) {
            return;
        }

        console.log("Yipee you are using the desktop app ;)");

        window.WAD.onMuteToggle(() => {
            if (this.isSilent) return;
            if (get(requestedMicrophoneState) === true) {
                requestedMicrophoneState.disableMicrophone();
            } else {
                requestedMicrophoneState.enableMicrophone();
            }
        });

        window.WAD.onCameraToggle(() => {
            if (this.isSilent) return;
            if (get(requestedCameraState) === true) {
                requestedCameraState.disableWebcam();
            } else {
                requestedCameraState.enableWebcam();
            }
        });

        silentStore.subscribe((silent) => {
            this.isSilent = silent;
        });
    }
}

export const desktopApi = new DesktopApi();
