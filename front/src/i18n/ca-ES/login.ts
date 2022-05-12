import type { Translation } from "../i18n-types";

const login: NonNullable<Translation["login"]> = {
    input: {
        name: {
            placeholder: "Introduïu el vostre nombre",
            empty: "El nom està buit",
        },
    },
    terms: `Si continueu, esteu d'acord amb els nostres <a href="https://workadventu.re/terms-of-use" target="_blank">termes d'ús</a>, <a href="https://workadventu.re/privacy-policy" target="_blank">política de privacitat</a> i <a href="https://workadventu.re/cookie-policy" target="_blank">política de cookie</a>.`,
    continue: "Continuar",
};

export default login;
