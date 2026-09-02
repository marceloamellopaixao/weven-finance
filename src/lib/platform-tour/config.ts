import type { DriveStep } from "driver.js";
import { PlatformTourRouteKey } from "@/types/navigation";

export type PlatformTourStep = DriveStep & {
  stepId?: string;
};

type PlatformTourRouteConfig = {
  nextRoute: PlatformTourRouteKey | null;
  nextHref: string | null;
  steps: PlatformTourStep[];
};

export const PLATFORM_TOUR_ROUTE_HREFS: Record<PlatformTourRouteKey, string> = {
  dashboard: "/dashboard?tour=1",
  settings: "/settings?tab=account&tour=1",
  "account-profile": "/account-profile?create=1&tour=1",
  "transactions-new": "/transactions/new?tour=1",
  reports: "/reports?tour=1",
  cards: "/cards?tour=1",
  "piggy-bank": "/piggy-bank?tour=1",
};

function clickSelectorAndAdvance(selector: string) {
  return (
    _element: Element | undefined,
    _step: DriveStep,
    options: {
      driver: {
        moveNext: () => void;
      };
    }
  ) => {
    const node = document.querySelector<HTMLElement>(selector);
    node?.click();
    window.setTimeout(() => {
      options.driver.moveNext();
    }, 220);
  };
}

function openSelectorAndAdvance(triggerSelector: string, targetSelector: string) {
  return (
    _element: Element | undefined,
    _step: DriveStep,
    options: {
      driver: {
        moveNext: () => void;
      };
    }
  ) => {
    if (!document.querySelector<HTMLElement>(targetSelector)) {
      document.querySelector<HTMLElement>(triggerSelector)?.click();
    }
    window.setTimeout(() => {
      options.driver.moveNext();
    }, 260);
  };
}

