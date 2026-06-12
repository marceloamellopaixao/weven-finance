"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { Home, Landmark, PiggyBank as PiggyBankIcon, Plane, PlusCircle, ShieldCheck, Sparkles } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { usePlatformTour } from "@/hooks/usePlatformTour";
import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";
import { useTranslations } from "@/i18n/T";
import { useFormatters } from "@/i18n/useFormatters";
import { getPiggyBanks } from "@/services/piggyBankService";
import { PiggyBank, PiggyBankGoalType } from "@/types/piggyBank";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type GoalOption = {
  type: PiggyBankGoalType;
  labelKey: string;
  descriptionKey: string;
  icon: ComponentType<{ className?: string }>;
};

const GOAL_OPTIONS: GoalOption[] = [
  { type: "card_limit", labelKey: "goals.cardLimit.label", descriptionKey: "goals.cardLimit.description", icon: Landmark },
  { type: "emergency_reserve", labelKey: "goals.emergencyReserve.label", descriptionKey: "goals.emergencyReserve.description", icon: ShieldCheck },
  { type: "travel", labelKey: "goals.travel.label", descriptionKey: "goals.travel.description", icon: Plane },
  { type: "home_renovation", labelKey: "goals.homeRenovation.label", descriptionKey: "goals.homeRenovation.description", icon: Home },
  { type: "dream_purchase", labelKey: "goals.dreamPurchase.label", descriptionKey: "goals.dreamPurchase.description", icon: Sparkles },
  { type: "custom", labelKey: "goals.custom.label", descriptionKey: "goals.custom.description", icon: PlusCircle },
];

function PiggyBankPageSkeleton() {
  return (
    <div className="min-h-screen bg-transparent p-3 sm:p-6 md:p-8">
      <div className="mx-auto max-w-5xl animate-pulse space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <div className="h-8 w-56 rounded-2xl bg-primary/12" />
            <div className="h-4 w-80 max-w-full rounded-xl bg-muted" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="h-10 w-40 rounded-xl bg-muted" />
            <div className="h-10 w-36 rounded-xl bg-muted" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm md:col-span-2">
            <div className="mb-5 h-6 w-44 rounded-xl bg-muted" />
            <div className="grid gap-3 md:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <div className="h-4 w-32 rounded-xl bg-muted" />
                  <div className="mt-3 h-3 w-36 rounded-xl bg-muted" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
            <div className="mb-5 h-6 w-28 rounded-xl bg-muted" />
            <div className="space-y-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <div className="h-4 w-28 rounded-xl bg-muted" />
                  <div className="mt-3 h-3 w-full rounded-xl bg-muted" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PiggyBankClient() {
  const t = useTranslations("piggyBank");
  const { user, userProfile } = useAuth();
  const {
    status: onboardingStatus,
    loading: onboardingLoading,
    activeStep: onboardingActiveStep,
    isActive: isOnboardingActive,
    completeTour,
  } = useOnboarding();
  const [piggies, setPiggies] = useState<PiggyBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const currency = usePreferredCurrency();
  const { money } = useFormatters(currency);
  const isGoalOnboardingActive =
    isOnboardingActive &&
    onboardingActiveStep === "firstGoal" &&
    !onboardingStatus.steps.firstGoal;

  usePlatformTour({
    route: "piggy-bank",
    disabled: onboardingLoading || isOnboardingActive,
    onComplete: completeTour,
  });

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    void (async () => {
      setLoading(true);
      setFeedback(null);
      try {
        const loadedPiggies = await getPiggyBanks();
        if (!mounted) return;
        setPiggies(loadedPiggies);
      } catch (error) {
        if (!mounted) return;
        setFeedback(error instanceof Error ? error.message : t("feedback.loadError"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [t, user]);

  if (!user || !userProfile) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (loading) {
    return <PiggyBankPageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-transparent p-3 pb-20 sm:p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div id="tour-piggy-header" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground md:text-3xl">
              <PiggyBankIcon className="h-7 w-7 text-primary" />
              {t("title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/piggy-bank/new">
              <Button
                id="tour-piggy-create"
                className={`rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 ${isGoalOnboardingActive ? "ring-2 ring-ring/45 ring-offset-2 ring-offset-background" : ""}`}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                {t("actions.createGoal")}
              </Button>
            </Link>
            <Link href="/cards">
              <Button variant="outline" className="rounded-xl border-border/70 bg-card">
                {t("actions.backToCards")}
              </Button>
            </Link>
          </div>
        </div>

        {feedback && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{feedback}</div>
        )}

        {!onboardingLoading && !onboardingStatus.dismissed && !onboardingStatus.steps.firstGoal && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              isGoalOnboardingActive
                ? "border-primary/35 bg-accent text-accent-foreground ring-2 ring-ring/35"
                : "border-primary/20 bg-accent text-accent-foreground"
            }`}
          >
            {t("onboarding.firstGoal")}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card id="tour-piggy-list" className="rounded-3xl border border-border/70 bg-card shadow-sm md:col-span-2">
            <CardHeader>
              <CardTitle>{t("activeGoals.title")}</CardTitle>
              <CardDescription>{t("activeGoals.description")}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {piggies.length === 0 ? (
                <div className="md:col-span-2 w-full rounded-2xl border border-dashed border-border/70 bg-background/70 p-6 text-center text-sm text-muted-foreground">
                  {t("empty.title")}
                  <br />
                  {t("empty.description")}
                </div>
              ) : (
                piggies.map((piggy) => (
                  <Link
                    key={piggy.id}
                    href={`/piggy-bank/${piggy.slug}`}
                    className="rounded-2xl border border-border/70 bg-background/80 p-4 transition-colors hover:border-primary/35 hover:bg-accent"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{piggy.name}</p>
                        <p className="financial-value mt-1 text-xs text-muted-foreground">
                          {t("activeGoals.totalSaved", { amount: money(piggy.totalSaved) })}
                        </p>
                      </div>
                      <PiggyBankIcon className="h-5 w-5 shrink-0 text-primary" />
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card id="tour-piggy-shortcuts" className="rounded-3xl border border-border/70 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>{t("shortcuts.title")}</CardTitle>
              <CardDescription>{t("shortcuts.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {GOAL_OPTIONS.map((goal) => {
                const Icon = goal.icon;
                return (
                  <Link
                    key={goal.type}
                    href={`/piggy-bank/new?goal=${encodeURIComponent(goal.type)}`}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-background/80 p-4 text-left transition-colors hover:cursor-pointer hover:border-primary/35 hover:bg-accent"
                  >
                    <Icon className="h-5 w-5 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{t(goal.labelKey)}</p>
                      <p className="text-xs text-muted-foreground">{t(goal.descriptionKey)}</p>
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
