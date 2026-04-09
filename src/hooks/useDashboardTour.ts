import { useCallback, useEffect, useRef } from "react";
import { driver } from "driver.js";

type UseDashboardTourOptions = {
  disabled?: boolean;
  hasSeen?: boolean;
  onComplete?: () => void | Promise<void>;
};

export function useDashboardTour(options: UseDashboardTourOptions = {}) {
  const { disabled = false, hasSeen = false, onComplete } = options;
  const driverObj = useRef<ReturnType<typeof driver> | null>(null);
  const onCompleteRef = useRef<typeof onComplete>(onComplete);
  const hasDrivenRef = useRef(false);
  const isQueuedRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const linkId = "driver-js-css";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/driver.js@1.0.1/dist/driver.css";
      document.head.appendChild(link);
    }

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

        .driver-popover.driverjs-theme .driver-popover-title {
          font-size: 18px;
          font-weight: 700;
          color: #7c3aed;
          margin-bottom: 8px;
        }

        .driver-popover.driverjs-theme .driver-popover-description {
          font-size: 14px;
          line-height: 1.5;
          color: #52525b;
          margin-bottom: 16px;
        }

        .driver-popover.driverjs-theme button {
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.2s;
          border: none;
          cursor: pointer;
        }

        .driver-popover.driverjs-theme .driver-popover-next-btn {
          background-color: #7c3aed !important;
          color: #ffffff !important;
          text-shadow: none;
        }

        .driver-popover.driverjs-theme .driver-popover-next-btn:hover {
          background-color: #6d28d9 !important;
        }

        .driver-popover.driverjs-theme .driver-popover-prev-btn {
          background-color: #f4f4f5 !important;
          color: #52525b !important;
        }

        .driver-popover.driverjs-theme .driver-popover-close-btn {
          color: #a1a1aa;
        }

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

    driverObj.current = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      popoverClass: "driverjs-theme",
      doneBtnText: "Concluir",
      nextBtnText: "Próximo",
      prevBtnText: "Anterior",
      progressText: "{{current}} de {{total}}",
      steps: [
        {
          element: "#tour-welcome-header",
          popover: {
            title: "Bem-vindo ao WevenFinance",
            description: "Este é o seu painel de controle. Aqui você acompanha sua visão financeira de forma clara e prática.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-new-transaction",
          popover: {
            title: "Adicione lançamentos",
            description: "Use este botão para registrar gastos e receitas, com parcelamentos e recorrências quando precisar.",
            side: "bottom",
          },
        },
        {
          element: "#tour-month-select",
          popover: {
            title: "Navegação por mês",
            description: "Alterne entre os meses para revisar o passado e planejar os próximos passos.",
            side: "bottom",
          },
        },
        {
          element: "#tour-balance-card",
          popover: {
            title: "Saldo atual",
            description: "Mostra quanto você realmente tem hoje, considerando apenas o que já foi pago ou recebido.",
            side: "bottom",
          },
        },
        {
          element: "#tour-movement-card",
          popover: {
            title: "Movimentação do mês",
            description: "Veja rapidamente tudo que entra e sai neste mês, inclusive valores ainda pendentes.",
            side: "bottom",
          },
        },
        {
          element: "#tour-forecast-card",
          popover: {
            title: "Previsão de fechamento",
            description: "O sistema estima como o mês deve terminar se os lançamentos pendentes forem concluídos.",
            side: "bottom",
          },
        },
        {
          element: "#tour-transactions-table",
          popover: {
            title: "Extrato detalhado",
            description: "Aqui você filtra, revisa e gerencia cada lançamento do mês.",
            side: "top",
          },
        },
        {
          element: "#tour-privacy-toggle",
          popover: {
            title: "Modo privacidade",
            description: "Ative para ocultar valores quando estiver em público.",
            side: "left",
          },
        },
      ],
      onDestroyed: () => {
        const shouldMarkAsSeen = hasDrivenRef.current;
        hasDrivenRef.current = false;
        isQueuedRef.current = false;
        if (shouldMarkAsSeen) {
          void onCompleteRef.current?.();
        }
      },
    });

    return () => {
      hasDrivenRef.current = false;
      isQueuedRef.current = false;
      driverObj.current?.destroy();
      driverObj.current = null;
    };
  }, []);

  const startTour = useCallback((force = false) => {
    if (isQueuedRef.current) return;
    isQueuedRef.current = true;
    window.setTimeout(() => {
      if (disabled) {
        isQueuedRef.current = false;
        return;
      }
      if (force || !hasSeen) {
        hasDrivenRef.current = true;
        driverObj.current?.drive();
        return;
      }
      isQueuedRef.current = false;
    }, 1000);
  }, [disabled, hasSeen]);

  return { startTour };
}
