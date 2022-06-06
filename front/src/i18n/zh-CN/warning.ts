import type { Translation } from "../i18n-types";
import { ADMIN_URL } from "../../Enum/EnvironmentVariable";

const upgradeLink = ADMIN_URL + "/pricing";

const warning: NonNullable<Translation["warning"]> = {
    title: "警告!",
    content: `该世界已接近容量限制！你可以 <a href="${upgradeLink}" target="_blank">点击这里</a> 升级它的容量`,
    limit: "该世界已接近容量限制!",
    accessDenied: {
        camera: "摄像头访问权限被拒绝。点击这里检查你的浏览器权限。",
        screenSharing: "屏幕共享权限被拒绝。点击这里检查你的浏览器权限。",
        room: "Room access denied. You are not allowed to enter this room.", // TODO: translate
    },
    importantMessage: "重要消息",
    connectionLost: "连接丢失。重新连接中...",
    connectionLostTitle: "连接丢失。",
    connectionLostSubtitle: "重新连接中",
    waitingConnectionTitle: "Waiting for connection", // TODO: translate
    waitingConnectionSubtitle: "Connecting", // TODO: translate
};

export default warning;
