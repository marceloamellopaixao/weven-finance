import type { LucideIcon } from "lucide-react";
import {
  CreditCard,
  Grid2X2,
  LayoutDashboard,
  PiggyBank,
  PlusCircle,
  Settings,
} from "lucide-react";
import {
  DEFAULT_NAVIGATION_PREFERENCES,
  MAX_DOCK_SHORTCUTS,
  NavigationAppId,
  NavigationPreferences,
} from "@/types/navigation";

export type NavigationAppItem = {
  id: NavigationAppId;
  label: string;
  shortLabel: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accentClass: string;
  matches: string[];
};

export const NAVIGATION_APP_ITEMS: NavigationAppItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    shortLabel: "Painel",
    description: "Sua visão geral do mês, saldo, previsão e extrato financeiro.",
    href: "/dashboard",
    icon: LayoutDashboard,
    accentClass: "from-violet-500/15 to-indigo-500/10 text-violet-700",
    matches: ["/dashboard"],
  },
  {
    id: "transactions-new",
    label: "Novo lançamento",
    shortLabel: "Lançar",
    description: "Registre receita, despesa, recorrencia e compra parcelada.",
    href: "/transactions/new",
    icon: PlusCircle,
    accentClass: "from-emerald-500/15 to-teal-500/10 text-emerald-700",
    matches: ["/transactions/new", "/transactions/"],
  },
  {
    id: "cards",
    label: "Cartões",
    shortLabel: "Cartões",
    description: "Acompanhe limites, faturas, débito e crédito em um só lugar.",
    href: "/cards",
    icon: CreditCard,
    accentClass: "from-sky-500/15 to-cyan-500/10 text-sky-700",
    matches: ["/cards"],
  },
  {
    id: "piggy-bank",
    label: "Porquinho",
    shortLabel: "Metas",
    description: "Crie metas, acompanhe aportes e visualize sua evolução.",
    href: "/piggy-bank",
    icon: PiggyBank,
    accentClass: "from-amber-500/15 to-orange-500/10 text-amber-700",
    matches: ["/piggy-bank", "/porquinho"],
  },
  {
    id: "settings",
    label: "Configurações",
    shortLabel: "Conta",
    description: "Gerencie conta, assinatura, privacidade e ajuda.",
    href: "/settings",
    icon: Settings,
    accentClass: "from-zinc-500/15 to-slate-500/10 text-zinc-700",
    matches: ["/settings"],
  },
  {
    id: "apps",
    label: "Explorar app",
    shortLabel: "Apps",
    description: "Veja todas as áreas do WevenFinance e personalize seus atalhos.",
    href: "/apps",
    icon: Grid2X2,
    accentClass: "from-fuchsia-500/15 to-pink-500/10 text-fuchsia-700",
    matches: ["/apps"],
  },
];

export const PLATFORM_TOUR_ROUTE_ORDER = [
  "dashboard",
  "settings",
  "transactions-new",
  "cards",
  "piggy-bank",
] as const;

const APP_ITEMS_BY_ID = new Map(NAVIGATION_APP_ITEMS.map((item) => [item.id, item]));

export function getNavigationAppItem(id: NavigationAppId) {
  return APP_ITEMS_BY_ID.get(id) || APP_ITEMS_BY_ID.get("dashboard")!;
}

export function normalizeNavigationPreferences(
  input?: Partial<NavigationPreferences> | null
): NavigationPreferences {
  const shortcuts = Array.from(
    new Set(
      (input?.shortcuts || DEFAULT_NAVIGATION_PREFERENCES.shortcuts).filter((value): value is NavigationAppId =>
        APP_ITEMS_BY_ID.has(value)
      )
    )
  ).slice(0, MAX_DOCK_SHORTCUTS);

  return {
    mobileEnabled: typeof input?.mobileEnabled === "boolean"
      ? input.mobileEnabled
      : DEFAULT_NAVIGATION_PREFERENCES.mobileEnabled,
    desktopEnabled: typeof input?.desktopEnabled === "boolean"
      ? input.desktopEnabled
      : DEFAULT_NAVIGATION_PREFERENCES.desktopEnabled,
    position: input?.position === "left" || input?.position === "center" || input?.position === "right"
      ? input.position
      : DEFAULT_NAVIGATION_PREFERENCES.position,
    behavior: input?.behavior === "auto-hide" || input?.behavior === "fixed"
      ? input.behavior
      : DEFAULT_NAVIGATION_PREFERENCES.behavior,
    theme: input?.theme === "light" || input?.theme === "dark"
      ? input.theme
      : DEFAULT_NAVIGATION_PREFERENCES.theme,
    density: input?.density === "compact" || input?.density === "comfortable"
      ? input.density
      : DEFAULT_NAVIGATION_PREFERENCES.density,
    labels: input?.labels === "always" || input?.labels === "icons-only"
      ? input.labels
      : DEFAULT_NAVIGATION_PREFERENCES.labels,
    surface: input?.surface === "glass" || input?.surface === "solid"
      ? input.surface
      : DEFAULT_NAVIGATION_PREFERENCES.surface,
    accent:
      input?.accent === "violet" ||
      input?.accent === "indigo" ||
      input?.accent === "fuchsia" ||
      input?.accent === "emerald" ||
      input?.accent === "amber"
        ? input.accent
        : DEFAULT_NAVIGATION_PREFERENCES.accent,
    shortcuts: shortcuts.length > 0 ? shortcuts : DEFAULT_NAVIGATION_PREFERENCES.shortcuts,
  };
}

export function isNavigationItemActive(pathname: string, item: NavigationAppItem) {
  return item.matches.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
