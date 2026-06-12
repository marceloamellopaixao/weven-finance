export const dashboard = {
  metadata: {
    title: "Dashboard | WevenFinance",
    description: "Track balances, transactions, forecasts, and next financial steps in WevenFinance.",
  },
  header: {
    title: "Overview",
    description: "Manage your cash flow and forecasts.",
  },
  actions: {
    newTransaction: "New transaction",
    reports: "Reports",
  },
  filters: {
    select: "Select",
  },
  dates: {
    in: "at",
    dayCount: "{count} day(s)",
  },
  onboarding: {
    title: "First steps",
    description: "Complete onboarding to unlock the best of the platform.",
    progress: "Progress",
    steps: {
      firstTransaction: "First transaction",
      firstCard: "First card",
      firstGoal: "First goal",
      profileMenu: "Open account menu (profile photo at the top)",
    },
    close: "Close onboarding",
  },
  insights: {
    title: "Automatic insights",
    description: "Smart summary for the selected month.",
    biggestExpense: "Biggest expense this month",
    noExpenses: "No expenses in this period.",
    limitRisk: "Limit overrun risk",
    noCardRisk: "No card at risk right now.",
  },
  billingIssue: {
    title: "Your plan has a payment issue",
    description: "Regularize your subscription to keep premium features and avoid access restrictions.",
    primaryAction: "Fix payment now",
    overdueCount: "You also have {count} overdue transaction(s).",
  },
  upgradePrompt: {
    nearFreeLimit: {
      title: "You are close to the free plan limit",
      description: "You have already used {used}/{limit} transactions this month.",
    },
    actions: {
      upgrade: "Upgrade",
      viewPlans: "View plans",
      viewPro: "View Pro",
    },
    growingUsage: {
      title: "Your financial usage is growing",
      description: "Upgrade for more control over cards and unlimited monthly transactions.",
    },
    proClarity: {
      title: "The next level is daily clarity",
      description: "With Pro, the dashboard shows how much you can still spend today without hurting month-end results.",
    },
  },
  billing: {
    exempt: {
      title: "Exempt account",
      description: "Admins and moderators do not need payment.",
    },
  },
  feedback: {
    checkoutError: {
      title: "Checkout failed",
      message: "We could not open payment right now.",
    },
    subscriptionConfirmed: {
      title: "Subscription confirmed",
      message: "Plan updated to {plan}.",
    },
    recoveryError: {
      title: "Recovery failed",
      message: "We could not regularize payment right now.",
    },
  },
  states: {
    processing: "Processing...",
    opening: "Opening...",
    updating: "Updating...",
    notYet: "Not yet",
  },
  summary: {
    currentBalance: {
      title: "Current balance (today)",
      description: "What you have today (actual).",
      explanationLabel: "Current balance explanation",
      tooltip: "Money that actually came in minus what has already gone out.",
    },
    monthMovement: {
      title: "Monthly movement",
      income: "Income",
      expense: "Expenses",
      totalDescription: "Total money in and out this month.",
      scheduledDescription: "Total income and expenses scheduled for this month.",
      explanationLabel: "Monthly movement explanation",
    },
    forecast: {
      title: "Closing forecast",
      description: "Estimate for the end of the month.",
      explanationLabel: "Closing forecast explanation",
    },
  },
  privacy: {
    showValues: "Show values",
    hideValues: "Hide values",
  },
  alerts: {
    insufficientBalance: {
      title: "Insufficient balance",
      message: "You have {balance} in cash, but the bill is {amount}. The operation was canceled.",
    },
  },
  dailyLimit: {
    title: "Smart daily limit",
    selectCurrentOrFuture: "Select the current month or a future month",
    positiveTitle: "You can spend up to {amount} today",
    negativeTitle: "Your month is already above the ideal range",
    zeroTitle: "Today you are at the monthly limit",
    description: "Know ahead of time whether the month will close in the green.",
    currentMonthHint: "This calculation works best while the month is in progress to guide your daily decision.",
    positiveDescription: "Based on your current forecast, this is the average daily amount to close {month} under control.",
    negativeDescription: "To finish {month} without pressure, reduce about {amount} per day.",
    zeroDescription: "To close {month} safely, it is best to avoid new expenses today.",
    cardImpact: "Includes {amount} of card impact this month.",
    remainingDays: "Remaining days to distribute your expected surplus.",
  },
  premiumForecast: {
    availability: "Available on Premium and Pro",
    lockedDescription: "On Premium, the dashboard shows your closing forecast based on current balance, bills to pay, and amounts to receive.",
    unlockAction: "Unlock forecast",
  },
  monthlyFlow: {
    title: "Monthly flow",
    description: "Balance evolution over time.",
  },
  calculation: {
    base: {
      title: "Calculation base",
    },
    forecast: {
      description: "Calculation: current balance + (receivables - payables) for the month.",
    },
  },
  statement: {
    title: "Statement",
    description: "Transactions for {month}.",
    searchPlaceholder: "Search transaction...",
    filters: {
      allTypes: "All",
      allCategories: "All categories",
      allStatuses: "All statuses",
    },
    status: {
      paid: "Paid",
      pending: "Pending",
    },
    category: "Category",
    card: "Card",
    installment: "Installment {current}/{total}",
    monthlyRecurrence: "Monthly recurrence",
    empty: "No transactions found with these filters.",
    selectPageItems: "Select items on this page",
    selection: {
      selectedPrefix: "You selected",
      selectedCount: "{count} selected",
      itemCount: "transaction(s).",
      clear: "Clear selection",
      deleteSelected: "Delete selected",
    },
  },
  transactionActions: {
    markDone: "I already paid/received",
    receive: "Receive",
    pay: "Pay",
    markIncomePending: "Not received",
    markExpensePending: "Not paid",
    edit: "Edit",
    endSubscription: "End subscription",
    delete: "Delete",
  },
  transactionFeedback: {
    received: {
      title: "Received!",
    },
    paid: {
      title: "Paid!",
    },
    receiptCanceled: {
      title: "Receipt canceled",
    },
    paymentCanceled: {
      title: "Payment canceled",
    },
    confirmed: {
      message: "Transaction \"{title}\" was confirmed successfully.",
    },
    pending: {
      message: "Transaction \"{title}\" is pending again.",
    },
  },
  recurrence: {
    ended: {
      title: "Recurrence ended",
      message: "Future charges for \"{description}\" were removed.",
    },
    dialog: {
      title: "End recurrence",
      prefix: "You are about to end the recurrence for",
      occurrencePrefix: "The occurrence on",
      lastKeptSuffix: "will be the last one kept.",
      description: "Future charges will be removed and this transaction will be marked as ended.",
      confirm: "Confirm ending",
      ending: "Ending...",
    },
  },
  deleteDialog: {
    single: {
      title: "Delete transaction",
    },
    confirmTitle: "Confirm deletion",
    confirmQuestion: "Are you sure you want to delete:",
    irreversible: "This action cannot be undone.",
    includesGroups: "Some items are part of installments or recurrences.",
    deleteGroupInstallments: "Also delete all installments in the groups",
    deleteOnlySelected: "Delete only selected items",
    allInstallments: "All installments",
    onlyThis: "Only this one",
    deleting: "Deleting...",
  },
  common: {
    cancel: "Cancel",
    back: "Back",
    understood: "Got it",
  },
  pagination: {
    previous: "Previous",
    next: "Next",
    pageStatus: "Page {current} of {total}",
  },
  checkin: {
    title: "Update pending items",
    monthEnded: "Month ended",
    youHave: "You have",
    dueTodaySuffix: "bills overdue or due today. Let us update them.",
    dueOn: "Due on",
  },
  limitReached: {
    title: "Limit reached!",
    description: "You reached the limit of {limit} monthly transactions on the Free plan.",
    upgradePrefix: "Upgrade to the",
    planName: "Premium or Pro plan",
    upgradeSuffix: "and remove this limit to keep organizing your financial life.",
    viewPlans: "View plans",
    continueFree: "Continue on Free",
  },
  installments: {
    lockedTitle: "Installments are available only on paid plans.",
    lockedSuffix: "to record installment purchases and better track month-end results.",
  },
} as const;
