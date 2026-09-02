import type { Dictionary } from "@/i18n/dictionaries/pt-BR";

export const accountProfile: Dictionary["accountProfile"] = {
  metadata: {
    title: "WevenFinance | Account profile",
    description: "Choose your usage profile to prepare initial categories, reports, and shortcuts in WevenFinance.",
  },
  badge: "Select your usage profile to get started!",
  title: "How do you want to organize WevenFinance?",
  description: "We will set up categories, reports, and shortcuts based on how you manage money day to day.",
  greeting: "Hello, {name}. Choose an option to continue.",
  selected: "Selected",
  choose: "Choose",
  notice: "You can create other profiles later. This one will be used as the default for monthly reports and initial categories.",
  preparing: "Preparing...",
  createError: "Could not create the account profile",
  options: {
    personal: {
      title: "Personal profile",
      description: "Track income, expenses, cards, goals, debts, and the smart daily limit.",
    },
    professional: {
      title: "Business/PJ",
      description: "Use this profile for a business, self-employed work, church, store, services, or professional project.",
    },
    church: {
      title: "Business/PJ",
      description: "Churches, ministries, and professional projects use the Business/PJ profile.",
    },
    family: {
      title: "Family / household profile",
      description: "Track shared bills, groceries, rent, school, transportation, and family goals.",
    },
    business: {
      title: "Business/PJ",
      description: "Track business income, expenses, taxes, suppliers, cash flow, and reports.",
    },
  },
} as const;
