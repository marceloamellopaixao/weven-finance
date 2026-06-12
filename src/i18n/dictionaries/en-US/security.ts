export const security = {
  metadata: {
    title: "Security",
    description: "How WevenFinance handles access, privacy, and platform data protection.",
    openGraphTitle: "Security | WevenFinance",
  },
  eyebrow: "Security",
  title: "How we protect your account and data",
  description: "This page summarizes, in plain language, how WevenFinance handles access, privacy, and platform operations.",
  items: {
    layered: {
      title: "Layered protection",
      description: "WevenFinance applies authentication, access rules, route protection, and internal controls to reduce improper exposure of your data.",
    },
    accountAccess: {
      title: "Account-linked access",
      description: "Your access is controlled by your authenticated account. Sensitive resources, such as billing and administrative support, go through additional backend validations.",
    },
    privacy: {
      title: "In-app privacy",
      description: "The app offers discreet mode, per-user data separation, and display controls to avoid visual exposure in public environments.",
    },
    storage: {
      title: "Storage and operations",
      description: "Operational data is stored in the cloud and processed by WevenFinance for features such as dashboard, cards, goals, and subscription.",
    },
  },
  important: {
    title: "Important",
    description: "Security is an ongoing commitment. The product is still evolving, and some layers continue to improve as the platform grows.",
  },
} as const;
