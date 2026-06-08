export const accountProfile = {
  badge: "¡Selecciona tu perfil de uso para comenzar!",
  title: "¿Cómo quieres organizar WevenFinance?",
  description: "Prepararemos categorías, reportes y accesos rápidos según la forma en que administras tu dinero día a día.",
  greeting: "Hola, {name}. Elige una opción para continuar.",
  selected: "Seleccionado",
  choose: "Elegir",
  notice: "Podrás crear otros perfiles más adelante. Este se usará como predeterminado para reportes mensuales y categorías iniciales.",
  preparing: "Preparando...",
  createError: "No fue posible crear el perfil de la cuenta",
  options: {
    personal: {
      title: "Perfil personal",
      description: "Controla ingresos, gastos, tarjetas, metas, deudas y el límite diario inteligente.",
    },
    professional: {
      title: "Perfil profesional / autónomo",
      description: "Controla ingresos de clientes, gastos de trabajo, impuestos, caja mensual y reportes.",
    },
    church: {
      title: "Perfil iglesia / ministerio",
      description: "Controla diezmos, ofrendas, misiones, cafetería, departamentos, eventos y gastos por área.",
    },
    family: {
      title: "Perfil familia / hogar",
      description: "Controla cuentas compartidas, supermercado, alquiler, escuela, transporte y metas familiares.",
    },
    business: {
      title: "Perfil pequeño negocio",
      description: "Controla ventas, costos, cuentas por pagar y cobrar, flujo de caja y beneficio estimado.",
    },
  },
} as const;
