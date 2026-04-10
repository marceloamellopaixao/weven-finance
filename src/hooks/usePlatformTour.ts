"use client";

import { useEffect, useMemo, useRef } from "react";
import { driver } from "driver.js";
import { useRouter } from "next/navigation";
import { usePlatformExperience } from "@/hooks/usePlatformExperience";
import { PlatformTourRouteKey } from "@/types/navigation";
import { ensurePlatformTourTheme } from "@/lib/platform-tour/driver-theme";
import { getPlatformTourConfig, PLATFORM_TOUR_ROUTE_HREFS } from "@/lib/platform-tour/config";

type UsePlatformTourOptions = {
  route: PlatformTourRouteKey;
  disabled?: boolean;
  hasSeen?: boolean;
  forceStart?: boolean;
  stepVisibility?: Partial<Record<string, boolean>>;
  onComplete?: () => void | Promise<void>;
};

export function usePlatformTour(options: UsePlatformTourOptions) {
  const { route, disabled = false, hasSeen = false, forceStart = false, stepVisibility, onComplete } = options;
  const router = useRouter();
  const {
    isPlatformTourActive,
    platformTourState,
    startPlatformTour,
    setPlatformTourRoute,
    finishPlatformTour,
    cancelPlatformTour,
    setForceAccountMenuOpen,
  } = usePlatformExperience();

  const config = useMemo(() => getPlatformTourConfig(setForceAccountMenuOpen)[route], [route, setForceAccountMenuOpen]);
  const shouldUseSelectedRouteOrder = (platformTourState.routeOrder?.length || 0) > 0;
  const nextRouteFromSelection = useMemo(() => {
    const selectedOrder = platformTourState.routeOrder || [];
    const currentIndex = selectedOrder.indexOf(route);
    if (currentIndex >= 0 && currentIndex < selectedOrder.length - 1) {
      return selectedOrder[currentIndex + 1];
    }
    return null;
  }, [platformTourState.routeOrder, route]);
  const nextHrefFromSelection = nextRouteFromSelection ? PLATFORM_TOUR_ROUTE_HREFS[nextRouteFromSelection] : null;
  const stepVisibilityKey = useMemo(() => JSON.stringify(stepVisibility || {}), [stepVisibility]);
  const resolvedStepVisibility = useMemo(
    () => JSON.parse(stepVisibilityKey) as Partial<Record<string, boolean>>,
    [stepVisibilityKey]
  );
  const visibleSteps = useMemo(() => {
    return config.steps.filter((step) => {
      if (!step.stepId) return true;
      return resolvedStepVisibility[step.stepId] !== false;
    });
  }, [config.steps, resolvedStepVisibility]);
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const onCompleteRef = useRef<typeof onComplete>(onComplete);
  const hasQueuedRef = useRef(false);
  const completedRouteRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    ensurePlatformTourTheme();
  }, []);

  useEffect(() => {
    if (route !== "dashboard" || disabled) return;
    if (isPlatformTourActive) return;
    if (forceStart || !hasSeen) {
      startPlatformTour("dashboard");
    }
  }, [disabled, forceStart, hasSeen, isPlatformTourActive, route, startPlatformTour]);

  useEffect(() => {
    const shouldDrive = !disabled && isPlatformTourActive && platformTourState.route === route;
    if (!shouldDrive) {
      driverRef.current?.destroy();
      driverRef.current = null;
      hasQueuedRef.current = false;
      return;
    }
    if (hasQueuedRef.current) return;

    if (visibleSteps.length === 0) {
      finishPlatformTour();
      void onCompleteRef.current?.();
      return;
    }

    const steps = visibleSteps.map((step, index) => {
      const isLast = index === visibleSteps.length - 1;
      if (!isLast) return step;

      const hasNextRoute = shouldUseSelectedRouteOrder
        ? Boolean(nextRouteFromSelection)
        : Boolean(nextRouteFromSelection || config.nextRoute);

      return {
        ...step,
        popover: {
          ...step.popover,
          nextBtnText: hasNextRoute ? "Continuar" : "Concluir",
          onNextClick: async () => {
            completedRouteRef.current = true;
            setForceAccountMenuOpen(false);
            driverRef.current?.destroy();
            driverRef.current = null;

            const resolvedNextRoute = shouldUseSelectedRouteOrder
              ? nextRouteFromSelection
              : nextRouteFromSelection || config.nextRoute;
            const resolvedNextHref = shouldUseSelectedRouteOrder
              ? nextHrefFromSelection
              : nextHrefFromSelection || config.nextHref;

            if (resolvedNextRoute && resolvedNextHref) {
              setPlatformTourRoute(resolvedNextRoute);
              router.push(resolvedNextHref);
              return;
            }

            try {
              await onCompleteRef.current?.();
            } finally {
              finishPlatformTour();
            }
          },
        },
      };
    });

    driverRef.current = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      popoverClass: "driverjs-theme",
      doneBtnText: "Concluir",
      nextBtnText: "Próximo",
      prevBtnText: "Anterior",
      progressText: "{{current}} de {{total}}",
      steps,
      onDestroyed: () => {
        hasQueuedRef.current = false;
        setForceAccountMenuOpen(false);
        if (completedRouteRef.current) {
          completedRouteRef.current = false;
          return;
        }
        cancelPlatformTour();
        void onCompleteRef.current?.();
      },
    });

    hasQueuedRef.current = true;
    const timer = window.setTimeout(() => {
      driverRef.current?.drive();
    }, 650);

    return () => {
      window.clearTimeout(timer);
      driverRef.current?.destroy();
      driverRef.current = null;
      hasQueuedRef.current = false;
      setForceAccountMenuOpen(false);
    };
  }, [
    cancelPlatformTour,
    config.nextHref,
    config.nextRoute,
    disabled,
    finishPlatformTour,
    nextHrefFromSelection,
    nextRouteFromSelection,
    shouldUseSelectedRouteOrder,
    isPlatformTourActive,
    platformTourState.route,
    route,
    router,
    setForceAccountMenuOpen,
    setPlatformTourRoute,
    visibleSteps,
  ]);
}
