"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
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
  { type: "emergency_reserve", label: "Reserva de Emergência", description: "Cobrir imprevistos com segurança.", icon: ShieldCheck },
  { type: "travel", label: "Fazer uma Viagem", description: "Guardar para transporte, hospedagem e passeios.", icon: Plane },
  { type: "home_renovation", label: "Reformar a Casa", description: "Separar valor para materiais e mão de obra.", icon: Home },
  { type: "dream_purchase", label: "Sonho de Consumo", description: "Chegar no seu objetivo sem bagunçar o orçamento.", icon: Sparkles },
  { type: "custom", label: "Criar Novo Objetivo", description: "Defina seu próprio porquinho.", icon: PlusCircle },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

export default function PiggyBankPage() {
  const { user, userProfile } = useAuth();
  const { status: onboardingStatus, loading: onboardingLoading } = useOnboarding();
  const [piggies, setPiggies] = useState<PiggyBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

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
        setFeedback(error instanceof Error ? error.message : "Não foi possível carregar os dados do porquinho.");
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
        <p className="text-sm text-zinc-500">Carregando cofrinho...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50/40 p-3 sm:p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 md:text-3xl">
              <PiggyBankIcon className="h-7 w-7 text-violet-600" />
              Cofrinho / Porquinho
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Acompanhe seus porquinhos e abra um novo quando quiser criar uma meta.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/porquinho/novo">
              <Button className="rounded-xl bg-violet-600 hover:bg-violet-700">
                <PlusCircle className="mr-2 h-4 w-4" />
                Criar um Cofrinho
              </Button>
            </Link>
            <Link href="/cards">
              <Button variant="outline" className="rounded-xl">Voltar para Cartões</Button>
            </Link>
          </div>
        </div>

        {feedback && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{feedback}</div>
        )}

        {!onboardingLoading && !onboardingStatus.dismissed && !onboardingStatus.steps.firstGoal && (
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
            Onboarding: crie sua primeira meta e confirme um aporte para concluir esta etapa.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="rounded-3xl md:col-span-2">
            <CardHeader>
              <CardTitle>Seus Porquinhos</CardTitle>
              <CardDescription>Acesse os porquinhos já criados para ver total e histórico.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {loading ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500">
                  Carregando porquinhos...
                </div>
              ) : piggies.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500 w-full text-center">
                  Nenhum porquinho criado ainda. 
                  <br/>
                  Use o botão &quot;Criar um Cofrinho&quot; para abrir a tela de criação.
                </div>
              ) : piggies.map((piggy) => (
                <Link
                  key={piggy.id}
                  href={`/porquinho/${piggy.slug}`}
                  className="rounded-2xl border border-zinc-200 p-4 transition-colors hover:border-violet-300 hover:bg-violet-50/40"
                >
                  <p className="font-semibold text-zinc-900">{piggy.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">Total guardado: {formatCurrency(piggy.totalSaved)}</p>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Atalhos</CardTitle>
              <CardDescription>Comece mais rápido com uma meta sugerida.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {GOAL_OPTIONS.map((goal) => {
                const Icon = goal.icon;
                return (
                  <Link
                    key={goal.type}
                    href={`/porquinho/novo?goal=${encodeURIComponent(goal.type)}`}
                    className="flex w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left transition-colors hover:cursor-pointer hover:border-violet-300 hover:bg-violet-50/40"
                  >
                    <Icon className="h-5 w-5 text-violet-600" />
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{goal.label}</p>
                      <p className="text-xs text-zinc-500">{goal.description}</p>
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
