import type { Translation } from "../i18n-types";

const camera: NonNullable<Translation["camera"]> = {
    enable: {
        title: "Encendre la càmera i el micròfon",
        start: "Som-hi!",
    },
    help: {
        title: "Es necessita accéss a la càmera/micròfon",
        permissionDenied: "Permís denegat",
        content: "Ha de permetre accés a la càmera i el micròfon al navegador.",
        firefoxContent:
            'Si us plau, feu clic a la caixa "Recordar aquesta decisió", si no voleu que Firefox sigui demanant autorització.',
        refresh: "Refrescar",
        continue: "Continuar sense càmera",
        screen: {
            firefox: "/resources/help-setting-camera-permission/en-US-firefox.png",
            chrome: "/resources/help-setting-camera-permission/en-US-firefox.png",
        },
    },
    my: {
        silentZone: "Zona silenciosa",
    },
};

export default camera;
