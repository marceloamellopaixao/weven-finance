export const dashboard = {
  metadata: {
    title: "Panel | WevenFinance",
    description: "Acompaña saldos, movimientos, previsiones y próximos pasos financieros en WevenFinance.",
  },
  header: {
    title: "Vista general",
    description: "Gestiona tu flujo de caja y tus previsiones.",
  },
  actions: {
    newTransaction: "Nuevo movimiento",
    reports: "Informes",
  },
  filters: {
    select: "Seleccionar",
  },
  dates: {
    in: "en",
    dayCount: "{count} día(s)",
  },
  onboarding: {
    title: "Primeros pasos",
    description: "Completa la configuración inicial para aprovechar mejor la plataforma.",
    progress: "Progreso",
    steps: {
      firstTransaction: "Primer movimiento",
      firstCard: "Primera tarjeta",
      firstGoal: "Primera meta",
      profileMenu: "Abrir menú de la cuenta (foto en la parte superior)",
    },
    close: "Cerrar onboarding",
  },
  insights: {
    title: "Insights automáticos",
    description: "Resumen inteligente del mes seleccionado.",
    biggestExpense: "Mayor gasto del mes",
    noExpenses: "Sin gastos en este período.",
    limitRisk: "Riesgo de superar el límite",
    noCardRisk: "Ninguna tarjeta en riesgo por ahora.",
  },
  billingIssue: {
    title: "Tu plan tiene una pendiente de pago",
    description: "Regulariza la suscripción para mantener recursos premium y evitar restricciones de acceso.",
    primaryAction: "Regularizar ahora",
    overdueCount: "También tienes {count} movimiento(s) vencido(s).",
  },
  upgradePrompt: {
    nearFreeLimit: {
      title: "Estás cerca del límite del plan gratis",
      description: "Ya usaste {used}/{limit} movimientos este mes.",
    },
    actions: {
      upgrade: "Mejorar plan",
      viewPlans: "Ver planes",
      viewPro: "Ver Pro",
    },
    growingUsage: {
      title: "Tu uso financiero está creciendo",
      description: "Un upgrade libera más control para tarjetas y crecimiento sin límite mensual de movimientos.",
    },
    proClarity: {
      title: "El siguiente nivel es claridad diaria",
      description: "En Pro, el panel muestra cuánto todavía puedes gastar hoy sin comprometer el cierre del mes.",
    },
  },
  billing: {
    exempt: {
      title: "Cuenta exenta",
      description: "Administradores y moderadores no necesitan pago.",
    },
  },
  feedback: {
    checkoutError: {
      title: "Error en el checkout",
      message: "No fue posible abrir el pago ahora.",
    },
    subscriptionConfirmed: {
      title: "Suscripción confirmada",
      message: "Plan actualizado a {plan}.",
    },
    recoveryError: {
      title: "Error de recuperación",
      message: "No fue posible regularizar el pago ahora.",
    },
  },
  states: {
    processing: "Procesando...",
    opening: "Abriendo...",
    updating: "Actualizando...",
    notYet: "Todavía no",
  },
  summary: {
    currentBalance: {
      title: "Saldo actual (hoy)",
      description: "Lo que tienes hoy (realizado).",
      explanationLabel: "Explicación del saldo actual",
      tooltip: "Dinero que realmente entró menos lo que ya salió.",
    },
    monthMovement: {
      title: "Movimiento del mes",
      income: "Ingresos",
      expense: "Gastos",
      totalDescription: "Total de entradas y salidas del mes.",
      scheduledDescription: "Total de ingresos y gastos programados para este mes.",
      explanationLabel: "Explicación del movimiento del mes",
    },
    forecast: {
      title: "Previsión de cierre",
      description: "Estimación para el fin de mes.",
      explanationLabel: "Explicación de la previsión de cierre",
    },
  },
  privacy: {
    showValues: "Mostrar valores",
    hideValues: "Ocultar valores",
  },
  alerts: {
    insufficientBalance: {
      title: "Saldo insuficiente",
      message: "Tienes {balance} en caja, pero la cuenta es de {amount}. La operación fue cancelada.",
    },
  },
  dailyLimit: {
    title: "Límite diario inteligente",
    selectCurrentOrFuture: "Selecciona el mes actual o un mes futuro",
    positiveTitle: "Puedes gastar hasta {amount} hoy",
    negativeTitle: "Tu mes ya está por encima de lo ideal",
    zeroTitle: "Hoy estás en el límite del mes",
    description: "Entiende antes si el mes cerrará en positivo.",
    currentMonthHint: "Este cálculo funciona mejor con el mes en curso para orientar tu decisión diaria.",
    positiveDescription: "Con base en tu previsión actual, este es el valor diario promedio para cerrar {month} con control.",
    negativeDescription: "Para terminar {month} sin presión, reduce cerca de {amount} por día.",
    zeroDescription: "Para cerrar {month} con seguridad, lo ideal es evitar nuevos gastos hoy.",
    cardImpact: "Incluye {amount} de impacto de tarjeta en el mes.",
    remainingDays: "Días restantes para distribuir tu margen previsto.",
  },
  premiumForecast: {
    availability: "Disponible en Premium y Pro",
    lockedDescription: "En Premium, el panel muestra tu previsión de cierre con base en el saldo actual, cuentas por pagar y valores por recibir.",
    unlockAction: "Liberar previsión",
  },
  monthlyFlow: {
    title: "Flujo mensual",
    description: "Evolución del saldo a lo largo del tiempo.",
  },
  calculation: {
    base: {
      title: "Base del cálculo",
    },
    forecast: {
      description: "Cálculo: saldo actual + (por recibir - por pagar) en el mes.",
    },
  },
  statement: {
    title: "Extracto",
    description: "Movimientos de {month}.",
    searchPlaceholder: "Buscar movimiento...",
    filters: {
      allTypes: "Todos",
      allCategories: "Todas las categorías",
      allStatuses: "Todos los estados",
    },
    status: {
      paid: "Pagado",
      pending: "Pendiente",
    },
    category: "Categoría",
    card: "Tarjeta",
    installment: "Cuota {current}/{total}",
    monthlyRecurrence: "Recurrencia mensual",
    empty: "No se encontraron movimientos con estos filtros.",
    selectPageItems: "Seleccionar elementos de esta página",
    selection: {
      selectedPrefix: "Seleccionaste",
      selectedCount: "{count} seleccionado(s)",
      itemCount: "movimiento(s).",
      clear: "Limpiar selección",
      deleteSelected: "Eliminar seleccionados",
    },
  },
  transactionActions: {
    markDone: "Ya pagué/recibí",
    receive: "Recibir",
    pay: "Pagar",
    markIncomePending: "No recibido",
    markExpensePending: "No pagado",
    edit: "Editar",
    endSubscription: "Finalizar suscripción",
    delete: "Eliminar",
  },
  transactionFeedback: {
    received: {
      title: "¡Recibido!",
    },
    paid: {
      title: "¡Pagado!",
    },
    receiptCanceled: {
      title: "Recepción cancelada",
    },
    paymentCanceled: {
      title: "Pago cancelado",
    },
    confirmed: {
      message: "El movimiento \"{title}\" fue confirmado correctamente.",
    },
    pending: {
      message: "El movimiento \"{title}\" volvió a pendiente.",
    },
  },
  recurrence: {
    ended: {
      title: "Recurrencia finalizada",
      message: "Los próximos cobros de \"{description}\" fueron eliminados.",
    },
    dialog: {
      title: "Finalizar recurrencia",
      prefix: "Vas a finalizar la recurrencia de",
      occurrencePrefix: "La ocurrencia de",
      lastKeptSuffix: "será la última mantenida.",
      description: "Los cobros futuros serán eliminados y este movimiento quedará marcado como finalizado.",
      confirm: "Confirmar finalización",
      ending: "Finalizando...",
    },
  },
  deleteDialog: {
    single: {
      title: "Eliminar movimiento",
    },
    confirmTitle: "Confirmar eliminación",
    confirmQuestion: "¿Seguro que quieres eliminar:",
    irreversible: "Esta acción no se puede deshacer.",
    includesGroups: "Algunos elementos forman parte de cuotas o recurrencias.",
    deleteGroupInstallments: "Eliminar también todas las cuotas de los grupos",
    deleteOnlySelected: "Eliminar solo los elementos seleccionados",
    allInstallments: "Todas las cuotas",
    onlyThis: "Solo esta",
    deleting: "Eliminando...",
  },
  common: {
    cancel: "Cancelar",
    back: "Volver",
    understood: "Entendido",
  },
  pagination: {
    previous: "Anterior",
    next: "Siguiente",
    pageStatus: "Página {current} de {total}",
  },
  checkin: {
    title: "Actualizar pendientes",
    monthEnded: "Mes cerrado",
    youHave: "Tienes",
    dueTodaySuffix: "cuentas vencidas o que vencen hoy. Vamos a actualizarlas.",
    dueOn: "Venció el",
  },
  limitReached: {
    title: "¡Límite alcanzado!",
    description: "Alcanzaste el límite de {limit} movimientos mensuales del plan Gratis.",
    upgradePrefix: "Haz upgrade al",
    planName: "Plan Premium o Pro",
    upgradeSuffix: "y elimina este límite para seguir organizando tu vida financiera.",
    viewPlans: "Ver planes",
    continueFree: "Continuar en Gratis",
  },
  installments: {
    lockedTitle: "Las cuotas están disponibles solo en los planes pagos.",
    lockedSuffix: "para registrar compras en cuotas y acompañar mejor el cierre del mes.",
  },
} as const;
