import type { Dictionary } from "@/i18n/dictionaries/pt-BR";

export const calculator: Dictionary["calculator"] = {
  dailyLimit: {
    fields: {
      balance: "Current balance",
      income: "Expected income",
      bills: "Bills and fixed expenses",
      card: "Expected card statement ({currency})",
      reserve: "Amount you want to save",
    },
    resultLabel: "Estimated result",
    resultDescription: "This is the average amount you could spend per day until the end of the month, based on the information provided.",
    projectedBalance: "Projected ending balance",
    saveCta: "Save in WevenFinance",
  },
} as const;
