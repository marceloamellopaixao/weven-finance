"use client";

import { usePlatformExperience } from "@/hooks/usePlatformExperience";

export function useAppearance() {
  const {
    appearancePreferences,
    appearanceLoading,
    updateAppearance,
    refreshAppearancePreferences,
  } = usePlatformExperience();

  return {
    appearancePreferences,
    appearanceLoading,
    updateAppearance,
    refreshAppearancePreferences,
  };
}
