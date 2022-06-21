import type { BaseTranslation } from "../i18n-types";

const camera: BaseTranslation = {
    enable: {
        title: "Ligue sua câmera e microfone",
        start: "Vamos lá!",
    },
    help: {
        title: "Necessário acesso à câmera/microfone",
        permissionDenied: "Permissão negada",
        content: "Você deve permitir o acesso à câmera e ao microfone em seu navegador.",
        firefoxContent:
            'Por favor, clique na caixa de seleção "Lembrar esta decisão", se você não quiser que o Firefox continue pedindo a autorização.',
        refresh: "Atualizar",
        continue: "Continuar sem webcam",
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
