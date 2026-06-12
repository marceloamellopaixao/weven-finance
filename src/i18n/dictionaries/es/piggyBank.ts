import type { Dictionary } from "../pt-BR";

export const piggyBank: Dictionary["piggyBank"] = {
  metadata: {
    title: "Metas y reservas | WevenFinance",
    description: "Acompaña metas, reservas y ahorros en un panel financiero organizado.",
  },
  title: "Metas y reservas",
  description: "Acompaña objetivos, reservas y ahorros de tarjeta en un solo lugar.",
  loading: "Cargando metas y reservas...",
  actions: {
    createGoal: "Crear meta",
    backToCards: "Volver a tarjetas",
  },
  feedback: {
    loadError: "No fue posible cargar tus metas.",
  },
  onboarding: {
    firstGoal: "Paso actual: crea tu primera meta y confirma un aporte para completar este paso.",
  },
  activeGoals: {
    title: "Tus metas activas",
    description: "Abre un objetivo para ver total ahorrado, historial y ajustes.",
    totalSaved: "Total ahorrado: {amount}",
  },
  empty: {
    title: "Aún no hay metas creadas.",
    description: "Usa el botón \"Crear meta\" para comenzar tu primera reserva.",
  },
  shortcuts: {
    title: "Atajos",
    description: "Comienza más rápido usando un tipo de meta sugerido.",
  },
  goals: {
    cardLimit: {
      label: "Ahorro para tarjeta",
      description: "Aumentar el límite de la tarjeta con una reserva dedicada.",
    },
    emergencyReserve: {
      label: "Reserva de emergencia",
      description: "Cubrir imprevistos con más seguridad.",
    },
    travel: {
      label: "Hacer un viaje",
      description: "Ahorrar para transporte, alojamiento y paseos.",
    },
    homeRenovation: {
      label: "Reformar la casa",
      description: "Separar dinero para materiales y mano de obra.",
    },
    dreamPurchase: {
      label: "Compra soñada",
      description: "Llegar al objetivo sin desordenar el presupuesto.",
    },
    custom: {
      label: "Crear nuevo objetivo",
      description: "Define tu propia meta de la forma que tenga sentido.",
    },
  },
  new: {
    metadata: {
      title: "Crear meta | WevenFinance",
      description: "Crea una meta financiera, informa el primer aporte y acompaña tu reserva.",
    },
    title: "Crear meta",
    description: "Define el objetivo, informa el valor y confirma el primer aporte.",
    loading: "Cargando nueva meta...",
    stepLabel: "Paso",
    stepTitle: "Paso {step} de 3",
    actions: {
      backToGoals: "Volver a metas",
      back: "Volver",
      continue: "Continuar",
      saving: "Guardando...",
      confirmAndSave: "Confirmar y guardar",
    },
    feedback: {
      loadError: "No fue posible cargar los datos del ahorro.",
      saveError: "No fue posible guardar el valor en el ahorro.",
    },
    steps: {
      goal: {
        label: "Objetivo",
        description: "Elige qué tipo de objetivo quieres crear.",
      },
      amount: {
        label: "Valor y origen",
        description: "Informa el valor, origen y detalles de esta reserva.",
      },
      review: {
        label: "Revisión final",
        description: "Revisa todo antes de confirmar el aporte inicial.",
      },
    },
    form: {
      goalQuestion: "¿Cuál es el objetivo de esta reserva?",
      customNameLabel: "Nombre del nuevo objetivo",
      customNamePlaceholder: "Ej: Cambiar de notebook",
      amountLabel: "¿Cuánto quieres guardar?",
      availableBalance: "Saldo disponible",
      withdrawalModeLabel: "Modalidad de retiro (opcional)",
      withdrawalModePlaceholder: "Ej: Retiro libre en cualquier momento",
      yieldTypeLabel: "Tipo de rendimiento (opcional)",
      yieldTypePlaceholder: "Ej: depósito, tesoro, reserva simple",
      sourceTypeLabel: "Origen del valor",
      cardLabel: "Tarjeta para aumento de límite",
      cardPlaceholder: "Selecciona una tarjeta",
      noCardsWarning: "Registra al menos una tarjeta en /cards para usar el ahorro de tarjeta.",
    },
    source: {
      bank: "Saldo en banco",
      cash: "Dinero en efectivo",
    },
    validation: {
      amountExceedsBalance: "El valor informado supera tu saldo disponible.",
    },
    review: {
      title: "Revisión final",
      goal: "Objetivo",
      amount: "Valor",
      source: "Origen",
      withdrawal: "Retiro",
      yield: "Rendimiento",
      appliedTo: "Aplicado en",
    },
    confirmation: {
      title: "Qué sucede al confirmar",
      description: "El valor entra en el historial de la meta, actualiza el total guardado y genera el reflejo en el extracto de la cuenta.",
    },
  },
  detail: {
    metadata: {
      title: "Detalles de la meta | WevenFinance",
      description: "Acompaña total guardado, historial, ajustes y datos de una meta financiera.",
    },
    description: "Seguimiento del total guardado y del historial de esta meta.",
    unavailable: {
      title: "Meta no disponible",
    },
    errors: {
      load: "No fue posible cargar la meta.",
      notFound: "Esta meta ya no existe o fue eliminada.",
    },
    actions: {
      back: "Volver",
      adjust: "Agregar o retirar valor",
      edit: "Editar meta",
      delete: "Eliminar",
      cancel: "Cancelar",
      saving: "Guardando...",
      deleting: "Eliminando...",
    },
    summary: {
      title: "Total guardado",
      description: "Resumen actual de esta meta.",
    },
    fields: {
      withdrawal: "Retiro",
      yield: "Rendimiento",
      notProvided: "No informado",
    },
    history: {
      title: "Historial",
      count: "{count} movimiento(s) registrado(s).",
      empty: "Aún no hay movimientos en esta meta.",
      source: "Origen: {source}",
      withdrawal: "Retiro: {value}",
      yield: "Rendimiento: {value}",
      appliedToCardLimit: "Aplicado al límite de la tarjeta",
      card: "Tarjeta: {card}",
    },
    source: {
      bank: "Saldo en banco",
      cash: "Dinero en efectivo",
    },
    adjust: {
      title: "Ajustar saldo de la meta",
      description: "Agrega más valor o retira parte del total guardado.",
      typeLabel: "Tipo de ajuste",
      deposit: "Agregar valor",
      withdraw: "Retirar valor",
      amountLabel: "Valor",
      availableToWithdraw: "Saldo disponible para retiro: {amount}",
      sourceLabel: "Origen o destino",
      confirm: "Confirmar ajuste",
    },
    edit: {
      title: "Editar meta",
      description: "Actualiza el nombre y la información complementaria de esta reserva.",
      nameLabel: "Nombre",
      withdrawalModeLabel: "Modalidad de retiro",
      yieldTypeLabel: "Tipo de rendimiento",
      save: "Guardar cambios",
    },
    delete: {
      title: "Eliminar meta",
      description: "Esta acción elimina la meta, su historial y deshace vínculos aplicados, como aumento de límite en tarjeta.",
      confirm: "Eliminar meta",
    },
  },
};
