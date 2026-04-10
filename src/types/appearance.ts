import { NavigationDockAccent } from "@/types/navigation";

export type AppearanceThemeMode = "system" | "light" | "dark";
export type AppearanceAccent = NavigationDockAccent;

export type AppearancePreferences = {
  themeMode: AppearanceThemeMode;
  accent: AppearanceAccent;
};

export const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferences = {
  themeMode: "system",
  accent: "violet",
};
