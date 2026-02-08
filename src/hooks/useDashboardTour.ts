import { useEffect, useRef } from "react";
import { driver } from "driver.js";
// @ts-expect-error - driver.js não tem tipos oficiais, então ignoramos os erros de tipo aqui
import "driver.js/dist/driver.css";

export function useDashboardTour() {
  // Usamos ref para garantir que o driver não seja recriado desnecessariamente
  const driverObj = useRef<ReturnType<typeof driver> | null>(null);

  useEffect(() => {
    // Configuração do Driver
    driverObj.current = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      doneBtnText: "Concluir",
      nextBtnText: "Próximo",
      prevBtnText: "Anterior",
      progressText: "{{current}} de {{total}}",
      steps: [
        {
          element: "#tour-welcome-header",
          popover: {
            title: "Bem-vindo ao WevenFinance! 🚀",
            description: "Este é o seu painel de controle. Aqui você terá uma visão geral completa da sua saúde financeira.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-new-transaction",
          popover: {
            title: "Adicione Lançamentos",
            description: "Clique aqui para registrar novos gastos ou receitas. Você pode criar parcelamentos e recorrências facilmente.",
            side: "bottom",
          },
        },
        {
          element: "#tour-month-select",
          popover: {
            title: "Navegação Temporal",
            description: "Alterne entre os meses para ver históricos passados ou planejar o futuro financeiro.",
            side: "bottom",
          },
        },
        {
          element: "#tour-balance-card",
          popover: {
            title: "Seu Saldo Real",
            description: "Aqui mostramos quanto você tem hoje, considerando apenas o que já foi pago ou recebido.",
            side: "bottom",
          },
        },
        {
          element: "#tour-movement-card",
          popover: {
            title: "Fluxo do Mês",
            description: "Um resumo rápido de tudo que entra e sai neste mês (incluindo pendentes).",
            side: "bottom",
          },
        },
        {
          element: "#tour-forecast-card",
          popover: {
            title: "Previsão Inteligente",
            description: "O sistema calcula como seu mês deve terminar se todas as transações pendentes forem concluídas.",
            side: "bottom",
          },
        },
        {
          element: "#tour-transactions-table",
          popover: {
            title: "Extrato Detalhado",
            description: "Gerencie cada transação aqui. Use os filtros acima para encontrar itens específicos ou clique nos '...' para editar/excluir.",
            side: "top",
          },
        },
        {
          element: "#tour-privacy-toggle",
          popover: {
            title: "Modo Privacidade",
            description: "Está em público? Clique no olho para borrar os valores e proteger seus dados.",
            side: "left",
          },
        },
      ],
      onDestroyed: () => {
        // Marca como visto quando o tour é fechado ou concluído
        localStorage.setItem("weven_onboarding_completed", "true");
      },
    });
  }, []);

  const startTour = (force = false) => {
    const hasSeen = localStorage.getItem("weven_onboarding_completed");
    
    // Pequeno delay para garantir que a UI foi renderizada
    setTimeout(() => {
      if (force || !hasSeen) {
        driverObj.current?.drive();
      }
    }, 1000);
  };

  return { startTour };
}