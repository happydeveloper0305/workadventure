import type { BaseTranslation } from "../i18n-types";

const report: BaseTranslation = {
    block: {
        title: "Bloquear",
        content: "Bloqueie qualquer comunicação de e para {userName}. Isso pode ser revertido.",
        unblock: "Desbloquear este usuário",
        block: "Bloqueie esse usuário",
    },
    title: "Relatório",
    content:
        "Envie uma mensagem de relatório aos administradores desta sala. Eles podem banir este usuário mais tarde.",
    message: {
        title: "Sua mensagem: ",
        empty: "A mensagem de relatório não pode ficar vazia.",
    },
    submit: "Denunciar este usuário",
    moderate: {
        title: "Moderar {userName}",
        block: "Bloquear",
        report: "Relatório",
        noSelect: "ERRO: Não há nenhuma ação selecionada.",
    },
};

export default report;
