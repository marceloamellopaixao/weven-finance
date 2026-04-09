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

export function getPlatformTourConfig(setAccountMenuOpen: (value: boolean) => void): Record<PlatformTourRouteKey, PlatformTourRouteConfig> {
  return {
    dashboard: {
      nextRoute: "settings",
      nextHref: "/settings?tab=account",
      steps: [
        {
          element: "#tour-welcome-header",
          popover: {
            title: "Seu painel principal",
            description: "Aqui você acompanha o mês, entende o saldo atual e enxerga com clareza o que está acontecendo.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-new-transaction",
          popover: {
            title: "Registrar receitas e gastos",
            description: "Este é o atalho mais importante do app. Use para lançar entradas, despesas, recorrências e parcelamentos.",
            side: "bottom",
          },
        },
        {
          element: "#tour-month-select",
          popover: {
            title: "Troca de mês",
            description: "Revise meses anteriores, veja o mês atual e planeje o próximo sem sair do painel.",
            side: "bottom",
          },
        },
        {
          element: "#tour-balance-card",
          popover: {
            title: "Saldo do momento",
            description: "Mostra o que você realmente tem hoje, considerando o que já foi pago ou recebido.",
            side: "bottom",
          },
        },
        {
          element: "#tour-movement-card",
          popover: {
            title: "Movimentação do mês",
            description: "Veja rapidamente quanto entrou e quanto saiu no período para entender se o mês está saudável.",
            side: "bottom",
          },
        },
        {
          stepId: "monthlyForecast",
          element: "#tour-forecast-card",
          popover: {
            title: "Previsão de fechamento",
            description: "Aqui você entende como o mês deve terminar se os lançamentos pendentes forem concluídos.",
            side: "bottom",
          },
        },
        {
          element: "#tour-transactions-table",
          popover: {
            title: "Extrato detalhado",
            description: "Filtre, revise e resolva cada lançamento sem perder o contexto do mês.",
            side: "top",
          },
        },
        {
          element: "#tour-account-avatar",
          onHighlightStarted: () => setAccountMenuOpen(true),
          onDeselected: () => setAccountMenuOpen(false),
          popover: {
            title: "Troca de telas",
            description: "Na sua foto ficam os acessos para dashboard, cartões, metas, atalhos e configurações. Vamos continuar por lá.",
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
            title: "Centro da sua conta",
            description: "Configurações reúne seus dados, assinatura, privacidade, ajuda e ações importantes da conta.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-settings-account-tab",
          popover: {
            title: "Aba Geral",
            description: "Aqui você mantém nome, telefone e acessos principais da sua conta.",
            side: "bottom",
          },
        },
        {
          element: "#tour-settings-panel",
          popover: {
            title: "Conteúdo da aba",
            description: "A área central muda conforme a aba escolhida, sem te tirar da mesma tela.",
            side: "top",
          },
        },
        {
          element: "#tour-settings-billing-tab",
          popover: {
            title: "Planos e assinatura",
            description: "Nesta aba você vê seu plano, histórico e upgrades. Vou abrir para você agora.",
            side: "bottom",
            onNextClick: clickSelectorAndAdvance("#tour-settings-billing-tab"),
          },
        },
        {
          element: "#tour-settings-panel",
          popover: {
            title: "Controle de assinatura",
            description: "Tudo relacionado ao plano fica concentrado aqui para o usuário não se perder.",
            side: "top",
          },
        },
        {
          element: "#tour-settings-security-tab",
          popover: {
            title: "Privacidade e segurança",
            description: "Aqui ficam modo privacidade, senha e ações sensíveis. Vamos abrir essa área.",
            side: "bottom",
            onNextClick: clickSelectorAndAdvance("#tour-settings-security-tab"),
          },
        },
        {
          element: "#tour-settings-panel",
          popover: {
            title: "Área sensível da conta",
            description: "Essa seção concentra o que exige mais cuidado, como senha, privacidade e exclusão da conta.",
            side: "top",
          },
        },
        {
          element: "#tour-settings-help-tab",
          popover: {
            title: "Ajuda e suporte",
            description: "Quando o usuário precisar de apoio ou quiser revisar o tour, é aqui que ele encontra isso.",
            side: "bottom",
            onNextClick: clickSelectorAndAdvance("#tour-settings-help-tab"),
          },
        },
        {
          element: "#tour-settings-panel",
          popover: {
            title: "Ajuda centralizada",
            description: "Agora vamos para a tela de novo lançamento, porque é ali que o usuário transforma o app em valor real.",
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
            title: "Novo lançamento",
            description: "Esta é a tela em que o usuário registra a vida financeira do mês com clareza.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-transactions-type",
          popover: {
            title: "Entrada ou saída",
            description: "Primeiro o usuário define se está registrando uma receita ou uma despesa.",
            side: "bottom",
          },
        },
        {
          element: "#tour-transactions-amount",
          popover: {
            title: "Valor",
            description: "O campo aceita valores grandes e formata automaticamente para reduzir erro de digitação.",
            side: "bottom",
          },
        },
        {
          element: "#tour-transactions-category",
          popover: {
            title: "Categoria",
            description: "A categoria organiza o histórico e melhora a leitura do dashboard.",
            side: "bottom",
          },
        },
        {
          element: "#tour-transactions-recurring",
          popover: {
            title: "Lançamento fixo",
            description: "Use para assinaturas, mensalidades ou qualquer cobrança que se repete nos próximos meses.",
            side: "top",
          },
        },
        {
          stepId: "installments",
          element: "#tour-transactions-installment",
          popover: {
            title: "Compra parcelada",
            description: "Parcelamento e recorrência são coisas diferentes. Aqui o usuário divide uma compra específica.",
            side: "top",
          },
        },
        {
          element: "#tour-transactions-submit",
          popover: {
            title: "Salvar lançamento",
            description: "Depois de registrar, o impacto já aparece no extrato e no fechamento do mês. Agora vamos ver os cartões.",
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
            title: "Cartões e limites",
            description: "Aqui o usuário acompanha cartões de crédito e débito, limite usado e risco de estourar a fatura.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-cards-add-button",
          popover: {
            title: "Adicionar cartão",
            description: "Cadastre novos cartões para centralizar faturas e gastos sem depender de memória.",
            side: "bottom",
          },
        },
        {
          element: "#tour-cards-carousel",
          popover: {
            title: "Seleção de cartão",
            description: "O usuário alterna entre os cartões para ver limite, pendências e histórico específico.",
            side: "bottom",
          },
        },
        {
          element: "#tour-cards-limit-panel",
          popover: {
            title: "Saúde do cartão",
            description: "Este painel mostra uso do limite e ajuda o usuário a entender risco antes da próxima compra.",
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
            description: "O porquinho transforma intenção em objetivo concreto e melhora retenção por progresso.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-piggy-create",
          popover: {
            title: "Criar meta",
            description: "Quando o usuário cria uma meta, o dinheiro deixa de ser só número e vira direção.",
            side: "bottom",
          },
        },
        {
          element: "#tour-piggy-list",
          popover: {
            title: "Metas já criadas",
            description: "Cada item leva para uma página própria com histórico, progresso e novos aportes.",
            side: "top",
          },
        },
        {
          element: "#tour-piggy-shortcuts",
          popover: {
            title: "Sugestões rápidas",
            description: "Esses atalhos ajudam quem está começando a criar metas sem travar em decisão demais.",
            side: "left",
          },
        },
      ],
    },
  };
}
