import type { Dictionary } from "@/i18n/dictionaries/pt-BR";

export const seo: Dictionary["seo"] = {
  default: {
    metadata: {
      title: "WevenFinance | Personal finance with clarity",
      description: "Know how much you can spend today without compromising the end of the month. Organize expenses, cards, installments, goals, and monthly reports in one simple dashboard.",
    },
  },
  pages: {
    home: {
      metadata: {
        title: "WevenFinance | Personal finance with clarity",
        description: "Know how much you can spend today without compromising the end of the month. Organize expenses, cards, installments, goals, and monthly reports in one simple dashboard.",
      },
    },
    dailySpend: {
      metadata: {
        title: "How much can I spend today without hurting my month?",
        description: "Understand how much you can spend today based on your balance, bills, card expenses, and what is still due this month.",
      },
      eyebrow: "How much can I spend today?",
      title: "Know how much you can spend today without hurting the end of the month",
      description: "Stop looking only at your balance. WevenFinance considers bills, cards, installments, and goals to guide your daily decision.",
      keyword: "how much can I spend today",
      benefits: [
        "Estimated daily spending limit",
        "Forecast through the end of the month",
        "Alerts to slow down before things get tight",
      ],
      sections: [
        {
          title: "Your balance is not free money",
          text: "If bills, card payments, and subscriptions are still due, your balance alone can mislead you. The daily limit solves that.",
        },
        {
          title: "A better answer before you buy",
          text: "Before spending, see whether that amount still fits your month or will reduce your daily room too much.",
        },
      ],
    },
  },
} as const;
