"use client";

import { cn } from "@/lib/utils";
import { getNavigationAppItem, isNavigationItemActive } from "@/lib/navigation/apps";
import { usePlatformExperience } from "@/hooks/usePlatformExperience";
import { usePathname } from "next/navigation";
import { NavigationDockBar } from "@/components/navigation/NavigationDockBar";

export function AppDock() {
  const pathname = usePathname();
  const {
    navigationPreferences,
    isNavigationDockAvailable,
    isPlatformTourActive,
  } = usePlatformExperience();

  const effectivePreferences = navigationPreferences;
  const shouldRenderMobileDock = isNavigationDockAvailable && effectivePreferences.mobileEnabled;
  const shouldRenderDesktopDock = isNavigationDockAvailable && effectivePreferences.desktopEnabled;

  if (!shouldRenderMobileDock && !shouldRenderDesktopDock) return null;

  const isSidebar = effectivePreferences.position !== "center";

  const activeItemId =
    effectivePreferences.shortcuts.find((id) => {
      return isNavigationItemActive(pathname, getNavigationAppItem(id));
    }) ?? null;

  const desktopPositionClass = isSidebar
    ? effectivePreferences.position === "left"
      ? "md:left-4 md:right-auto md:top-1/2 md:bottom-auto md:-translate-y-1/2"
      : "md:right-4 md:left-auto md:top-1/2 md:bottom-auto md:-translate-y-1/2"
    : "md:left-1/2 md:bottom-5 md:top-auto md:-translate-x-1/2";

  const desktopBehaviorClass =
    effectivePreferences.behavior === "auto-hide"
      ? isSidebar
        ? effectivePreferences.position === "left"
          ? "md:-translate-x-6 md:opacity-70 md:hover:translate-x-0 md:hover:opacity-100 md:focus-within:translate-x-0 md:focus-within:opacity-100"
          : "md:translate-x-6 md:opacity-70 md:hover:translate-x-0 md:hover:opacity-100 md:focus-within:translate-x-0 md:focus-within:opacity-100"
        : "md:translate-y-10 md:opacity-75 md:hover:translate-y-0 md:hover:opacity-100 md:focus-within:translate-y-0 md:focus-within:opacity-100"
      : "";

  return (
    <>
      {shouldRenderMobileDock && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-3 md:hidden">
          <NavigationDockBar
            preferences={effectivePreferences}
            activeItemId={activeItemId}
            mobile
            interactive
            className="w-[min(92vw,380px)] max-w-[380px]"
          />
        </div>
      )}

      {shouldRenderDesktopDock && (
        <div
          className={cn(
            "pointer-events-none fixed z-40 hidden md:block",
            desktopPositionClass,
            desktopBehaviorClass
          )}
        >
          <div className="pointer-events-auto">
            <NavigationDockBar
              preferences={effectivePreferences}
              activeItemId={activeItemId}
              interactive
              className={cn(
                !isSidebar && "w-[min(88vw,428px)] max-w-[428px]",
                isPlatformTourActive && "ring-2 ring-ring/45 ring-offset-2 ring-offset-background"
              )}
            />
          </div>
        </div>
      )}
    </>
  );
}
