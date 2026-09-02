export const piggyBank = {
  metadata: {
    title: "Metas e reservas | WevenFinance",
    description: "Acompanhe objetivos, reservas e cofrinhos em um painel financeiro organizado.",
  },
  title: "Metas e reservas",
  description: "Acompanhe objetivos, reservas e cofrinhos do cartão em um só lugar.",
  loading: "Carregando metas e reservas...",
  actions: {
    createGoal: "Criar meta",
    backToCards: "Voltar para cartões",
  },
  feedback: {
    loadError: "Não foi possível carregar suas metas.",
  },
  onboarding: {
    firstGoal: "Etapa atual: crie sua primeira meta e confirme um aporte para concluir esta etapa.",
  },
  activeGoals: {
    title: "Suas metas ativas",
    description: "Abra um objetivo para ver total guardado, histórico e ajustes.",
    totalSaved: "Total guardado: {amount}",
  },
  empty: {
    title: "Nenhuma meta criada ainda.",
    description: "Use o botão \"Criar meta\" para começar sua primeira reserva.",
  },
  shortcuts: {
    title: "Atalhos",
    description: "Comece mais rápido usando um tipo de meta já sugerido.",
  },
  goals: {
    cardLimit: {
      label: "Cofrinho do cartão",
      description: "Aumentar limite do cartão com reserva dedicada.",
    },
    emergencyReserve: {
      label: "Reserva de emergência",
      description: "Cobrir imprevistos com mais segurança.",
    },
    travel: {
      label: "Fazer uma viagem",
      description: "Guardar para transporte, hospedagem e passeios.",
    },
    homeRenovation: {
      label: "Reformar a casa",
      description: "Separar valor para materiais e mão de obra.",
    },
    dreamPurchase: {
      label: "Sonho de consumo",
      description: "Chegar no objetivo sem bagunçar o orçamento.",
    },
    custom: {
      label: "Criar novo objetivo",
      description: "Defina sua própria meta do jeito que fizer sentido.",
    },
  },
  new: {
    metadata: {
      title: "Criar meta | WevenFinance",
      description: "Crie uma meta financeira, informe o primeiro aporte e acompanhe sua reserva.",
    },
    title: "Criar meta",
    description: "Defina o objetivo, informe o valor e confirme o primeiro aporte.",
    loading: "Carregando nova meta...",
    stepLabel: "Etapa",
    stepTitle: "Etapa {step} de 3",
    actions: {
      backToGoals: "Voltar para metas",
      back: "Voltar",
      continue: "Continuar",
      saving: "Guardando...",
      confirmAndSave: "Confirmar e guardar",
    },
    feedback: {
      loadError: "Não foi possível carregar os dados do cofrinho.",
      saveError: "Falha ao guardar valor no cofrinho.",
    },
    steps: {
      goal: {
        label: "Objetivo",
        description: "Escolha que tipo de objetivo você quer criar.",
      },
      amount: {
        label: "Valor e origem",
        description: "Informe valor, origem e detalhes dessa reserva.",
      },
      review: {
        label: "Revisão final",
        description: "Revise tudo antes de confirmar o aporte inicial.",
      },
    },
    form: {
      goalQuestion: "Qual é o objetivo desta reserva?",
      customNameLabel: "Nome do novo objetivo",
      customNamePlaceholder: "Ex: Trocar de notebook",
      amountLabel: "Quanto você quer guardar?",
      availableBalance: "Saldo disponível",
      withdrawalModeLabel: "Modalidade de retirada (opcional)",
      withdrawalModePlaceholder: "Ex: Resgate livre a qualquer momento",
      yieldTypeLabel: "Tipo de rendimento (opcional)",
      yieldTypePlaceholder: "Ex: CDB, Tesouro, reserva simples",
      sourceTypeLabel: "Origem do valor",
      cardLabel: "Cartão para aumento de limite",
      cardPlaceholder: "Selecione um cartão",
      noCardsWarning: "Cadastre ao menos um cartão em /cards para usar o cofrinho do cartão.",
    },
    source: {
      bank: "Saldo em banco",
      cash: "Dinheiro vivo",
    },
    validation: {
      amountExceedsBalance: "O valor informado excede seu saldo disponível.",
    },
    review: {
      title: "Revisão final",
      goal: "Objetivo",
      amount: "Valor",
      source: "Origem",
      withdrawal: "Retirada",
      yield: "Rendimento",
      appliedTo: "Aplicado em",
    },
    confirmation: {
      title: "O que acontece ao confirmar",
      description: "O valor entra no histórico da meta, atualiza o total guardado e gera o reflexo no extrato da conta.",
    },
  },
  detail: {
    metadata: {
      title: "Detalhes da meta | WevenFinance",
      description: "Acompanhe total guardado, histórico, ajustes e dados de uma meta financeira.",
    },
    description: "Acompanhamento do total guardado e do histórico desta meta.",
    unavailable: {
      title: "Meta indisponível",
    },
    errors: {
      load: "Não foi possível carregar a meta.",
      notFound: "Essa meta não existe mais ou foi removida.",
    },
    actions: {
      back: "Voltar",
      adjust: "Adicionar ou retirar valor",
      edit: "Editar meta",
      delete: "Excluir",
      cancel: "Cancelar",
      saving: "Salvando...",
      deleting: "Excluindo...",
    },
    summary: {
      title: "Total guardado",
      description: "Resumo atual desta meta.",
    },
    fields: {
      withdrawal: "Retirada",
      yield: "Rendimento",
      notProvided: "Não informado",
    },
    history: {
      title: "Histórico",
      count: "{count} movimentação(ões) registrada(s).",
      empty: "Ainda não há movimentações nesta meta.",
      source: "Origem: {source}",
      withdrawal: "Retirada: {value}",
      yield: "Rendimento: {value}",
      appliedToCardLimit: "Aplicado no limite do cartão",
      card: "Cartão: {card}",
      pageSummary: "Página {page} de {totalPages} • {total} movimentação(ões)",
      previous: "Anterior",
      next: "Próxima",
    },
    source: {
      bank: "Saldo em banco",
      cash: "Dinheiro vivo",
    },
    adjust: {
      title: "Ajustar saldo da meta",
      description: "Adicione mais valor ou retire parte do total guardado.",
      typeLabel: "Tipo de ajuste",
      deposit: "Adicionar valor",
      withdraw: "Retirar valor",
      amountLabel: "Valor",
      availableToWithdraw: "Saldo disponível para retirada: {amount}",
      sourceLabel: "Origem ou destino",
      confirm: "Confirmar ajuste",
    },
    edit: {
      title: "Editar meta",
      description: "Atualize o nome e as informações complementares desta reserva.",
      nameLabel: "Nome",
      withdrawalModeLabel: "Modalidade de retirada",
      yieldTypeLabel: "Tipo de rendimento",
      save: "Salvar alterações",
    },
    delete: {
      title: "Excluir meta",
      description: "Essa ação remove a meta, o histórico dela e desfaz vínculos aplicados, como aumento de limite em cartão.",
      confirm: "Excluir meta",
    },
  },
} as const;
