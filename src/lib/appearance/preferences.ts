import {
  AppearanceAccent,
  AppearancePreferences,
  AppearanceThemeMode,
  DEFAULT_APPEARANCE_PREFERENCES,
} from "@/types/appearance";

function isThemeMode(value: unknown): value is AppearanceThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

function isAccent(value: unknown): value is AppearanceAccent {
  return (
    value === "violet" ||
    value === "indigo" ||
    value === "fuchsia" ||
    value === "emerald" ||
    value === "amber"
  );
}

export function normalizeAppearancePreferences(
  input?: Partial<AppearancePreferences> | null
): AppearancePreferences {
  return {
    themeMode: isThemeMode(input?.themeMode)
      ? input.themeMode
      : DEFAULT_APPEARANCE_PREFERENCES.themeMode,
    accent: isAccent(input?.accent)
      ? input.accent
      : DEFAULT_APPEARANCE_PREFERENCES.accent,
  };
}

export function resolveAppearanceThemeMode(
  preferences: AppearancePreferences,
  prefersDark: boolean
) {
  return preferences.themeMode === "system"
    ? prefersDark
      ? "dark"
      : "light"
    : preferences.themeMode;
}
