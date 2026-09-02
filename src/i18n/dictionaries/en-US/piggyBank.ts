import type { Dictionary } from "../pt-BR";

export const piggyBank: Dictionary["piggyBank"] = {
  metadata: {
    title: "Goals and reserves | WevenFinance",
    description: "Track goals, reserves, and piggy banks in an organized financial dashboard.",
  },
  title: "Goals and reserves",
  description: "Track goals, reserves, and card piggy banks in one place.",
  loading: "Loading goals and reserves...",
  actions: {
    createGoal: "Create goal",
    backToCards: "Back to cards",
  },
  feedback: {
    loadError: "Could not load your goals.",
  },
  onboarding: {
    firstGoal: "Current step: create your first goal and confirm a deposit to complete this step.",
  },
  activeGoals: {
    title: "Your active goals",
    description: "Open a goal to view saved total, history, and adjustments.",
    totalSaved: "Total saved: {amount}",
  },
  empty: {
    title: "No goals created yet.",
    description: "Use the \"Create goal\" button to start your first reserve.",
  },
  shortcuts: {
    title: "Shortcuts",
    description: "Start faster with a suggested goal type.",
  },
  goals: {
    cardLimit: {
      label: "Card piggy bank",
      description: "Increase your card limit with a dedicated reserve.",
    },
    emergencyReserve: {
      label: "Emergency reserve",
      description: "Cover unexpected events with more safety.",
    },
    travel: {
      label: "Take a trip",
      description: "Save for transportation, lodging, and activities.",
    },
    homeRenovation: {
      label: "Renovate the house",
      description: "Set money aside for materials and labor.",
    },
    dreamPurchase: {
      label: "Dream purchase",
      description: "Reach your goal without disrupting the budget.",
    },
    custom: {
      label: "Create custom goal",
      description: "Define your own goal in the way that makes sense.",
    },
  },
  new: {
    metadata: {
      title: "Create goal | WevenFinance",
      description: "Create a financial goal, add the first deposit, and track your reserve.",
    },
    title: "Create goal",
    description: "Define the objective, enter the amount, and confirm the first deposit.",
    loading: "Loading new goal...",
    stepLabel: "Step",
    stepTitle: "Step {step} of 3",
    actions: {
      backToGoals: "Back to goals",
      back: "Back",
      continue: "Continue",
      saving: "Saving...",
      confirmAndSave: "Confirm and save",
    },
    feedback: {
      loadError: "Could not load piggy bank data.",
      saveError: "Could not save the amount in the piggy bank.",
    },
    steps: {
      goal: {
        label: "Goal",
        description: "Choose what kind of goal you want to create.",
      },
      amount: {
        label: "Amount and source",
        description: "Enter the amount, source, and details for this reserve.",
      },
      review: {
        label: "Final review",
        description: "Review everything before confirming the initial deposit.",
      },
    },
    form: {
      goalQuestion: "What is the purpose of this reserve?",
      customNameLabel: "New goal name",
      customNamePlaceholder: "Ex: Replace my laptop",
      amountLabel: "How much do you want to save?",
      availableBalance: "Available balance",
      withdrawalModeLabel: "Withdrawal mode (optional)",
      withdrawalModePlaceholder: "Ex: Free withdrawal at any time",
      yieldTypeLabel: "Yield type (optional)",
      yieldTypePlaceholder: "Ex: CD, Treasury, simple reserve",
      sourceTypeLabel: "Amount source",
      cardLabel: "Card for limit increase",
      cardPlaceholder: "Select a card",
      noCardsWarning: "Register at least one card in /cards to use the card piggy bank.",
    },
    source: {
      bank: "Bank balance",
      cash: "Cash",
    },
    validation: {
      amountExceedsBalance: "The entered amount exceeds your available balance.",
    },
    review: {
      title: "Final review",
      goal: "Goal",
      amount: "Amount",
      source: "Source",
      withdrawal: "Withdrawal",
      yield: "Yield",
      appliedTo: "Applied to",
    },
    confirmation: {
      title: "What happens when you confirm",
      description: "The amount goes into the goal history, updates the saved total, and creates the corresponding account statement entry.",
    },
  },
  detail: {
    metadata: {
      title: "Goal details | WevenFinance",
      description: "Track saved total, history, adjustments, and details for a financial goal.",
    },
    description: "Follow the saved total and history for this goal.",
    unavailable: {
      title: "Goal unavailable",
    },
    errors: {
      load: "Could not load the goal.",
      notFound: "This goal no longer exists or was removed.",
    },
    actions: {
      back: "Back",
      adjust: "Add or withdraw amount",
      edit: "Edit goal",
      delete: "Delete",
      cancel: "Cancel",
      saving: "Saving...",
      deleting: "Deleting...",
    },
    summary: {
      title: "Total saved",
      description: "Current summary for this goal.",
    },
    fields: {
      withdrawal: "Withdrawal",
      yield: "Yield",
      notProvided: "Not provided",
    },
    history: {
      title: "History",
      count: "{count} movement(s) registered.",
      empty: "There are no movements for this goal yet.",
      source: "Source: {source}",
      withdrawal: "Withdrawal: {value}",
      yield: "Yield: {value}",
      appliedToCardLimit: "Applied to card limit",
      card: "Card: {card}",
      pageSummary: "Page {page} of {totalPages} • {total} movement(s)",
      previous: "Previous",
      next: "Next",
    },
    source: {
      bank: "Bank balance",
      cash: "Cash",
    },
    adjust: {
      title: "Adjust goal balance",
      description: "Add more money or withdraw part of the saved total.",
      typeLabel: "Adjustment type",
      deposit: "Add amount",
      withdraw: "Withdraw amount",
      amountLabel: "Amount",
      availableToWithdraw: "Available to withdraw: {amount}",
      sourceLabel: "Source or destination",
      confirm: "Confirm adjustment",
    },
    edit: {
      title: "Edit goal",
      description: "Update the name and complementary information for this reserve.",
      nameLabel: "Name",
      withdrawalModeLabel: "Withdrawal mode",
      yieldTypeLabel: "Yield type",
      save: "Save changes",
    },
    delete: {
      title: "Delete goal",
      description: "This action removes the goal, its history, and applied links, such as a card limit increase.",
      confirm: "Delete goal",
    },
  },
};
