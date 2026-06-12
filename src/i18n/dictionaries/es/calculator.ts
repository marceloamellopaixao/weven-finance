import type { Dictionary } from "@/i18n/dictionaries/pt-BR";

export const calculator: Dictionary["calculator"] = {
  dailyLimit: {
    fields: {
      balance: "Saldo actual",
      income: "Ingresos aún previstos",
      bills: "Cuentas y gastos fijos",
      card: "Estado de tarjeta previsto ({currency})",
      reserve: "Valor que quiere guardar",
    },
    resultLabel: "Resultado estimado",
    resultDescription: "Este es el valor promedio que podría gastar por día hasta el fin de mes, considerando los datos informados.",
    projectedBalance: "Previsión de cierre",
    saveCta: "Guardar en WevenFinance",
  },
} as const;
