import type { Dictionary } from "@/i18n/dictionaries/pt-BR";

export const seo: Dictionary["seo"] = {
  default: {
    metadata: {
      title: "WevenFinance | Finanzas personales con claridad",
      description: "Sepa cuánto puede gastar hoy sin comprometer el fin de mes. Organice gastos, tarjetas, cuotas, metas e informes mensuales en un panel simple.",
    },
  },
  pages: {
    home: {
      metadata: {
        title: "WevenFinance | Finanzas personales con claridad",
        description: "Sepa cuánto puede gastar hoy sin comprometer el fin de mes. Organice gastos, tarjetas, cuotas, metas e informes mensuales en un panel simple.",
      },
    },
    dailySpend: {
      metadata: {
        title: "¿Cuánto puedo gastar hoy sin comprometer el mes?",
        description: "Entienda cuánto puede gastar hoy considerando saldo, cuentas, tarjeta y lo que aún vence en el mes.",
      },
      eyebrow: "¿Cuánto puedo gastar hoy?",
      title: "Sepa cuánto puede gastar hoy sin comprometer el fin de mes",
      description: "Deje de mirar solo el saldo. WevenFinance considera cuentas, tarjeta, cuotas y metas para orientar su decisión diaria.",
      keyword: "cuánto puedo gastar hoy",
      benefits: [
        "Límite diario estimado",
        "Previsión hasta el fin de mes",
        "Alertas para frenar antes de quedar ajustado",
      ],
      sections: [
        {
          title: "El saldo no es dinero libre",
          text: "Si todavía hay facturas, tarjeta y suscripciones por vencer, el saldo por sí solo engaña. El límite diario resuelve eso.",
        },
        {
          title: "Una respuesta para comprar mejor",
          text: "Antes de gastar, vea si ese valor todavía cabe en su mes o si va a reducir demasiado su margen diario.",
        },
      ],
    },
  },
} as const;
