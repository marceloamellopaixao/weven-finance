import type { Dictionary } from "@/i18n/dictionaries/pt-BR";

export const seo: Dictionary["seo"] = {
  default: {
    metadata: {
      title: "WevenFinance | Personal finance with clarity",
      description: "Know how much you can spend today without compromising the end of the month. Organize expenses, cards, installments, goals, and monthly reports in one simple dashboard.",
      keywords: [
        "personal finance tracking",
        "financial organization",
        "personal finances",
        "card control",
        "installments",
        "monthly financial reports",
        "how much can I spend today",
        "smart daily spending limit",
        "financial goals",
        "WevenFinance",
      ],
    },
  },
  landingPage: {
    primaryCta: "Start free",
    secondaryCta: "Calculate how much I can spend",
    finalTitle: "Turn {keyword} into a daily decision.",
    finalDescription: "WevenFinance organizes what comes in, what goes out, and what is due to answer what matters: how much you can spend today without squeezing the end of the month.",
    finalCta: "Save my control in WevenFinance",
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
    creditCardOrganization: {
      metadata: {
        title: "How to organize credit cards and installments",
        description: "Track limits, statements, due dates, and installment purchases without treating credit as income.",
      },
      eyebrow: "Credit cards",
      title: "Organize your credit card before the statement becomes a surprise",
      description: "Track purchases, installments, and statement due dates so you can decide how much you can still spend.",
      keyword: "organize credit cards",
      benefits: [
        "Clear statement and due dates",
        "Installments inside your forecast",
        "Credit treated as a commitment, not income",
      ],
      sections: [
        {
          title: "A card does not increase your salary",
          text: "WevenFinance shows the impact of your statement on the month to avoid the false feeling of available money.",
        },
        {
          title: "Installments are part of the forecast",
          text: "Installment purchases stop being a surprise when they appear in your monthly calculation and daily spending limit.",
        },
      ],
    },
    financialControl: {
      metadata: {
        title: "Financial control to avoid end-of-month pressure",
        description: "Organize expenses, cards, and due dates without spreadsheets, and know how much you can spend today.",
      },
      eyebrow: "Financial control",
      title: "Financial control for people who want clarity without relying on spreadsheets",
      description: "Record what matters, track due dates, and understand whether your month is still financially safe.",
      keyword: "financial control",
      benefits: [
        "Organization without complicated spreadsheets",
        "Expenses and due dates in one place",
        "Clear answers for everyday decisions",
      ],
      sections: [
        {
          title: "For anyone who feels money disappears",
          text: "The goal is not to become a finance expert. It is to see income, expenses, and commitments before the month gets tight.",
        },
        {
          title: "From tracking to decision-making",
          text: "Each entry helps calculate your forecast and daily limit, turning data into simple guidance.",
        },
      ],
    },
    debtFreeApp: {
      metadata: {
        title: "An app to get out of debt with financial control",
        description: "Organize expenses, due dates, and goals to stop getting lost and regain financial predictability.",
      },
      eyebrow: "Getting out of debt",
      title: "An app to get out of debt with daily clarity",
      description: "See what is still due, reduce spending before pressure builds, and track goals to regain financial control.",
      keyword: "app to get out of debt",
      benefits: [
        "Visible due dates",
        "Daily limit to slow spending",
        "Goals to rebuild your reserve",
      ],
      sections: [
        {
          title: "Start with what is due",
          text: "Before trying to change everything, see the bills, statements, and recurring charges that will still consume your balance.",
        },
        {
          title: "Small daily decisions",
          text: "Getting out of debt depends on knowing when to spend and when to stop. The daily limit makes that decision concrete.",
        },
      ],
    },
    dailySpendCalculator: {
      metadata: {
        title: "Calculator: how much can I spend today?",
        description: "Calculate for free how much you can spend today without hurting the end of the month.",
      },
      eyebrow: "Free calculator",
      title: "How much can I spend today without hurting the end of the month?",
      description: "Enter your balance, expected bills, card spending, and desired reserve. The result is a simple estimate to guide today's decision.",
    },
  },
} as const;