export function getPlatformTourConfig(
  setAccountMenuOpen: (value: boolean) => void
): Record<PlatformTourRouteKey, PlatformTourRouteConfig> {
  return {
    dashboard: {
      nextRoute: "settings",
      nextHref: "/settings?tab=account",
      steps: [
        {
          element: "#tour-welcome-header",
          popover: {
            title: "Seu painel principal",
            description:
              "Aqui você entende como o mês está andando e qual deve ser seu próximo passo.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-new-transaction",
          popover: {
            title: "Registrar dinheiro que entrou ou saiu",
            description:
              "Este botão é o atalho principal do app. E por aqui que você comeca a organizar seu mês.",
            side: "bottom",
          },
        },
        {
          element: "#tour-month-select",
          popover: {
            title: "Escolha o mês",
            description:
              "Troque de mês para revisar o passado, acompanhar agora ou planejar o que vem pela frente.",
            side: "bottom",
          },
        },
        {
          element: "#tour-balance-card",
          popover: {
            title: "Quanto você tem hoje",
            description:
              "Este valor mostra o que já entrou e saiu de verdade até agora.",
            side: "bottom",
          },
        },
        {
          element: "#tour-movement-card",
          popover: {
            title: "Entradas e saídas do mês",
            description:
              "Aqui você compara o que entrou com o que saiu para saber se o mês está equilibrado.",
            side: "bottom",
          },
        },
        {
          stepId: "monthlyForecast",
          element: "#tour-forecast-card",
          popover: {
            title: "Como o mês deve terminar",
            description:
              "Se os itens pendentes forem pagos ou recebidos, este é o resultado mais provável para o fechamento.",
            side: "bottom",
          },
        },
        {
          stepId: "smartDailyLimit",
          element: "#tour-smart-daily-limit",
          popover: {
            title: "Quanto você pode gastar hoje",
            description:
              "Este limite diário transforma sua previsão do mês em uma decisão simples para o dia a dia.",
            side: "bottom",
          },
        },
        {
          element: "#tour-transactions-table",
          popover: {
            title: "Seu extrato",
            description:
              "Aqui você encontra cada lançamento, aplica filtros e resolve pendências sem se perder.",
            side: "top",
          },
        },
        {
          element: "#tour-workspace-switcher",
          popover: {
            title: "Trocar de perfil",
            description:
              "Este seletor muda o perfil ativo. Cada perfil carrega seus próprios lançamentos, cartões, metas e categorias.",
            side: "bottom",
          },
        },
        {
          element: "#tour-account-avatar",
          onHighlightStarted: () => setAccountMenuOpen(true),
          onDeselected: () => setAccountMenuOpen(false),
          popover: {
            title: "Troca de telas",
            description:
              "Na sua foto ficam os acessos para as áreas principais do app. Vamos continuar por lá.",
            side: "left",
            align: "start",
          },
        },
      ],
    },
    settings: {
      nextRoute: "account-profile",
      nextHref: "/account-profile?create=1",
      steps: [
        {
          element: "#tour-settings-header",
          popover: {
            title: "Sua conta em um lugar",
            description:
              "Aqui ficam seus dados, plano, privacidade, ajuda e ações importantes da conta.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-settings-account-tab",
          popover: {
            title: "Aba Geral",
            description:
              "Use esta aba para manter nome, telefone e acessos principais organizados.",
            side: "bottom",
          },
        },
        {
          element: "#tour-settings-panel",
          popover: {
            title: "Conteúdo da aba",
            description:
              "Esta área muda conforme a aba escolhida, sem tirar você da mesma tela.",
            side: "top",
          },
        },
        {
          element: "#tour-settings-profiles-tab",
          popover: {
            title: "Perfis financeiros",
            description:
              "Aqui você alterna, revisa e organiza perfis de uso pessoal, Família e Business/PJ sem misturar dados.",
            side: "bottom",
            onNextClick: clickSelectorAndAdvance("#tour-settings-profiles-tab"),
          },
        },
        {
          element: "#tour-settings-profiles-panel",
          popover: {
            title: "Dados separados por perfil",
            description:
              "Cada perfil financeiro tem seus próprios dados. Ao trocar de perfil, o app carrega somente as informações daquele perfil.",
            side: "top",
          },
        },
        {
          stepId: "familyWorkspace",
          element: "#tour-settings-family-tab",
          popover: {
            title: "Perfil Família",
            description:
              "Quando existe um perfil Família, esta aba mostra membros, convites e permissões desse perfil.",
            side: "bottom",
            onNextClick: clickSelectorAndAdvance("#tour-settings-family-tab"),
          },
        },
        {
          stepId: "familyWorkspace",
          element: "#tour-settings-family-panel",
          popover: {
            title: "Gestão da família",
            description:
              "Use esta área para administrar quem participa da família e o que cada membro pode acessar.",
            side: "top",
          },
        },
        {
          element: "#tour-settings-billing-tab",
          popover: {
            title: "Plano e assinatura",
            description:
              "Abra esta aba para ver seu plano, pagamentos e opções de upgrade.",
            side: "bottom",
            onNextClick: clickSelectorAndAdvance("#tour-settings-billing-tab"),
          },
        },
        {
          element: "#tour-settings-panel",
          popover: {
            title: "Tudo sobre sua assinatura",
            description:
              "Aqui você acompanha cobrança, status do plano e histórico sem precisar procurar.",
            side: "top",
          },
        },
        {
          element: "#tour-settings-security-tab",
          popover: {
            title: "Privacidade e senha",
            description:
              "Aqui ficam modo privacidade, senha e ações sensiveis da conta.",
            side: "bottom",
            onNextClick: clickSelectorAndAdvance("#tour-settings-security-tab"),
          },
        },
        {
          element: "#tour-settings-panel",
          popover: {
            title: "Área mais sensível da conta",
            description:
              "Use esta parte quando precisar proteger, revisar ou encerrar sua conta.",
            side: "top",
          },
        },
        {
          element: "#tour-settings-help-tab",
          popover: {
            title: "Ajuda e suporte",
            description:
              "Se surgir dúvidas, problema ou vontade de rever o guia, e aqui que você encontra isso.",
            side: "bottom",
            onNextClick: clickSelectorAndAdvance("#tour-settings-help-tab"),
          },
        },
        {
          element: "#tour-settings-panel",
          popover: {
            title: "Tudo bem centralizado",
            description:
              "Agora vamos para a tela de perfis, onde o usuario pode criar outro contexto financeiro sem misturar dados.",
            side: "top",
          },
        },
      ],
    },
    "account-profile": {
      nextRoute: "transactions-new",
      nextHref: "/transactions/new",
      steps: [
        {
          element: "#tour-account-profile-header",
          popover: {
            title: "Criar outro perfil",
            description:
              "Use esta tela para criar outro perfil financeiro, como Família ou Business/PJ.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-account-profile-options",
          popover: {
            title: "Escolha o tipo de perfil",
            description:
              "O tipo define presets e contexto, mas os dados financeiros permanecem isolados entre os perfis.",
            side: "bottom",
          },
        },
        {
          element: "#tour-account-profile-submit",
          popover: {
            title: "Ativar o novo perfil",
            description:
              "Depois de criar, ele passa a aparecer no seletor do topo para alternar como perfis independentes.",
            side: "top",
          },
        },
      ],
    },
    "transactions-new": {
      nextRoute: "reports",
      nextHref: "/reports",
      steps: [
        {
          element: "#tour-transactions-header",
          popover: {
            title: "Registrar um lançamento",
            description:
              "Esta tela serve para colocar sua vida financeira em ordem, uma entrada ou gasto por vez.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-transactions-type",
          popover: {
            title: "Escolha o tipo",
            description: "Primeiro diga se o dinheiro entrou ou saiu.",
            side: "bottom",
          },
        },
        {
          element: "#tour-transactions-amount",
          popover: {
            title: "Informe o valor",
            description:
              "Digite o valor com calma. O campo formata sozinho para reduzir erro de digitação.",
            side: "bottom",
          },
        },
        {
          element: "#tour-transactions-description",
          popover: {
            title: "Digite a descrição/título do lançamento",
            description:
              "Use este campo para lembrar depois do que se tratava este lançamento. Pode ser o nome de um estabelecimento, a descrição de um salário ou o que fizer mais sentido para você.",
            side: "bottom",
          },
        },
        {
          element: "#tour-transactions-category",
          popover: {
            title: "Escolha a categoria",
            description:
              "As categorias ajudam você a entender para onde o dinheiro está indo.",
            side: "bottom",
          },
        },
        {
          element: "#tour-transactions-category-manage",
          popover: {
            title: "Gerenciar categorias",
            description:
              "Este botao abre a organizacao de categorias do perfil atual, sem misturar com outros workspaces.",
            side: "bottom",
          },
        },
        {
          element: "#tour-transactions-category",
          popover: {
            title: "Categoria (Cartão de Crédito e Débito)",
            description:
              "É necessário cadastrar primeiro o cartão para que você consiga vincular o lançamento a ele. Depois disso, as categorias de cartão ficam disponíveis para organizar seus gastos por cartão ou tipo de gasto.",
            side: "bottom",
          },
        },
        {
          element: "#tour-transactions-advanced",
          popover: {
            title: "Mais opcoes do lancamento",
            description:
              "Abra este bloco quando precisar marcar um lancamento fixo ou uma compra parcelada.",
            side: "top",
            onNextClick: openSelectorAndAdvance("#tour-transactions-advanced", "#tour-transactions-recurring"),
          },
        },
        {
          element: "#tour-transactions-recurring",
          popover: {
            title: "Lançamento fixo",
            description:
              "Use para algo que vai se repetir nos próximos meses, como assinatura, aluguel ou mensalidade.",
            side: "top",
          },
        },
        {
          stepId: "installments",
          element: "#tour-transactions-installment",
          popover: {
            title: "Compra parcelada",
            description:
              "Use quando uma compra que foi dividida em várias parcelas. Não é a mesma coisa que algo recorrente (Assinatura).",
            side: "top",
          },
        },
        {
          element: "#tour-transactions-submit",
          popover: {
            title: "Salvar e continuar",
            description:
              "Depois de salvar, isso já aparece no extrato e impacta o seu mês. Agora vamos ver os relatórios.",
            side: "top",
          },
        },
      ],
    },
    reports: {
      nextRoute: "cards",
      nextHref: "/cards",
      steps: [
        {
          element: "#tour-reports-header",
          popover: {
            title: "Relatórios mensais",
            description:
              "Aqui você transforma seus lançamentos em uma leitura clara do mês.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-reports-summary-chart",
          popover: {
            title: "Resumo visual",
            description:
              "Compare receitas, despesas e saldo para entender rapidamente como o mês fechou.",
            side: "bottom",
          },
        },
        {
          element: "#tour-reports-categories-section",
          popover: {
            title: "Categorias",
            description:
              "Veja quais categorias mais pesaram no período antes de exportar o relatório.",
            side: "bottom",
          },
        },
        {
          element: "#tour-reports-export",
          popover: {
            title: "Exportar PDF ou Excel",
            description:
              "Use estes botões para gerar arquivos profissionais com resumo, gráficos e transações.",
            side: "bottom",
          },
        },
      ],
    },
    cards: {
      nextRoute: "piggy-bank",
      nextHref: "/piggy-bank",
      steps: [
        {
          element: "#tour-cards-header",
          popover: {
            title: "Seus cartões",
            description:
              "Aqui você acompanha limite, fatura e risco antes de passar do ponto.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-cards-add-button",
          popover: {
            title: "Adicionar cartão",
            description:
              "Cadastre seus cartões para centralizar gastos e não depender de memória.",
            side: "bottom",
          },
        },
        {
          stepId: "cardDetails",
          element: "#tour-cards-carousel",
          popover: {
            title: "Trocar de cartão",
            description:
              "Veja um cartão por vez para entender melhor limite, uso e histórico.",
            side: "bottom",
          },
        },
        {
          stepId: "cardDetails",
          element: "#tour-cards-limit-panel",
          popover: {
            title: "Saúde do limite",
            description:
              "Este painel mostra se o cartão está sob controle ou perto de apertar.",
            side: "top",
          },
        },
      ],
    },
    "piggy-bank": {
      nextRoute: null,
      nextHref: null,
      steps: [
        {
          element: "#tour-piggy-header",
          popover: {
            title: "Metas e reservas",
            description:
              "Use esta área para guardar dinheiro com objetivo claro, sem misturar com o gasto do dia a dia.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-piggy-create",
          popover: {
            title: "Criar uma meta",
            description:
              "Defina um objetivo, um valor e um prazo para acompanhar seu progresso.",
            side: "bottom",
          },
        },
        {
          element: "#tour-piggy-list",
          popover: {
            title: "Metas criadas",
            description:
              "Cada meta tem histórico, progresso e novos aportes para você acompanhar sem se perder.",
            side: "top",
          },
        },
        {
          element: "#tour-piggy-shortcuts",
          popover: {
            title: "Atalhos para comecar",
            description:
              "Se você ainda não sabe por onde comecar, use estas sugestões para criar sua primeira meta.",
            side: "left",
          },
        },
      ],
    },
  };
}
