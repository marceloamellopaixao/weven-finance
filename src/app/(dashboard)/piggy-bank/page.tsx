"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { usePlatformTour } from "@/hooks/usePlatformTour";
import { getPiggyBanks } from "@/services/piggyBankService";
import { PiggyBank, PiggyBankGoalType } from "@/types/piggyBank";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, Landmark, PiggyBank as PiggyBankIcon, Plane, PlusCircle, ShieldCheck, Sparkles } from "lucide-react";

type GoalOption = {
  type: PiggyBankGoalType;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const GOAL_OPTIONS: GoalOption[] = [
  { type: "card_limit", label: "Cofrinho do Cartão", description: "Aumentar limite do cartão com reserva dedicada.", icon: Landmark },
  { type: "emergency_reserve", label: "Reserva de emergência", description: "Cobrir imprevistos com mais segurança.", icon: ShieldCheck },
  { type: "travel", label: "Fazer uma viagem", description: "Guardar para transporte, hospedagem e passeios.", icon: Plane },
  { type: "home_renovation", label: "Reformar a casa", description: "Separar valor para materiais e mão de obra.", icon: Home },
  { type: "dream_purchase", label: "Sonho de consumo", description: "Chegar no objetivo sem baguncar o orçamento.", icon: Sparkles },
  { type: "custom", label: "Criar novo objetivo", description: "Defina sua própria meta do jeito que fizer sentido.", icon: PlusCircle },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

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

export default function PiggyBankPage() {
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
        setFeedback(error instanceof Error ? error.message : "Não foi possível carregar suas metas.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  if (!user || !userProfile) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Carregando metas e reservas...</p>
      </div>
    );
  }

  if (loading) {
    return <PiggyBankPageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-transparent p-3 sm:p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div id="tour-piggy-header" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground md:text-3xl">
              <PiggyBankIcon className="h-7 w-7 text-primary" />
              Metas e reservas
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acompanhe objetivos, reservas e cofrinhos do cartão em um só lugar.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/piggy-bank/new">
              <Button id="tour-piggy-create" className={`rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 ${isGoalOnboardingActive ? "ring-2 ring-ring/45 ring-offset-2 ring-offset-background" : ""}`}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Criar meta
              </Button>
            </Link>
            <Link href="/cards">
              <Button variant="outline" className="rounded-xl border-border/70 bg-card">
                Voltar para cartões
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
            Etapa atual: crie sua primeira meta e confirme um aporte para concluir esta etapa.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card id="tour-piggy-list" className="rounded-3xl border border-border/70 bg-card shadow-sm md:col-span-2">
            <CardHeader>
              <CardTitle>Suas metas ativas</CardTitle>
              <CardDescription>Abra um objetivo para ver total guardado, histórico e ajustes.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {piggies.length === 0 ? (
                <div className="md:col-span-2 w-full rounded-2xl border border-dashed border-border/70 bg-background/70 p-6 text-center text-sm text-muted-foreground">
                  Nenhuma meta criada ainda.
                  <br />
                  Use o botão &quot;Criar meta&quot; para começar sua primeira reserva.
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
                        <p className="mt-1 text-xs text-muted-foreground">Total guardado: {formatCurrency(piggy.totalSaved)}</p>
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
              <CardTitle>Atalhos</CardTitle>
              <CardDescription>Comece mais rápido usando um tipo de meta já sugerido.</CardDescription>
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
                    <div>
                      <p className="text-sm font-semibold text-foreground">{goal.label}</p>
                      <p className="text-xs text-muted-foreground">{goal.description}</p>
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
