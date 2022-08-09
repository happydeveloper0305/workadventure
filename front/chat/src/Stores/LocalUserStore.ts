import { UserData } from "../Messages/JsonMessages/ChatData";
import { get, writable } from "svelte/store";

const uuidKey = "uuid";
const nameKey = "name";
const emailKey = "email";
const playUriKey = "playUri";
const wokaKey = "woka";
const colorKey = "color";

function createUserStore() {
  const { subscribe, update, set } = writable<UserData>();

  return {
    subscribe,
    update,
    set,
    get: () => get(userStore),
  };
}

export const userStore = createUserStore();

class LocalUserStore {
  setUserData(data: UserData): void {
    localStorage.setItem(uuidKey, data.uuid);
    if (data.email) localStorage.setItem(emailKey, data.email);
    localStorage.setItem(playUriKey, data.playUri);
  }

  getUserData(): UserData {
    return {
      uuid: localStorage.getItem(uuidKey) || "",
      name: localStorage.getItem(nameKey) || "",
      email: localStorage.getItem(emailKey) || undefined,
      playUri: localStorage.getItem(playUriKey) || "",
      woka: localStorage.getItem(wokaKey) || "",
      color: localStorage.getItem(colorKey) || "",
    };
  }

  getPlayerName(): string {
    return "test";
  }
}

export const localUserStore = new LocalUserStore();
