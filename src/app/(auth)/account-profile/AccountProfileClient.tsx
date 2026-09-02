"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BriefcaseBusiness, CheckCircle2, Home, Loader2, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { usePlatformTour } from "@/hooks/usePlatformTour";
import { useI18n } from "@/i18n/I18nProvider";
import { useTranslations } from "@/i18n/T";
import { getDefaultCurrencyForLocale } from "@/lib/money/formatMoney";
import { canPlanUseProfile } from "@/lib/plans/catalog";
import { canAccessAdminArea } from "@/lib/access-control/roles";
import { createWorkspace, setActiveWorkspaceId } from "@/services/workspaceService";
import { toFinancialProfileType, type WorkspaceType } from "@/types/workspace";

const OPTIONS: Array<{
  type: WorkspaceType;
  title: string;
  description: string;
  suggestions: string[];
  icon: typeof WalletCards;
  accent: string;
}> = [
  {
    type: "personal",
    title: "Uso pessoal",
    description: "Para organizar seu salário, gastos, cartões, metas e vida financeira individual.",
    suggestions: ["Meu dinheiro", "Finanças pessoais"],
    icon: WalletCards,
    accent: "from-emerald-500/15 to-teal-500/10 text-emerald-700",
  },
  {
    type: "family",
    title: "Família",
    description: "Para organizar as finanças da casa com outras pessoas, como casal ou família.",
    suggestions: ["Casa", "Família"],
    icon: Home,
    accent: "from-amber-500/15 to-orange-500/10 text-amber-700",
  },
  {
    type: "business",
    title: "Business/PJ",
    description: "Para controlar MEI, CNPJ, igreja, projeto profissional, loja, prestação de serviço ou pequeno negócio.",
    suggestions: ["Meu negócio", "MEI", "Minha empresa", "Projeto profissional"],
    icon: BriefcaseBusiness,
    accent: "from-fuchsia-500/15 to-pink-500/10 text-fuchsia-700",
  },
];

function stripCnpj(value: string) {
  return value.replace(/\D/g, "").slice(0, 14);
}

