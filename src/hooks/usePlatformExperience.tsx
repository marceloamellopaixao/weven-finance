"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  ALL_PLATFORM_TOUR_ROUTES,
  DEFAULT_NAVIGATION_PREFERENCES,
  DEFAULT_PLATFORM_TOUR_STATE,
  NavigationPreferences,
  PlatformTourRouteKey,
  PlatformTourState,
} from "@/types/navigation";
import {
  AppearancePreferences,
  DEFAULT_APPEARANCE_PREFERENCES,
} from "@/types/appearance";
import { normalizeNavigationPreferences } from "@/lib/navigation/apps";
import { normalizeAppearancePreferences, resolveAppearanceThemeMode } from "@/lib/appearance/preferences";
import {
  getNavigationPreferences,
  subscribeToNavigationSettings,
  updateNavigationPreferences,
} from "@/services/navigationSettingsService";
import {
  getAppearancePreferences,
  subscribeToAppearanceSettings,
  updateAppearancePreferences,
} from "@/services/appearanceSettingsService";

const NAVIGATION_PREFERENCES_CACHE_KEY = "wevenfinance:navigation-preferences";
const APPEARANCE_PREFERENCES_CACHE_KEY = "wevenfinance:appearance-preferences";
const PLATFORM_TOUR_STORAGE_KEY = "wevenfinance:platform-tour";

type PlatformExperienceContextValue = {
  navigationPreferences: NavigationPreferences;
  navigationLoading: boolean;
  updatePreferences: (
    updater:
      | NavigationPreferences
      | ((current: NavigationPreferences) => NavigationPreferences)
  ) => Promise<NavigationPreferences>;
  refreshNavigationPreferences: () => Promise<void>;
  appearancePreferences: AppearancePreferences;
  appearanceLoading: boolean;
  updateAppearance: (
    updater:
      | AppearancePreferences
      | ((current: AppearancePreferences) => AppearancePreferences)
  ) => Promise<AppearancePreferences>;
  refreshAppearancePreferences: () => Promise<void>;
  isNavigationDockAvailable: boolean;
  shouldRenderMobileDock: boolean;
  shouldRenderDesktopDock: boolean;
  shouldAddDockSpacing: boolean;
  isPlatformTourActive: boolean;
  platformTourState: PlatformTourState;
  startPlatformTour: (route?: PlatformTourRouteKey, routeOrder?: PlatformTourRouteKey[]) => void;
  setPlatformTourRoute: (route: PlatformTourRouteKey) => void;
  finishPlatformTour: () => void;
  cancelPlatformTour: () => void;
  forceAccountMenuOpen: boolean;
  setForceAccountMenuOpen: (value: boolean) => void;
};

const PlatformExperienceContext = createContext<PlatformExperienceContextValue | null>(null);

function readCachedNavigationPreferences() {
  if (typeof window === "undefined") return DEFAULT_NAVIGATION_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(NAVIGATION_PREFERENCES_CACHE_KEY);
    if (!raw) return DEFAULT_NAVIGATION_PREFERENCES;
    return normalizeNavigationPreferences(JSON.parse(raw) as Partial<NavigationPreferences>);
  } catch {
    return DEFAULT_NAVIGATION_PREFERENCES;
  }
}

function persistNavigationPreferences(value: NavigationPreferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NAVIGATION_PREFERENCES_CACHE_KEY, JSON.stringify(value));
  } catch { }
}

function normalizePlatformTourOrder(routeOrder?: PlatformTourRouteKey[]) {
  const source = routeOrder && routeOrder.length > 0 ? routeOrder : [...ALL_PLATFORM_TOUR_ROUTES];
  return Array.from(
    new Set(
      source.filter((route): route is PlatformTourRouteKey => ALL_PLATFORM_TOUR_ROUTES.includes(route))
    )
  );
}

function readStoredPlatformTourState() {
  if (typeof window === "undefined") return DEFAULT_PLATFORM_TOUR_STATE;
  try {
    const raw = window.sessionStorage.getItem(PLATFORM_TOUR_STORAGE_KEY);
    if (!raw) return DEFAULT_PLATFORM_TOUR_STATE;
    const parsed = JSON.parse(raw) as Partial<PlatformTourState>;
    return {
      active: Boolean(parsed.active),
      route:
        typeof parsed.route === "string" && ALL_PLATFORM_TOUR_ROUTES.includes(parsed.route as PlatformTourRouteKey)
          ? (parsed.route as PlatformTourRouteKey)
          : null,
      routeOrder: normalizePlatformTourOrder(Array.isArray(parsed.routeOrder) ? parsed.routeOrder : undefined),
      startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : null,
    };
  } catch {
    return DEFAULT_PLATFORM_TOUR_STATE;
  }
}

