import type { Translation } from "../i18n-types";
import { ADMIN_URL } from "../../Enum/EnvironmentVariable";

const upgradeLink = ADMIN_URL + "/pricing";

const warning: NonNullable<Translation["warning"]> = {
    title: "¡Atención!",
    content: `¡Este mundo está acercándose a su límite! Puede actualizar su capacidad <a href="${upgradeLink}" target="_blank">aquí</a>`,
    limit: "¡Este mundo está acercándose a su límite!",
    accessDenied: {
        camera: "Acceso a la cámara denegado. Haga clic aquí y revise los permisos de su navegador.",
        screenSharing: "Compartir pantalla denegado. Haga clic aquí y revise los permisos de su navegador.",
        room: "Acceso a la habitación denegado. No tiene permitido entrar en esta habitación.",
        teleport: "No tiene derecho a teletransportarse a este usuario.",
    },
    importantMessage: "Mensaje importante",
    connectionLost: "Conexión perdida. Reconectando...",
    connectionLostTitle: "Conexión perdida",
    connectionLostSubtitle: "Reconectando",
    waitingConnectionTitle: "Esperando a la conexión",
    waitingConnectionSubtitle: "Conectando",
};

export default warning;
