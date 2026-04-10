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
  "transactions-new": "/transactions/new?tour=1",
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
      nextRoute: "transactions-new",
      nextHref: "/transactions/new",
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
              "Agora vamos para a tela de novo lançamento, onde o app vira valor prático no mesmo instante.",
            side: "top",
          },
        },
      ],
    },
    "transactions-new": {
      nextRoute: "cards",
      nextHref: "/cards",
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
              "As categorias ajudam você a entender para onde o dinheiro esta indo.",
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
              "Depois de salvar, isso já aparece no extrato e impacta o seu mês. Agora vamos ver os cartões.",
            side: "top",
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
          element: "#tour-cards-carousel",
          popover: {
            title: "Trocar de cartão",
            description:
              "Veja um cartão por vez para entender melhor limite, uso e histórico.",
            side: "bottom",
          },
        },
        {
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
