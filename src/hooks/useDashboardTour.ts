import { useCallback, useEffect, useRef } from "react";
import { driver } from "driver.js";

export function useDashboardTour() {
  const driverObj = useRef<ReturnType<typeof driver> | null>(null);

  useEffect(() => {
    // 1. Injeção do CSS Base
    const linkId = "driver-js-css";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/driver.js@1.0.1/dist/driver.css";
      document.head.appendChild(link);
    }

    // 2. Injeção de CSS Customizado (Tema WevenFinance)
    const styleId = "driver-js-theme-weven";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
        .driver-popover.driverjs-theme {
          background-color: #ffffff;
          color: #18181b;
          border-radius: 16px;
          border: 1px solid #e4e4e7;
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
          padding: 16px;
          font-family: var(--font-sans), system-ui, sans-serif;
        }
        
        /* Título */
        .driver-popover.driverjs-theme .driver-popover-title {
          font-size: 18px;
          font-weight: 700;
          color: #7c3aed; /* Violet 600 */
          margin-bottom: 8px;
        }

        /* Descrição */
        .driver-popover.driverjs-theme .driver-popover-description {
          font-size: 14px;
          line-height: 1.5;
          color: #52525b; /* Zinc 600 */
          margin-bottom: 16px;
        }

        /* Botões */
        .driver-popover.driverjs-theme button {
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.2s;
          border: none;
          cursor: pointer;
        }

        /* Botão Próximo/Concluir */
        .driver-popover.driverjs-theme .driver-popover-next-btn {
          background-color: #7c3aed !important; /* Violet 600 */
          color: #ffffff !important;
          text-shadow: none;
        }
        .driver-popover.driverjs-theme .driver-popover-next-btn:hover {
          background-color: #6d28d9 !important; /* Violet 700 */
        }

        /* Botão Anterior */
        .driver-popover.driverjs-theme .driver-popover-prev-btn {
          background-color: #f4f4f5 !important; /* Zinc 100 */
          color: #52525b !important;
        }

        /* Botão Fechar */
        .driver-popover.driverjs-theme .driver-popover-close-btn {
          color: #a1a1aa;
        }
        
        /* Dark Mode Support (se o body tiver class dark) */
        .dark .driver-popover.driverjs-theme {
          background-color: #18181b;
          border-color: #27272a;
          color: #f4f4f5;
        }
        .dark .driver-popover.driverjs-theme .driver-popover-description {
          color: #a1a1aa;
        }
      `;
      document.head.appendChild(style);
    }

    // Configuração do Driver
    driverObj.current = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      popoverClass: 'driverjs-theme', // Classe para aplicar o tema acima
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
            description: "O sistema calcula como seu mês deve terminar se todas as contas pendentes forem pagas.",
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
        localStorage.setItem("weven_onboarding_completed", "true");
      },
    });
  }, []);

  const startTour = useCallback((force = false) => {
    const hasSeen = localStorage.getItem("weven_onboarding_completed");
    
    setTimeout(() => {
      if (force || !hasSeen) {
        driverObj.current?.drive();
      }
    }, 1000);
  }, []);

  return { startTour };
}
