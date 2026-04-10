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
              "Aqui voce entende como o mes esta andando e qual deve ser seu proximo passo.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-new-transaction",
          popover: {
            title: "Registrar dinheiro que entrou ou saiu",
            description:
              "Este botao e o atalho principal do app. E por aqui que voce comeca a organizar seu mes.",
            side: "bottom",
          },
        },
        {
          element: "#tour-month-select",
          popover: {
            title: "Escolha o mes",
            description:
              "Troque de mes para revisar o passado, acompanhar agora ou planejar o que vem pela frente.",
            side: "bottom",
          },
        },
        {
          element: "#tour-balance-card",
          popover: {
            title: "Quanto voce tem hoje",
            description:
              "Este valor mostra o que ja entrou e saiu de verdade ate agora.",
            side: "bottom",
          },
        },
        {
          element: "#tour-movement-card",
          popover: {
            title: "Entradas e saidas do mes",
            description:
              "Aqui voce compara o que entrou com o que saiu para saber se o mes esta equilibrado.",
            side: "bottom",
          },
        },
        {
          stepId: "monthlyForecast",
          element: "#tour-forecast-card",
          popover: {
            title: "Como o mes deve terminar",
            description:
              "Se os itens pendentes forem pagos ou recebidos, este e o resultado mais provavel para o fechamento.",
            side: "bottom",
          },
        },
        {
          stepId: "smartDailyLimit",
          element: "#tour-smart-daily-limit",
          popover: {
            title: "Quanto voce pode gastar hoje",
            description:
              "Este limite diario transforma sua previsao do mes em uma decisao simples para o dia a dia.",
            side: "bottom",
          },
        },
        {
          element: "#tour-transactions-table",
          popover: {
            title: "Seu extrato",
            description:
              "Aqui voce encontra cada lancamento, aplica filtros e resolve pendencias sem se perder.",
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
              "Na sua foto ficam os acessos para as areas principais do app. Vamos continuar por la.",
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
              "Aqui ficam seus dados, plano, privacidade, ajuda e acoes importantes da conta.",
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
            title: "Conteudo da aba",
            description:
              "Esta area muda conforme a aba escolhida, sem tirar voce da mesma tela.",
            side: "top",
          },
        },
        {
          element: "#tour-settings-billing-tab",
          popover: {
            title: "Plano e assinatura",
            description:
              "Abra esta aba para ver seu plano, pagamentos e opcoes de upgrade.",
            side: "bottom",
            onNextClick: clickSelectorAndAdvance("#tour-settings-billing-tab"),
          },
        },
        {
          element: "#tour-settings-panel",
          popover: {
            title: "Tudo sobre sua assinatura",
            description:
              "Aqui voce acompanha cobranca, status do plano e historico sem precisar procurar.",
            side: "top",
          },
        },
        {
          element: "#tour-settings-security-tab",
          popover: {
            title: "Privacidade e senha",
            description:
              "Aqui ficam modo privacidade, senha e acoes sensiveis da conta.",
            side: "bottom",
            onNextClick: clickSelectorAndAdvance("#tour-settings-security-tab"),
          },
        },
        {
          element: "#tour-settings-panel",
          popover: {
            title: "Area mais sensivel da conta",
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
              "Se surgir duvida, problema ou vontade de rever o guia, e aqui que voce encontra isso.",
            side: "bottom",
            onNextClick: clickSelectorAndAdvance("#tour-settings-help-tab"),
          },
        },
        {
          element: "#tour-settings-panel",
          popover: {
            title: "Tudo bem centralizado",
            description:
              "Agora vamos para a tela de novo lancamento, onde o app vira valor pratico no mesmo instante.",
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
            title: "Registrar um lancamento",
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
              "Digite o valor com calma. O campo formata sozinho para reduzir erro de digitacao.",
            side: "bottom",
          },
        },
        {
          element: "#tour-transactions-category",
          popover: {
            title: "Escolha a categoria",
            description:
              "As categorias ajudam voce a entender para onde o dinheiro esta indo.",
            side: "bottom",
          },
        },
        {
          element: "#tour-transactions-recurring",
          popover: {
            title: "Lancamento fixo",
            description:
              "Use para algo que vai se repetir nos proximos meses, como assinatura, aluguel ou mensalidade.",
            side: "top",
          },
        },
        {
          stepId: "installments",
          element: "#tour-transactions-installment",
          popover: {
            title: "Compra parcelada",
            description:
              "Use quando uma compra foi dividida em varias parcelas. Nao e a mesma coisa que algo recorrente.",
            side: "top",
          },
        },
        {
          element: "#tour-transactions-submit",
          popover: {
            title: "Salvar e continuar",
            description:
              "Depois de salvar, isso ja aparece no extrato e impacta o seu mes. Agora vamos ver os cartoes.",
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
            title: "Seus cartoes",
            description:
              "Aqui voce acompanha limite, fatura e risco antes de passar do ponto.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-cards-add-button",
          popover: {
            title: "Adicionar cartao",
            description:
              "Cadastre seus cartoes para centralizar gastos e nao depender de memoria.",
            side: "bottom",
          },
        },
        {
          element: "#tour-cards-carousel",
          popover: {
            title: "Trocar de cartao",
            description:
              "Veja um cartao por vez para entender melhor limite, uso e historico.",
            side: "bottom",
          },
        },
        {
          element: "#tour-cards-limit-panel",
          popover: {
            title: "Saude do limite",
            description:
              "Este painel mostra se o cartao esta sob controle ou perto de apertar.",
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
              "Use esta area para guardar dinheiro com objetivo claro, sem misturar com o gasto do dia a dia.",
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
              "Cada meta tem historico, progresso e novos aportes para voce acompanhar sem se perder.",
            side: "top",
          },
        },
        {
          element: "#tour-piggy-shortcuts",
          popover: {
            title: "Atalhos para comecar",
            description:
              "Se voce ainda nao sabe por onde comecar, use estas sugestoes para criar sua primeira meta.",
            side: "left",
          },
        },
      ],
    },
  };
}
