export const settings = {
  title: "Settings",
  subtitle: "Manage your account, privacy, and subscription.",
  tabs: {
    general: "General",
    billing: "Plans",
    privacy: "Privacy",
    help: "Help",
  },
  region: {
    title: "Language and Region",
    description: "These preferences change how the platform is displayed. Changing the currency does not automatically convert old amounts.",
    language: "Platform language",
    currency: "Main currency",
    currencyNotice: "The currency changes only display and new entries. It does not automatically convert old amounts.",
    saved: "Regional preferences saved.",
    saveError: "We could not save language and currency right now.",
  },
} as const;
