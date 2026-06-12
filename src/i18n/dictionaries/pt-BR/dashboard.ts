export const dashboard = {
  metadata: {
    title: "Dashboard | WevenFinance",
    description: "Acompanhe saldo, lançamentos, previsões e próximos passos financeiros no WevenFinance.",
  },
  header: {
    title: "Visão Geral",
    description: "Gerencie seu fluxo de caixa e previsões.",
  },
  actions: {
    newTransaction: "Nova transação",
    reports: "Relatórios",
  },
  filters: {
    select: "Selecione",
  },
  dates: {
    in: "em",
    dayCount: "{count} dia(s)",
  },
  onboarding: {
    title: "Primeiros passos",
    description: "Complete o onboarding para liberar o melhor da plataforma.",
    progress: "Progresso",
    steps: {
      firstTransaction: "Primeira transação",
      firstCard: "Primeiro cartão",
      firstGoal: "Primeira meta",
      profileMenu: "Abrir menu da conta (foto no topo)",
    },
    close: "Fechar onboarding",
  },
  insights: {
    title: "Insights automáticos",
    description: "Resumo inteligente do mês selecionado.",
    biggestExpense: "Maior gasto do mês",
    noExpenses: "Sem despesas no período.",
    limitRisk: "Risco de estourar limite",
    noCardRisk: "Nenhum cartão em risco no momento.",
  },
  billingIssue: {
    title: "Seu plano está com pendência de pagamento",
    description: "Regularize a assinatura para manter recursos premium e evitar bloqueios de acesso.",
    primaryAction: "Regularizar agora",
    overdueCount: "Você também tem {count} lançamento(s) vencido(s).",
  },
  upgradePrompt: {
    nearFreeLimit: {
      title: "Você está perto do limite do plano grátis",
      description: "Você já usou {used}/{limit} lançamentos neste mês.",
    },
    actions: {
      upgrade: "Fazer upgrade",
      viewPlans: "Conhecer planos",
      viewPro: "Conhecer o Pro",
    },
    growingUsage: {
      title: "Seu uso financeiro está evoluindo",
      description: "Upgrade libera mais controle para cartões e crescimento sem limite mensal de lançamentos.",
    },
    proClarity: {
      title: "O próximo nível é clareza diária",
      description: "No Pro, o dashboard mostra quanto você ainda pode gastar hoje sem comprometer o fechamento do mês.",
    },
  },
  billing: {
    exempt: {
      title: "Conta isenta",
      description: "Administradores e moderadores não precisam de pagamento.",
    },
  },
  feedback: {
    checkoutError: {
      title: "Falha no checkout",
      message: "Não foi possível abrir o pagamento agora.",
    },
    subscriptionConfirmed: {
      title: "Assinatura confirmada",
      message: "Plano atualizado para {plan}.",
    },
    recoveryError: {
      title: "Falha na recuperação",
      message: "Não foi possível regularizar o pagamento agora.",
    },
  },
  states: {
    processing: "Processando...",
    opening: "Abrindo...",
    updating: "Atualizando...",
    notYet: "Ainda não",
  },
  summary: {
    currentBalance: {
      title: "Saldo atual (hoje)",
      description: "O que você tem hoje (realizado).",
      explanationLabel: "Explicação do saldo atual",
      tooltip: "Dinheiro que realmente entrou menos o que já saiu.",
    },
    monthMovement: {
      title: "Movimentação (mês)",
      income: "Receitas",
      expense: "Despesas",
      totalDescription: "Total de entradas e saídas do mês.",
      scheduledDescription: "Total de receitas e despesas agendadas para este mês.",
      explanationLabel: "Explicação da movimentação do mês",
    },
    forecast: {
      title: "Previsão de fechamento",
      description: "Estimativa para o fim do mês.",
      explanationLabel: "Explicação da previsão de fechamento",
    },
  },
  privacy: {
    showValues: "Mostrar valores",
    hideValues: "Ocultar valores",
  },
  alerts: {
    insufficientBalance: {
      title: "Saldo insuficiente",
      message: "Você possui {balance} em caixa, mas a conta é de {amount}. A operação foi cancelada.",
    },
  },
  dailyLimit: {
    title: "Limite diário inteligente",
    selectCurrentOrFuture: "Selecione o mês atual ou um mês futuro",
    positiveTitle: "Você pode gastar até {amount} hoje",
    negativeTitle: "Seu mês já está acima do ideal",
    zeroTitle: "Hoje você está no limite do mês",
    description: "Entenda antes se o mês vai fechar no verde.",
    currentMonthHint: "Esse cálculo funciona melhor com o mês em andamento para orientar sua decisão diária.",
    positiveDescription: "Com base na sua previsão atual, esse é o valor diário médio para fechar {month} com controle.",
    negativeDescription: "Para terminar {month} sem aperto, reduza cerca de {amount} por dia.",
    zeroDescription: "Para fechar {month} com segurança, o ideal é evitar novos gastos hoje.",
    cardImpact: "Inclui {amount} de impacto do cartão no mês.",
    remainingDays: "Restantes para distribuir sua folga prevista.",
  },
  premiumForecast: {
    availability: "Disponível no Premium e no Pro",
    lockedDescription: "No Premium, o dashboard mostra sua previsão de fechamento com base no saldo atual, contas a pagar e valores a receber.",
    unlockAction: "Liberar previsão",
  },
  monthlyFlow: {
    title: "Fluxo mensal",
    description: "Evolução do saldo ao longo do tempo.",
  },
  calculation: {
    base: {
      title: "Base do cálculo",
    },
    forecast: {
      description: "Cálculo: saldo atual + (a receber - a pagar) no mês.",
    },
  },
  statement: {
    title: "Extrato",
    description: "Lançamentos de {month}.",
    searchPlaceholder: "Buscar transação...",
    filters: {
      allTypes: "Todos",
      allCategories: "Todas as categorias",
      allStatuses: "Todos os status",
    },
    status: {
      paid: "Pago",
      pending: "Pendente",
    },
    category: "Categoria",
    card: "Cartão",
    installment: "Parcela {current}/{total}",
    monthlyRecurrence: "Recorrência mensal",
    empty: "Nenhum lançamento encontrado com estes filtros.",
    selectPageItems: "Selecionar itens desta página",
    selection: {
      selectedPrefix: "Você selecionou",
      selectedCount: "{count} selecionada(s)",
      itemCount: "lançamento(s).",
      clear: "Limpar seleção",
      deleteSelected: "Excluir selecionadas",
    },
  },
  transactionActions: {
    markDone: "Já paguei/recebi",
    receive: "Receber",
    pay: "Pagar",
    markIncomePending: "Não recebido",
    markExpensePending: "Não pago",
    edit: "Editar",
    endSubscription: "Encerrar assinatura",
    delete: "Excluir",
  },
  transactionFeedback: {
    received: {
      title: "Recebido!",
    },
    paid: {
      title: "Pago!",
    },
    receiptCanceled: {
      title: "Recebimento cancelado",
    },
    paymentCanceled: {
      title: "Pagamento cancelado",
    },
    confirmed: {
      message: "A transação \"{title}\" foi confirmada com sucesso.",
    },
    pending: {
      message: "A transação \"{title}\" voltou para pendente.",
    },
  },
  recurrence: {
    ended: {
      title: "Recorrência encerrada",
      message: "As próximas cobranças de \"{description}\" foram removidas.",
    },
    dialog: {
      title: "Encerrar recorrência",
      prefix: "Você vai encerrar a recorrência de",
      occurrencePrefix: "A ocorrência de",
      lastKeptSuffix: "será a última mantida.",
      description: "As cobranças futuras serão removidas e este lançamento ficará marcado como encerrado.",
      confirm: "Confirmar encerramento",
      ending: "Encerrando...",
    },
  },
  deleteDialog: {
    single: {
      title: "Excluir transação",
    },
    confirmTitle: "Confirmar exclusão",
    confirmQuestion: "Tem certeza que você vai apagar:",
    irreversible: "Essa ação não poderá ser desfeita.",
    includesGroups: "Alguns itens fazem parte de parcelamentos ou recorrências.",
    deleteGroupInstallments: "Excluir também todas as parcelas dos grupos",
    deleteOnlySelected: "Excluir apenas os itens selecionados",
    allInstallments: "Todas as parcelas",
    onlyThis: "Apenas esta",
    deleting: "Excluindo...",
  },
  common: {
    cancel: "Cancelar",
    back: "Voltar",
    understood: "Entendido",
  },
  pagination: {
    previous: "Anterior",
    next: "Próximo",
    pageStatus: "Página {current} de {total}",
  },
  checkin: {
    title: "Atualizar pendências",
    monthEnded: "Mês encerrado",
    youHave: "Você tem",
    dueTodaySuffix: "contas vencidas ou vencendo hoje. Vamos atualizar.",
    dueOn: "Venceu em",
  },
  limitReached: {
    title: "Limite atingido!",
    description: "Você atingiu o limite de {limit} lançamentos mensais do plano Grátis.",
    upgradePrefix: "Faça o upgrade para o",
    planName: "Plano Premium ou Pro",
    upgradeSuffix: "e remova esse limite para continuar organizando sua vida financeira.",
    viewPlans: "Ver planos",
    continueFree: "Continuar no Grátis",
  },
  installments: {
    lockedTitle: "Parcelamentos estão disponíveis apenas nos planos pagos.",
    lockedSuffix: "para lançar compras parceladas e acompanhar melhor o fechamento do mês.",
  },
} as const;