function formatCnpj(value: string) {
  const digits = stripCnpj(value);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function AccountProfileClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useI18n();
  const { userProfile } = useAuth();
  const { status: onboardingStatus, loading: onboardingLoading, completeTour } = useOnboarding();
  const tProfile = useTranslations("accountProfile");
  const tCommon = useTranslations("common");
  const [selectedType, setSelectedType] = useState<WorkspaceType>("personal");
  const [profileName, setProfileName] = useState("Meu dinheiro");
  const [wantsCnpj, setWantsCnpj] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCreatingAdditionalWorkspace = searchParams.get("create") === "1";
  const shouldForceTour = searchParams.get("tour") === "1";

  usePlatformTour({
    route: "account-profile",
    disabled: onboardingLoading,
    hasSeen: onboardingStatus.tourCompleted,
    forceStart: shouldForceTour,
    onComplete: completeTour,
  });

  const currentPlan = userProfile?.plan || "free";
  const isStaff = canAccessAdminArea(userProfile);
  const availableOptions = useMemo(
    () => OPTIONS.filter((option) => isStaff || canPlanUseProfile(currentPlan, toFinancialProfileType(option.type))),
    [currentPlan, isStaff],
  );
  const selectedTypeAllowed = isStaff || canPlanUseProfile(currentPlan, toFinancialProfileType(selectedType));
  const selectedOption = useMemo(
    () => {
      if (selectedTypeAllowed) return OPTIONS.find((option) => option.type === selectedType) || OPTIONS[0];
      return availableOptions[0] || OPTIONS[0];
    },
    [availableOptions, selectedType, selectedTypeAllowed],
  );

  const getRestrictionMessage = (type: WorkspaceType) => {
    const profileType = toFinancialProfileType(type);
    if (profileType === "family") return "Esse perfil faz parte do plano Família.";
    if (profileType === "business") return "Esse perfil faz parte do plano Business/PJ.";
    return "Esse perfil não está disponível no seu plano atual.";
  };

  const handleSelectType = (type: WorkspaceType) => {
    const option = OPTIONS.find((item) => item.type === type) || OPTIONS[0];
    if (!isStaff && !canPlanUseProfile(currentPlan, toFinancialProfileType(type))) {
      setError(getRestrictionMessage(type));
      return;
    }
    setSelectedType(type);
    setProfileName(option.suggestions[0]);
    setError(null);
    if (type !== "business") {
      setWantsCnpj(false);
      setCnpj("");
    }
  };

  const handleContinue = async () => {
    if (!isStaff && !canPlanUseProfile(currentPlan, toFinancialProfileType(selectedOption.type))) {
      setError(getRestrictionMessage(selectedOption.type));
      return;
    }
    const cleanedCnpj = stripCnpj(cnpj);
    if (selectedOption.type !== "business" && cleanedCnpj) {
      setError("Para controlar um negócio, MEI, igreja, projeto profissional ou qualquer atividade com CNPJ, use o perfil Business/PJ.");
      return;
    }
    if (selectedOption.type === "business" && wantsCnpj && cleanedCnpj.length !== 14) {
      setError("Confira o CNPJ informado. Ele precisa ter 14 números.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const workspace = await createWorkspace({
        name: profileName.trim() || selectedOption.suggestions[0],
        type: selectedOption.type,
        isDefault: !isCreatingAdditionalWorkspace,
        settings: {
          currency: getDefaultCurrencyForLocale(locale),
          monthlyReportEnabled: true,
          categoriesPresetApplied: true,
          familyModeEnabled: selectedOption.type === "family",
          businessDocument: selectedOption.type === "business" && cleanedCnpj ? cleanedCnpj : undefined,
        },
      });
      setActiveWorkspaceId(workspace.id);
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tProfile("createError"));
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-[calc(100svh-5rem)] px-4 py-10 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section id="tour-account-profile-header" className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <CheckCircle2 className="h-4 w-4" />
            {tProfile("badge")}
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
              Como você quer usar o WevenFinance?
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Escolha o perfil financeiro antes de começar. Isso ajuda o sistema a separar seus dados, categorias e limites do jeito certo.
            </p>
          </div>
          {userProfile?.displayName ? (
            <p className="text-sm font-medium text-muted-foreground">{tProfile("greeting", { name: userProfile.displayName })}</p>
          ) : null}
        </section>

        <section id="tour-account-profile-options" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = option.type === selectedOption.type;
            const allowed = isStaff || canPlanUseProfile(currentPlan, toFinancialProfileType(option.type));
            return (
              <button
                key={option.type}
                type="button"
                onClick={() => handleSelectType(option.type)}
                disabled={submitting || !allowed}
                className={`group min-h-[150px] rounded-2xl border p-1 text-left transition-all duration-300 ${
                  selected
                    ? "border-primary/60 bg-primary/10 shadow-xl shadow-primary/10"
                    : allowed
                      ? "border-border/80 bg-card/80 hover:border-primary/35 hover:bg-accent/60"
                      : "border-border/60 bg-muted/45 opacity-75"
                }`}
              >
                <Card className="h-full rounded-xl border-0 bg-transparent shadow-none">
                  <CardContent className="flex h-full flex-col gap-5 p-5">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br ${option.accent}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-lg font-bold text-foreground">{option.title}</h2>
                      <p className="text-sm leading-relaxed text-muted-foreground">{option.description}</p>
                    </div>
                    <div className={`mt-auto flex items-center gap-2 text-sm font-semibold ${allowed ? "text-primary" : "text-muted-foreground"}`}>
                      <span>{allowed ? (selected ? tProfile("selected") : tProfile("choose")) : getRestrictionMessage(option.type)}</span>
                      {selected && allowed ? <CheckCircle2 className="h-4 w-4" /> : null}
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-2xl border border-border/80 bg-card/80 p-5">
            <h2 className="text-xl font-bold text-foreground">Dê um nome para este perfil</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Esse nome aparece no topo do sistema e ajuda você a separar melhor suas finanças. Você pode alterar depois.
            </p>
            <label className="mt-5 block text-sm font-semibold text-foreground" htmlFor="profile-name">
              Nome do perfil
            </label>
            <Input
              id="profile-name"
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              placeholder={selectedOption.suggestions[0]}
              className="mt-2 h-11 rounded-xl"
              maxLength={60}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedOption.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setProfileName(suggestion)}
                  className="rounded-full border border-border/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/80 p-5">
            {selectedOption.type === "business" ? (
              <>
                <h2 className="text-xl font-bold text-foreground">Você quer informar um CNPJ agora?</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  O CNPJ é opcional, mas ajuda a identificar relatórios e organizar melhor seu perfil profissional.
                </p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant={wantsCnpj ? "default" : "outline"} onClick={() => setWantsCnpj(true)} className="rounded-xl">
                    Sim, informar CNPJ
                  </Button>
                  <Button type="button" variant={!wantsCnpj ? "default" : "outline"} onClick={() => setWantsCnpj(false)} className="rounded-xl">
                    Agora não
                  </Button>
                </div>
                {wantsCnpj ? (
                  <div className="mt-4">
                    <label className="text-sm font-semibold text-foreground" htmlFor="business-cnpj">
                      CNPJ
                    </label>
                    <Input
                      id="business-cnpj"
                      value={formatCnpj(cnpj)}
                      onChange={(event) => setCnpj(formatCnpj(event.target.value))}
                      inputMode="numeric"
                      placeholder="00.000.000/0000-00"
                      className="mt-2 h-11 rounded-xl"
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-foreground">Perfil sem CNPJ</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Para controlar um negócio, MEI, igreja, projeto profissional ou qualquer atividade com CNPJ, escolha Business/PJ.
                </p>
              </>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Você pode criar outros perfis depois e alternar entre eles pelo menu de perfis.
          </p>
          <Button id="tour-account-profile-submit" className="h-12 rounded-xl px-8 text-base font-semibold" onClick={handleContinue} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tProfile("preparing")}
              </>
            ) : (
              tCommon("continue")
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
