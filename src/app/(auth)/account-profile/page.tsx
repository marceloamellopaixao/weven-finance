"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, Building2, CheckCircle2, Home, Loader2, UsersRound, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useUiText } from "@/i18n/T";
import { createWorkspace } from "@/services/workspaceService";
import type { WorkspaceType } from "@/types/workspace";

const OPTIONS: Array<{
  type: WorkspaceType;
  title: string;
  description: string;
  icon: typeof WalletCards;
  accent: string;
}> = [
  {
    type: "personal",
    title: "Perfil pessoal",
    description: "Controle salário, gastos, cartões, metas, dívidas e limite diário inteligente.",
    icon: WalletCards,
    accent: "from-emerald-500/15 to-teal-500/10 text-emerald-700",
  },
  {
    type: "professional",
    title: "Perfil profissional / autônomo",
    description: "Controle receitas de clientes, despesas de trabalho, impostos, caixa mensal e relatórios.",
    icon: BriefcaseBusiness,
    accent: "from-sky-500/15 to-cyan-500/10 text-sky-700",
  },
  {
    type: "church",
    title: "Perfil igreja / ministério",
    description: "Controle dízimos, ofertas, missões, cantina, departamentos, eventos e despesas por área.",
    icon: Building2,
    accent: "from-violet-500/15 to-indigo-500/10 text-violet-700",
  },
  {
    type: "family",
    title: "Perfil família / casa",
    description: "Controle contas compartilhadas, mercado, aluguel, escola, transporte e metas familiares.",
    icon: Home,
    accent: "from-amber-500/15 to-orange-500/10 text-amber-700",
  },
  {
    type: "business",
    title: "Perfil pequeno negócio",
    description: "Controle vendas, custos, contas a pagar e receber, fluxo de caixa e lucro estimado.",
    icon: UsersRound,
    accent: "from-fuchsia-500/15 to-pink-500/10 text-fuchsia-700",
  },
];

export default function AccountProfilePage() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const tt = useUiText();
  const [selectedType, setSelectedType] = useState<WorkspaceType>("personal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedOption = useMemo(
    () => OPTIONS.find((option) => option.type === selectedType) || OPTIONS[0],
    [selectedType]
  );

  const handleContinue = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await createWorkspace({
        name: selectedOption.title,
        type: selectedOption.type,
        isDefault: true,
        settings: {
          currency: "BRL",
          monthlyReportEnabled: true,
          categoriesPresetApplied: true,
        },
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tt("Não foi possível criar o perfil da conta"));
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-[calc(100svh-5rem)] px-4 py-10 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <CheckCircle2 className="h-4 w-4" />
            {tt("Selecione seu perfil de uso para começarmos!")}
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
              {tt("Como você quer organizar o WevenFinance?")}
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {tt("Vamos preparar categorias, relatórios e atalhos para o jeito que você usa dinheiro no dia a dia.")}
            </p>
          </div>
          {userProfile?.displayName ? (
            <p className="text-sm font-medium text-muted-foreground">{tt("Olá, {name}. Escolha uma opção para continuar.", { name: userProfile.displayName })}</p>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = option.type === selectedType;
            return (
              <button
                key={option.type}
                type="button"
                onClick={() => setSelectedType(option.type)}
                disabled={submitting}
                className={`group min-h-[150px] rounded-2xl border p-1 text-left transition-all duration-300 ${
                  selected
                    ? "border-primary/60 bg-primary/10 shadow-xl shadow-primary/10"
                    : "border-border/80 bg-card/80 hover:border-primary/35 hover:bg-accent/60"
                }`}
              >
                <Card className="h-full rounded-xl border-0 bg-transparent shadow-none">
                  <CardContent className="flex h-full flex-col gap-5 p-5">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br ${option.accent}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-lg font-bold text-foreground">{tt(option.title)}</h2>
                      <p className="text-sm leading-relaxed text-muted-foreground">{tt(option.description)}</p>
                    </div>
                    <div className="mt-auto flex items-center gap-2 text-sm font-semibold text-primary">
                      <span>{selected ? tt("Selecionado") : tt("Escolher")}</span>
                      {selected ? <CheckCircle2 className="h-4 w-4" /> : null}
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm text-muted-foreground">
            {tt("Você poderá criar outros perfis depois. Este será usado como padrão para relatórios mensais e categorias iniciais.")}
          </p>
          <Button className="h-12 rounded-xl px-8 text-base font-semibold" onClick={handleContinue} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tt("Preparando...")}
              </>
            ) : (
              tt("Continuar")
            )}
          </Button>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : null}
      </div>
    </main>
  );
}
