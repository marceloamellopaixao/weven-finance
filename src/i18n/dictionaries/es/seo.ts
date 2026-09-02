import type { Dictionary } from "@/i18n/dictionaries/pt-BR";

export const seo: Dictionary["seo"] = {
  default: {
    metadata: {
      title: "WevenFinance | Finanzas personales con claridad",
      description: "Sepa cuánto puede gastar hoy sin comprometer el fin de mes. Organice gastos, tarjetas, cuotas, metas e informes mensuales en un panel simple.",
      keywords: [
        "control financiero personal",
        "organización financiera",
        "finanzas personales",
        "control de tarjetas",
        "cuotas",
        "informes financieros mensuales",
        "cuánto puedo gastar hoy",
        "límite diario inteligente",
        "metas financieras",
        "WevenFinance",
      ],
    },
  },
  landingPage: {
    primaryCta: "Empezar gratis",
    secondaryCta: "Calcular cuánto puedo gastar",
    finalTitle: "Convierte {keyword} en una decisión diaria.",
    finalDescription: "WevenFinance organiza lo que entra, lo que sale y lo que vence para responder lo que importa: cuánto puedes gastar hoy sin apretar el fin de mes.",
    finalCta: "Guardar mi control en WevenFinance",
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
    creditCardOrganization: {
      metadata: {
        title: "Cómo organizar tarjeta de crédito y cuotas",
        description: "Controle límite, estado de cuenta, vencimientos y compras en cuotas sin confundir crédito con ingresos.",
      },
      eyebrow: "Tarjeta de crédito",
      title: "Organice la tarjeta de crédito antes de que el estado de cuenta sorprenda",
      description: "Acompañe compras, cuotas y vencimiento para decidir mejor cuánto todavía puede gastar.",
      keyword: "organizar tarjeta de crédito",
      benefits: [
        "Estado de cuenta y vencimiento claros",
        "Cuotas dentro de la previsión",
        "Crédito tratado como compromiso, no como ingreso",
      ],
      sections: [
        {
          title: "La tarjeta no aumenta el salario",
          text: "WevenFinance muestra el impacto del estado de cuenta en el mes para evitar la falsa sensación de dinero disponible.",
        },
        {
          title: "Las cuotas entran en la previsión",
          text: "Las compras en cuotas dejan de ser sorpresa cuando aparecen en el cálculo del mes y del límite diario.",
        },
      ],
    },
    financialControl: {
      metadata: {
        title: "Control financiero para no quedar ajustado",
        description: "Organice gastos, tarjetas y vencimientos sin hojas de cálculo, y sepa cuánto puede gastar hoy.",
      },
      eyebrow: "Control financiero",
      title: "Control financiero para quien quiere claridad sin depender de hojas de cálculo",
      description: "Registre lo esencial, acompañe vencimientos y entienda si el dinero del mes todavía está seguro.",
      keyword: "control financiero",
      benefits: [
        "Organización sin hojas de cálculo complicadas",
        "Gastos y vencimientos en un solo lugar",
        "Respuestas claras para el día a día",
      ],
      sections: [
        {
          title: "Para quien siente que el dinero desaparece",
          text: "El objetivo no es volverse especialista en finanzas. Es ver ingresos, gastos y compromisos antes de que el mes apriete.",
        },
        {
          title: "Del registro a la decisión",
          text: "Cada movimiento ayuda a calcular la previsión y el límite diario, transformando datos en una orientación simple.",
        },
      ],
    },
    debtFreeApp: {
      metadata: {
        title: "App para salir de deudas con control financiero",
        description: "Organice gastos, vencimientos y metas para dejar de perderse y recuperar previsibilidad financiera.",
      },
      eyebrow: "Salir de deudas",
      title: "Una app para salir de deudas con claridad diaria",
      description: "Vea lo que aún vence, reduzca gastos antes de quedar ajustado y acompañe metas para recuperar control financiero.",
      keyword: "app para salir de deudas",
      benefits: [
        "Vencimientos visibles",
        "Límite diario para frenar gastos",
        "Metas para reconstruir una reserva",
      ],
      sections: [
        {
          title: "Empiece por lo que vence",
          text: "Antes de intentar cambiar todo, vea cuentas, estados de cuenta y recurrencias que todavía van a consumir su saldo.",
        },
        {
          title: "Pequeñas decisiones diarias",
          text: "Salir de deudas depende de saber cuándo gastar y cuándo frenar. El límite diario vuelve esa decisión más concreta.",
        },
      ],
    },
    dailySpendCalculator: {
      metadata: {
        title: "Calculadora: ¿cuánto puedo gastar hoy?",
        description: "Calcule gratis cuánto puede gastar hoy sin comprometer el fin de mes.",
      },
      eyebrow: "Calculadora gratuita",
      title: "¿Cuánto puedo gastar hoy sin comprometer el fin de mes?",
      description: "Informe su saldo, cuentas previstas, tarjeta y reserva deseada. El resultado es una estimación simple para orientar la decisión de hoy.",
    },
  },
} as const;