function readCachedAppearancePreferences() {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(APPEARANCE_PREFERENCES_CACHE_KEY);
    if (!raw) return DEFAULT_APPEARANCE_PREFERENCES;
    return normalizeAppearancePreferences(JSON.parse(raw) as Partial<AppearancePreferences>);
  } catch {
    return DEFAULT_APPEARANCE_PREFERENCES;
  }
}

function persistAppearancePreferences(value: AppearancePreferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(APPEARANCE_PREFERENCES_CACHE_KEY, JSON.stringify(value));
  } catch { }
}

function persistPlatformTourState(value: PlatformTourState) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PLATFORM_TOUR_STORAGE_KEY, JSON.stringify(value));
  } catch { }
}

export function PlatformExperienceProvider({ children }: { children: ReactNode }) {
  const { user, userProfile } = useAuth();
  const pathname = usePathname();
  const [navigationPreferences, setNavigationPreferences] = useState<NavigationPreferences>(
    readCachedNavigationPreferences
  );
  const [navigationLoading, setNavigationLoading] = useState(true);
  const [appearancePreferences, setAppearancePreferences] = useState<AppearancePreferences>(
    readCachedAppearancePreferences
  );
  const [appearanceLoading, setAppearanceLoading] = useState(true);
  const [platformTourState, setPlatformTourState] = useState<PlatformTourState>(
    readStoredPlatformTourState
  );
  const [forceAccountMenuOpen, setForceAccountMenuOpen] = useState(false);

  const isAuthenticated = Boolean(user || userProfile);
  const isNavigationDockAvailable =
    isAuthenticated &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/register") &&
    !pathname.startsWith("/forgot-password") &&
    !pathname.startsWith("/first-access") &&
    !pathname.startsWith("/verify-email") &&
    !pathname.startsWith("/goodbye") &&
    !pathname.startsWith("/blocked") &&
    !pathname.startsWith("/billing") &&
    pathname !== "/";

  const shouldRenderMobileDock = isNavigationDockAvailable && navigationPreferences.mobileEnabled;
  const shouldRenderDesktopDock = isNavigationDockAvailable && navigationPreferences.desktopEnabled;
  const shouldAddDockSpacing = shouldRenderMobileDock || shouldRenderDesktopDock;
  const isPlatformTourActive = platformTourState.active;

  const refreshNavigationPreferences = useCallback(async () => {
    if (!isAuthenticated) {
      setNavigationPreferences(DEFAULT_NAVIGATION_PREFERENCES);
      setNavigationLoading(false);
      return;
    }

    setNavigationLoading(true);
    try {
      const next = await getNavigationPreferences();
      setNavigationPreferences(next);
      persistNavigationPreferences(next);
    } finally {
      setNavigationLoading(false);
    }
  }, [isAuthenticated]);

  const refreshAppearancePreferences = useCallback(async () => {
    if (!isAuthenticated) {
      const cached = readCachedAppearancePreferences();
      setAppearancePreferences(cached);
      persistAppearancePreferences(cached);
      setAppearanceLoading(false);
      return;
    }

    setAppearanceLoading(true);
    try {
      const next = await getAppearancePreferences();
      setAppearancePreferences(next);
      persistAppearancePreferences(next);
    } finally {
      setAppearanceLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refreshNavigationPreferences();
  }, [refreshNavigationPreferences]);

  useEffect(() => {
    void refreshAppearancePreferences();
  }, [refreshAppearancePreferences]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsubscribe = subscribeToNavigationSettings(() => {
      void refreshNavigationPreferences();
    });
    return () => unsubscribe();
  }, [isAuthenticated, refreshNavigationPreferences]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsubscribe = subscribeToAppearanceSettings(() => {
      void refreshAppearancePreferences();
    });
    return () => unsubscribe();
  }, [isAuthenticated, refreshAppearancePreferences]);

  useEffect(() => {
    persistPlatformTourState(platformTourState);
  }, [platformTourState]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyAppearance = () => {
      const resolvedTheme = resolveAppearanceThemeMode(appearancePreferences, media.matches);
      root.classList.toggle("dark", resolvedTheme === "dark");
      root.dataset.appTheme = appearancePreferences.themeMode;
      root.dataset.appResolvedTheme = resolvedTheme;
      root.dataset.appAccent = appearancePreferences.accent;
      root.style.colorScheme = resolvedTheme;
    };

    applyAppearance();
    media.addEventListener("change", applyAppearance);
    return () => media.removeEventListener("change", applyAppearance);
  }, [appearancePreferences]);

  useEffect(() => {
    if (!isPlatformTourActive) {
      setForceAccountMenuOpen(false);
      return;
    }

    if (pathname !== "/dashboard") {
      setForceAccountMenuOpen(false);
    }
  }, [isPlatformTourActive, pathname]);

  const updatePreferences = useCallback(
    async (
      updater:
        | NavigationPreferences
        | ((current: NavigationPreferences) => NavigationPreferences)
    ) => {
      const next = normalizeNavigationPreferences(
        typeof updater === "function" ? updater(navigationPreferences) : updater
      );
      const saved = await updateNavigationPreferences(next);
      setNavigationPreferences(saved);
      persistNavigationPreferences(saved);
      return saved;
    },
    [navigationPreferences]
  );

  const updateAppearance = useCallback(
    async (
      updater:
        | AppearancePreferences
        | ((current: AppearancePreferences) => AppearancePreferences)
    ) => {
      const next = normalizeAppearancePreferences(
        typeof updater === "function" ? updater(appearancePreferences) : updater
      );
      setAppearancePreferences(next);
      persistAppearancePreferences(next);
      try {
        const saved = await updateAppearancePreferences(next);
        setAppearancePreferences(saved);
        persistAppearancePreferences(saved);
        return saved;
      } catch (error) {
        setAppearancePreferences(appearancePreferences);
        persistAppearancePreferences(appearancePreferences);
        throw error;
      }
    },
    [appearancePreferences]
  );

  const startPlatformTour = useCallback((route: PlatformTourRouteKey = "dashboard", routeOrder?: PlatformTourRouteKey[]) => {
    const normalizedRouteOrder = normalizePlatformTourOrder(routeOrder);
    const nextRoute = normalizedRouteOrder.includes(route) ? route : normalizedRouteOrder[0] || route;

    setPlatformTourState({
      active: true,
      route: nextRoute,
      routeOrder: normalizedRouteOrder,
      startedAt: new Date().toISOString(),
    });
  }, []);

  const setPlatformTourRoute = useCallback((route: PlatformTourRouteKey) => {
    setPlatformTourState((prev) => ({
      active: true,
      route,
      routeOrder: prev.routeOrder.length > 0 ? prev.routeOrder : normalizePlatformTourOrder([route]),
      startedAt: prev.startedAt || new Date().toISOString(),
    }));
  }, []);

  const clearPlatformTour = useCallback(() => {
    setForceAccountMenuOpen(false);
    setPlatformTourState(DEFAULT_PLATFORM_TOUR_STATE);
  }, []);

  const value = useMemo<PlatformExperienceContextValue>(
    () => ({
      navigationPreferences,
      navigationLoading,
      updatePreferences,
      refreshNavigationPreferences,
      appearancePreferences,
      appearanceLoading,
      updateAppearance,
      refreshAppearancePreferences,
      isNavigationDockAvailable,
      shouldRenderMobileDock,
      shouldRenderDesktopDock,
      shouldAddDockSpacing,
      isPlatformTourActive,
      platformTourState,
      startPlatformTour,
      setPlatformTourRoute,
      finishPlatformTour: clearPlatformTour,
      cancelPlatformTour: clearPlatformTour,
      forceAccountMenuOpen,
      setForceAccountMenuOpen,
    }),
    [
      clearPlatformTour,
      forceAccountMenuOpen,
      isNavigationDockAvailable,
      isPlatformTourActive,
      navigationLoading,
      navigationPreferences,
      appearanceLoading,
      appearancePreferences,
      platformTourState,
      refreshNavigationPreferences,
      refreshAppearancePreferences,
      setPlatformTourRoute,
      shouldAddDockSpacing,
      shouldRenderDesktopDock,
      shouldRenderMobileDock,
      startPlatformTour,
      updateAppearance,
      updatePreferences,
    ]
  );

  return (
    <PlatformExperienceContext.Provider value={value}>
      {children}
    </PlatformExperienceContext.Provider>
  );
}

export function usePlatformExperience() {
  const context = useContext(PlatformExperienceContext);
  if (!context) {
    throw new Error("usePlatformExperience must be used within PlatformExperienceProvider");
  }
  return context;
}
