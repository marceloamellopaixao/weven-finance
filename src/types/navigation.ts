export type NavigationAppId =
  | "dashboard"
  | "transactions-new"
  | "cards"
  | "piggy-bank"
  | "settings"
  | "apps";

export type NavigationDockPosition = "left" | "center" | "right";
export type NavigationDockBehavior = "fixed" | "auto-hide";
export type NavigationDockTheme = "dark" | "light";
export type NavigationDockDensity = "compact" | "comfortable";
export type NavigationDockLabels = "always" | "icons-only";
export type NavigationDockSurface = "glass" | "solid";
export type NavigationDockAccent = "violet" | "indigo" | "fuchsia" | "emerald" | "amber";

export type NavigationPreferences = {
  mobileEnabled: boolean;
  desktopEnabled: boolean;
  position: NavigationDockPosition;
  behavior: NavigationDockBehavior;
  theme: NavigationDockTheme;
  density: NavigationDockDensity;
  labels: NavigationDockLabels;
  surface: NavigationDockSurface;
  accent: NavigationDockAccent;
  shortcuts: NavigationAppId[];
};

export const ALL_PLATFORM_TOUR_ROUTES = [
  "dashboard",
  "settings",
  "transactions-new",
  "cards",
  "piggy-bank",
] as const;

export type PlatformTourRouteKey = (typeof ALL_PLATFORM_TOUR_ROUTES)[number];

export type PlatformTourState = {
  active: boolean;
  route: PlatformTourRouteKey | null;
  routeOrder: PlatformTourRouteKey[];
  startedAt: string | null;
};

export const MAX_DOCK_SHORTCUTS = 5;

export const DEFAULT_NAVIGATION_PREFERENCES: NavigationPreferences = {
  mobileEnabled: true,
  desktopEnabled: false,
  position: "center",
  behavior: "fixed",
  theme: "dark",
  density: "comfortable",
  labels: "always",
  surface: "glass",
  accent: "violet",
  shortcuts: ["dashboard", "transactions-new", "cards", "piggy-bank", "settings"],
};

export const DEFAULT_PLATFORM_TOUR_STATE: PlatformTourState = {
  active: false,
  route: null,
  routeOrder: [],
  startedAt: null,
};
