"use client";

import Link from "next/link";
import { type KeyboardEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Compass, PlayCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NAVIGATION_APP_ITEMS } from "@/lib/navigation/apps";
import { DockSettingsPanel } from "@/components/navigation/DockSettingsPanel";
import { usePlatformExperience } from "@/hooks/usePlatformExperience";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useAuth } from "@/hooks/useAuth";
import {
  ALL_PLATFORM_TOUR_ROUTES,
  PlatformTourRouteKey,
} from "@/types/navigation";
import { PLATFORM_TOUR_ROUTE_HREFS } from "@/lib/platform-tour/config";
import { useTranslations } from "@/i18n/T";

export function AppsClient() {
  const router = useRouter();
  const tApps = useTranslations("apps");
  const { userProfile } = useAuth();
  const { startPlatformTour, isPlatformTourActive } = usePlatformExperience();
  const { resetTour } = useOnboarding();
  const [selectedRoutes, setSelectedRoutes] = useState<PlatformTourRouteKey[]>([
    ...ALL_PLATFORM_TOUR_ROUTES,
  ]);

  const orderedSelectedRoutes = useMemo(
    () =>
      ALL_PLATFORM_TOUR_ROUTES.filter((route) => selectedRoutes.includes(route)),
    [selectedRoutes]
  );

  const selectedCount = orderedSelectedRoutes.length;

  const handleToggleRoute = (route: PlatformTourRouteKey) => {
    setSelectedRoutes((current) =>
      current.includes(route)
        ? current.filter((item) => item !== route)
        : [...current, route]
    );
  };

  const handleSelectAllRoutes = () => {
    setSelectedRoutes([...ALL_PLATFORM_TOUR_ROUTES]);
  };

  const handleClearRoutes = () => {
    setSelectedRoutes([]);
  };

  const handleStartTour = async (routes: PlatformTourRouteKey[]) => {
    if (routes.length === 0) return;
    const firstRoute = routes[0];
    await resetTour();
    startPlatformTour(firstRoute, routes);
    router.push(PLATFORM_TOUR_ROUTE_HREFS[firstRoute]);
  };

  const handleTourCardKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    route: PlatformTourRouteKey
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleToggleRoute(route);
    }
  };

  return (
    <div className="p-3 sm:p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="app-panel-soft overflow-hidden rounded-4xl border border-color:var(--app-panel-border) shadow-xl shadow-zinc-200/50 dark:shadow-black/20">
          <div className="grid gap-6 px-6 py-8 md:grid-cols-[1.3fr_0.7fr] md:px-8 md:py-10">
            <div className="space-y-4">
              <Badge className="rounded-full bg-accent px-3 py-1 text-primary">
                {tApps("hero.badge")}
              </Badge>
              <div className="space-y-3">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                  {tApps("hero.title")}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                  {tApps("hero.description")}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() =>
                    void handleStartTour([...ALL_PLATFORM_TOUR_ROUTES])
                  }
                  disabled={isPlatformTourActive}
                  className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  {isPlatformTourActive
                    ? tApps("hero.finishGuidedStart")
                    : tApps("hero.startFullTour")}
                </Button>
                <Link href="/dashboard">
                  <Button variant="outline" className="rounded-2xl">
                    {tApps("hero.openDashboard")}
                  </Button>
                </Link>
              </div>
            </div>

            <div className="app-panel-subtle rounded-[28px] border border-color:var(--app-panel-border) p-5">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                  <Compass className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {tApps("hero.currentAccount")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tApps("hero.accountPlan", {
                      name: userProfile?.displayName || tApps("hero.accountFallback"),
                      plan: userProfile?.plan || tApps("hero.planFallback"),
                    })}
                  </p>
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-primary/20 bg-background/60 p-4 text-sm text-muted-foreground shadow-sm">
                {tApps("hero.note")}
              </div>
            </div>
          </div>
        </section>

        <section
          id="tour-guided"
          className="grid gap-4 xl:grid-cols-[0.96fr_1.04fr]"
        >
          <Card className="app-panel-soft rounded-[30px] border border-color:var(--app-panel-border) shadow-xl shadow-zinc-200/50 dark:shadow-black/20">
            <CardContent className="space-y-6 p-6 sm:p-7">
              <div className="space-y-2">
                <Badge className="rounded-full bg-accent px-3 py-1 text-primary">
                  {tApps("tour.badge")}
                </Badge>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  {tApps("tour.title")}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {tApps("tour.description")}
                </p>
              </div>

              <div className="rounded-[26px] border border-primary/20 bg-linear-to-br from-primary/70 to-primary/35 p-px shadow-lg shadow-primary/15">
                <div className="app-panel-subtle rounded-[25px] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
                        {tApps("tour.selectedGuide")}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {selectedCount === 0
                          ? tApps("tour.noneSelected")
                          : tApps(selectedCount === 1 ? "tour.oneReady" : "tour.manyReady", { count: selectedCount })}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSelectAllRoutes}
                        className="rounded-xl border-primary/20 text-primary hover:bg-accent"
                      >
                        {tApps("tour.selectAll")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleClearRoutes}
                        className="rounded-xl text-muted-foreground hover:bg-accent"
                      >
                        {tApps("tour.clearSelection")}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {orderedSelectedRoutes.length > 0 ? (
                      orderedSelectedRoutes.map((route, index) => (
                        <Badge
                          key={route}
                          variant="outline"
                          className="rounded-full border-primary/20 bg-accent px-3 py-1 text-primary"
                        >
                          {index + 1}. {tApps(`tourCopy.${route}.title`)}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {tApps("tour.emptySelection")}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      onClick={() =>
                        void handleStartTour(orderedSelectedRoutes)
                      }
                      disabled={isPlatformTourActive || selectedCount === 0}
                      className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      {selectedCount === ALL_PLATFORM_TOUR_ROUTES.length
                        ? tApps("hero.startFullTour")
                        : tApps("tour.startSelected")}
                    </Button>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {isPlatformTourActive
                        ? tApps("tour.finishCurrentTour")
                        : tApps("tour.selectedOnlyHint")}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="app-panel-soft rounded-[30px] border border-color:var(--app-panel-border) shadow-xl shadow-zinc-200/50 dark:shadow-black/20">
            <CardContent className="space-y-4 p-6 sm:p-7">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">
                  {tApps("tour.chaptersTitle")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {tApps("tour.chaptersDescription")}
                </p>
              </div>

              <div className="space-y-3">
                {ALL_PLATFORM_TOUR_ROUTES.map((route) => {
                  const item = NAVIGATION_APP_ITEMS.find((entry) => entry.id === route);
                  const Icon = item?.icon || Compass;
                  const isSelected = selectedRoutes.includes(route);
                  const orderIndex = orderedSelectedRoutes.indexOf(route);

                  return (
                    <div
                      key={route}
                      onClick={() => handleToggleRoute(route)}
                      onKeyDown={(event) => handleTourCardKeyDown(event, route)}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      className={`group flex w-full items-start gap-4 rounded-3xl border p-4 text-left transition-all ${isSelected
                        ? "border-primary/35 bg-accent shadow-sm shadow-primary/10 dark:border-primary/40 dark:bg-accent/25"
                        : "app-panel-subtle border-color:var(--app-panel-border) hover:border-primary/25 hover:bg-accent/60"
                        }`}
                    >
                      <div
                        aria-hidden="true"
                        className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-lg border transition-colors ${isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-primary/35 bg-background/70 text-transparent"
                          }`}
                      >
                        <Check className="h-3 w-3" />
                      </div>
                      <div
                        className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br ${item?.accentClass || "from-primary/15 to-primary/5 text-primary"
                          }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">
                            {tApps(`tourCopy.${route}.eyebrow`)}
                          </p>
                          {isSelected ? (
                            <Badge className="rounded-full bg-primary text-primary-foreground">
                              {orderIndex + 1}
                            </Badge>
                          ) : null}
                        </div>
                        <h4 className="text-base font-semibold text-foreground">
                          {tApps(`tourCopy.${route}.title`)}
                        </h4>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {tApps(`tourCopy.${route}.description`)}
                        </p>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-primary" />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">
              {tApps("platform.title")}
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {NAVIGATION_APP_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.id} href={item.href}>
                  <Card className="app-panel-soft h-full rounded-[28px] border border-color:var(--app-panel-border) shadow-sm transition-all hover:-translate-y-1 hover:border-primary/35 hover:shadow-xl hover:shadow-primary/10 dark:hover:shadow-black/30">
                    <CardContent className="p-5">
                      <div
                        className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br ${item.accentClass}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="mt-4 space-y-2">
                        <h3 className="text-base font-semibold text-foreground">
                          {tApps(`navigation.${item.id}.label`)}
                        </h3>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {tApps(`navigation.${item.id}.description`)}
                        </p>
                      </div>
                      <div className="mt-5">
                        <Badge
                          variant="outline"
                          className="rounded-full border-primary/20 text-primary"
                        >
                          {tApps("platform.open", { label: tApps(`navigation.${item.id}.shortLabel`).toLowerCase() })}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">
              {tApps("dockIntro.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {tApps("dockIntro.description")}
            </p>
          </div>
          <DockSettingsPanel />
        </section>
      </div>
    </div>
  );
}
