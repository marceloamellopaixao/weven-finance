import type { Dictionary } from "@/i18n/dictionaries/pt-BR";

export const accountProfile: Dictionary["accountProfile"] = {
  metadata: {
    title: "WevenFinance | Perfil de la cuenta",
    description: "Elija el perfil de uso para preparar categorías, informes y accesos iniciales en WevenFinance.",
  },
  badge: "¡Seleccione su perfil de uso para comenzar!",
  title: "¿Cómo quiere organizar WevenFinance?",
  description: "Prepararemos categorías, informes y accesos rápidos según la forma en que administra su dinero día a día.",
  greeting: "Hola, {name}. Elija una opción para continuar.",
  selected: "Seleccionado",
  choose: "Elegir",
  notice: "Podrá crear otros perfiles más adelante. Este se usará como predeterminado para informes mensuales y categorías iniciales.",
  preparing: "Preparando...",
  createError: "No fue posible crear el perfil de la cuenta",
  options: {
    personal: {
      title: "Perfil personal",
      description: "Controle ingresos, gastos, tarjetas, metas, deudas y el límite diario inteligente.",
    },
    professional: {
      title: "Business/PJ",
      description: "Use este perfil para negocio, autónomo, iglesia, tienda, prestación de servicio o proyecto profesional.",
    },
    church: {
      title: "Business/PJ",
      description: "Iglesias, ministerios y proyectos profesionales entran en el perfil Business/PJ.",
    },
    family: {
      title: "Perfil familia / hogar",
      description: "Controle cuentas compartidas, supermercado, alquiler, escuela, transporte y metas familiares.",
    },
    business: {
      title: "Business/PJ",
      description: "Controle ingresos, gastos, impuestos, proveedores, flujo de caja e informes del negocio.",
    },
  },
} as const;
