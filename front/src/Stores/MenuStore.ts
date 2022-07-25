import { get, writable } from "svelte/store";
import Timeout = NodeJS.Timeout;
import { userIsAdminStore } from "./GameStore";
import { CONTACT_URL, IDENTITY_URL, PROFILE_URL } from "../Enum/EnvironmentVariable";
import type { Translation } from "../i18n/i18n-types";
import axios from "axios";
import { localUserStore } from "../Connexion/LocalUserStore";
import { connectionManager } from "../Connexion/ConnectionManager";

export const menuIconVisiblilityStore = writable(false);
export const menuVisiblilityStore = writable(false);
export const menuInputFocusStore = writable(false);
export const userIsConnected = writable(false);
export const profileAvailable = writable(true);
export const profileInPorgress = writable(true);

let timeOut: Timeout | null = null;
menuVisiblilityStore.subscribe((value) => {
    if (userIsConnected && value && IDENTITY_URL != null) {
        if (timeOut) {
            clearTimeout(timeOut);
        }
        profileInPorgress.set(true);
        timeOut = setTimeout(() => {
            axios
                .get(getMeUrl())
                .then((data) => {
                    profileAvailable.set(true);
                    profileInPorgress.set(false);
                    return data;
                })
                .catch((err) => {
                    console.info("I'm not connected", err);
                    profileAvailable.set(false);
                    profileInPorgress.set(false);
                });
        }, 1000);
    }
});

let warningContainerTimeout: Timeout | null = null;
function createWarningContainerStore() {
    const { subscribe, set } = writable<boolean>(false);

    return {
        subscribe,
        activateWarningContainer() {
            set(true);
            if (warningContainerTimeout) clearTimeout(warningContainerTimeout);
            warningContainerTimeout = setTimeout(() => {
                set(false);
                warningContainerTimeout = null;
            }, 120000);
        },
    };
}

export const warningContainerStore = createWarningContainerStore();

export enum SubMenusInterface {
    settings = "settings",
    profile = "profile",
    invite = "invite",
    aboutRoom = "credit",
    globalMessages = "globalMessages",
    contact = "contact",
}

type MenuKeys = keyof Translation["menu"]["sub"];

export interface TranslatedMenu {
    type: "translated";
    key: MenuKeys;
}

/**
 * A menu item from the scripting API
 */
interface ScriptingMenu {
    type: "scripting";
    label: string;
}

export type MenuItem = TranslatedMenu | ScriptingMenu;

export const inviteMenu: MenuItem = {
    type: "translated",
    key: SubMenusInterface.invite,
};

function createSubMenusStore() {
    const { subscribe, update, set } = writable<MenuItem[]>([
        {
            type: "translated",
            key: SubMenusInterface.profile,
        },
        {
            type: "translated",
            key: SubMenusInterface.globalMessages,
        },
        {
            type: "translated",
            key: SubMenusInterface.contact,
        },
        {
            type: "translated",
            key: SubMenusInterface.settings,
        },
        {
            type: "translated",
            key: SubMenusInterface.aboutRoom,
        },
        inviteMenu,
    ]);

    return {
        subscribe,
        set,
        addTranslatedMenu(menuCommand: MenuKeys) {
            update((menuList) => {
                if (!menuList.find((menu) => menu.type === "translated" && menu.key === menuCommand)) {
                    menuList.push({
                        type: "translated",
                        key: menuCommand,
                    });
                }
                return menuList;
            });
        },
        removeTranslatedMenu(menuCommand: MenuKeys) {
            update((menuList) => {
                const index = menuList.findIndex((menu) => menu.type === "translated" && menu.key === menuCommand);
                if (index !== -1) {
                    menuList.splice(index, 1);
                }
                return menuList;
            });
        },
        addScriptingMenu(menuCommand: string) {
            update((menuList) => {
                if (!menuList.find((menu) => menu.type === "scripting" && menu.label === menuCommand)) {
                    menuList.push({
                        type: "scripting",
                        label: menuCommand,
                    });
                }
                return menuList;
            });
        },
        removeScriptingMenu(menuCommand: string) {
            update((menuList) => {
                const index = menuList.findIndex((menu) => menu.type === "scripting" && menu.label === menuCommand);
                if (index !== -1) {
                    menuList.splice(index, 1);
                }
                return menuList;
            });
        },
    };
}

export const subMenusStore = createSubMenusStore();

export const activeSubMenuStore = writable<number>(0);

export const contactPageStore = writable<string | undefined>(CONTACT_URL);

export function checkSubMenuToShow() {
    subMenusStore.removeTranslatedMenu(SubMenusInterface.globalMessages);
    subMenusStore.removeTranslatedMenu(SubMenusInterface.contact);

    if (get(userIsAdminStore)) {
        subMenusStore.addTranslatedMenu(SubMenusInterface.globalMessages);
    }

    if (get(contactPageStore) !== undefined) {
        subMenusStore.addTranslatedMenu(SubMenusInterface.contact);
    }
}

export const customMenuIframe = new Map<string, { url: string; allowApi: boolean }>();

export function handleMenuRegistrationEvent(
    menuName: string,
    iframeUrl: string | undefined = undefined,
    source: string | undefined = undefined,
    options: { allowApi: boolean }
) {
    if (get(subMenusStore).find((item) => item.type === "scripting" && item.label === menuName)) {
        console.warn("The menu " + menuName + " already exist.");
        return;
    }

    subMenusStore.addScriptingMenu(menuName);

    if (iframeUrl !== undefined) {
        const url = new URL(iframeUrl, source);
        customMenuIframe.set(menuName, { url: url.toString(), allowApi: options.allowApi });
    }
}

export function handleMenuUnregisterEvent(menuName: string) {
    subMenusStore.removeScriptingMenu(menuName);
    customMenuIframe.delete(menuName);
}

export function getProfileUrl() {
    return PROFILE_URL + `?token=${localUserStore.getAuthToken()}&playUri=${connectionManager.currentRoom?.key}`;
}

export function getMeUrl() {
    return IDENTITY_URL + `?token=${localUserStore.getAuthToken()}&playUri=${connectionManager.currentRoom?.key}`;
}

export const inviteUserActivated = writable(true);

inviteUserActivated.subscribe((value) => {
    //update menu tab
    const valuesSubMenusStore = get(subMenusStore);
    if (!valuesSubMenusStore) {
        return;
    }
    const indexInviteMenu = valuesSubMenusStore.findIndex(
        (menu) => (menu as TranslatedMenu).key === SubMenusInterface.invite
    );
    if (value && indexInviteMenu === -1) {
        valuesSubMenusStore.push(inviteMenu);
        subMenusStore.set(valuesSubMenusStore);
    } else if (!value && indexInviteMenu !== -1) {
        valuesSubMenusStore.splice(indexInviteMenu, 1);
        subMenusStore.set(valuesSubMenusStore);
    }
});
