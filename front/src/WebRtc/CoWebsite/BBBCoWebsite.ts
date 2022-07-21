import type CancelablePromise from "cancelable-promise";
import { inExternalServiceStore } from "../../Stores/MyCameraStoreVisibility";
import { coWebsiteManager } from "../CoWebsiteManager";
import { SimpleCoWebsite } from "./SimpleCoWebsite";

export class BBBCoWebsite extends SimpleCoWebsite {
    constructor(url: URL, allowApi?: boolean, allowPolicy?: string, widthPercent?: number, closable?: boolean) {
        coWebsiteManager.getCoWebsites().forEach((coWebsite) => {
            if (coWebsite instanceof BBBCoWebsite) {
                coWebsiteManager.closeCoWebsite(coWebsite);
            }
        });

        super(url, allowApi, allowPolicy, widthPercent, closable);
        this.id = "bbb-meeting-" + this.id;
    }

    load(): CancelablePromise<HTMLIFrameElement> {
        inExternalServiceStore.set(true);
        const loadIframe = super.load();

        if (this.iframe) {
            this.iframe.allowFullscreen = true;
        }

        return loadIframe;
    }

    unload(): Promise<void> {
        inExternalServiceStore.set(false);

        return super.unload();
    }
}
