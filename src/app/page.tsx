"use client";

import { useState } from "react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ShieldCheck, Zap, ArrowRight, Smartphone, Medal, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePlans } from "@/hooks/usePlans";
import { useAuth } from "@/hooks/useAuth";
import { buildUpgradeCheckoutPath, rememberPendingUpgradePlan } from "@/services/billing/checkoutIntent";
import { clearPostAuthRedirect, readPostAuthRedirect } from "@/services/auth/postAuthRedirect";

export default function LandingPage() {
  const { plans, loading: plansLoading } = usePlans();
  const { user, userProfile, loading: authLoading } = useAuth();
  const [isOpeningCheckout, setIsOpeningCheckout] = useState<"premium" | "pro" | null>(null);

  // Constantes de Animação (Padrão do Sistema)
  const fadeInUp = "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both";
  const zoomIn = "animate-in fade-in zoom-in-50 duration-500 fill-mode-both";

  useEffect(() => {
    if (authLoading || !userProfile) return;
    const postAuthRedirect = readPostAuthRedirect();
    if (!postAuthRedirect) return;
    clearPostAuthRedirect();
    window.location.replace(postAuthRedirect);
  }, [authLoading, userProfile]);

  // Estado de carregamento elegante
  if (plansLoading || authLoading) {
    return (
      <div className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center gap-4 bg-transparent">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasSession = Boolean(user || userProfile);
  const primaryHref = hasSession ? "/dashboard" : "/register";
  const primaryLabel = hasSession ? "Abrir Meu Painel" : "Começar Grátis";

  const handlePlanCheckout = async (plan: "premium" | "pro") => {
    if (!user) {
      rememberPendingUpgradePlan(plan);
      window.location.assign(`/register?upgrade_plan=${plan}`);
      return;
    }

    setIsOpeningCheckout(plan);
    try {
      rememberPendingUpgradePlan(plan);
      window.location.assign(buildUpgradeCheckoutPath(plan));
    } catch (error) {
      console.error("Erro ao iniciar checkout:", error);
    } finally {
      setIsOpeningCheckout(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-transparent font-sans text-foreground selection:bg-primary/15 selection:text-foreground transition-colors duration-300">

      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 pb-12 pt-24 sm:px-6 sm:pb-20 sm:pt-32 lg:pb-24 lg:pt-40">
        {/* Glow Effects */}
        <div className="absolute top-20 left-1/2 -z-10 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 -z-10 h-[360px] w-[360px] rounded-full bg-primary/5 blur-[100px]" />

        <div className="container mx-auto max-w-4xl space-y-6 text-center sm:space-y-8">
          <div className={`${zoomIn}`}>
            <Badge variant="outline" className="max-w-full whitespace-normal rounded-full border-primary/20 bg-primary/10 px-4 py-1.5 text-center text-xs font-medium leading-relaxed text-primary shadow-sm backdrop-blur-md sm:text-sm">
              Feito para quem quer sair do caos financeiro com clareza.
            </Badge>
          </div>

          <h1 className={`${fadeInUp} delay-150 text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-7xl`}>
            Pare de terminar o mês <br />
            <span className="bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">sem saber para onde o dinheiro foi.</span>
          </h1>

          <p className={`${fadeInUp} delay-200 mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl`}>
            O WevenFinance organiza gastos, cartões, parcelamentos, vencimentos e metas em um lugar simples, para você entender o mês sem planilha e sem ansiedade.
          </p>

          <div className={`${fadeInUp} delay-300 flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row sm:gap-4 sm:pt-4`}>
            <Link href={primaryHref} className="w-full sm:w-auto">
              <Button size="lg" className="h-12 w-full rounded-full bg-primary px-8 text-base text-primary-foreground shadow-xl shadow-primary/20 transition-transform duration-200 hover:-translate-y-1 hover:scale-105 hover:bg-primary/90 hover:cursor-pointer sm:h-14 sm:w-auto sm:text-lg">
                {primaryLabel} <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="h-12 w-full rounded-full border-color:var(--app-panel-border) px-8 text-base text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground hover:cursor-pointer sm:h-14 sm:w-auto sm:text-lg" asChild>
              <a href="#pricing">Ver Preços</a>
            </Button>
          </div>

          <div className={`${fadeInUp} delay-400 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground sm:flex-row sm:gap-3`}>
            <span className="rounded-full border border-color:var(--app-panel-border) bg-card/70 px-4 py-2 backdrop-blur">Entenda o que vence</span>
            <span className="rounded-full border border-color:var(--app-panel-border) bg-card/70 px-4 py-2 backdrop-blur">Controle cartões e parcelas</span>
            <span className="rounded-full border border-color:var(--app-panel-border) bg-card/70 px-4 py-2 backdrop-blur">Saiba quanto ainda pode gastar</span>
          </div>

          {/* Dashboard Preview Mockup */}
          <div className={`${fadeInUp} delay-500 group relative mx-auto mt-8 aspect-[1.45/1] max-w-5xl overflow-hidden rounded-2xl border border-color:var(--app-panel-border) bg-card/50 shadow-2xl shadow-primary/10 backdrop-blur-sm sm:mt-12 sm:aspect-video`}>
            <div className="absolute inset-0 z-10 bg-linear-to-t from-background via-transparent to-transparent" />
            {/* Abstract UI representation */}
            <div className="absolute inset-4 grid grid-cols-[0.85fr_1.15fr] gap-3 opacity-60 transition-opacity duration-700 group-hover:opacity-100 sm:inset-6 sm:grid-cols-3 sm:gap-6">
              <div className="grid min-h-0 grid-rows-[0.8fr_0.8fr_1.2fr] gap-3 sm:col-span-1 sm:gap-4">
                <div className="min-h-0 rounded-xl border border-color:var(--app-panel-border) bg-primary/15" />
                <div className="min-h-0 rounded-xl border border-color:var(--app-panel-border) bg-primary/10" />
                <div className="min-h-0 rounded-xl border border-color:var(--app-panel-border) bg-muted/60" />
              </div>
              <div className="grid min-h-0 grid-rows-[1.45fr_0.75fr] gap-3 sm:col-span-2 sm:gap-4">
                <div className="flex min-h-0 items-center justify-center rounded-xl border border-color:var(--app-panel-border) bg-muted/60 font-mono text-xs text-muted-foreground sm:text-sm">
                  <span className="hidden sm:inline">Gráfico Interativo</span>
                </div>
                <div className="min-h-0 rounded-xl border border-color:var(--app-panel-border) bg-primary/10" />
              </div>
            </div>
            <div className="absolute bottom-4 left-1/2 z-20 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 sm:bottom-10 sm:w-auto sm:max-w-none">
              <p className="rounded-full border border-color:var(--app-panel-border) bg-card/80 px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-md sm:px-4 sm:text-sm">Clareza para agir hoje, não só para olhar números.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Grid de Benefícios */}
      <section className="border-y border-border/70 bg-muted/30 py-20 sm:py-24" id="features">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">O que muda quando você usa o WevenFinance</h2>
            <p className="text-muted-foreground">Menos desorganização, menos ansiedade e mais direção sobre o seu mês.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            <Card className="app-panel-soft group border-color:var(--app-panel-border) shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <ShieldCheck className="h-6 w-6 transition-transform group-hover:scale-110" />
                </div>
                <CardTitle className="text-foreground">Visão clara do mês</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  Veja entradas, saídas e previsão de fechamento em uma interface que ajuda você a entender o mês sem depender de planilhas.
                </p>
              </CardContent>
            </Card>

            <Card className="app-panel-soft group border-color:var(--app-panel-border) shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <Zap className="h-6 w-6 transition-transform group-hover:scale-110" />
                </div>
                <CardTitle className="text-foreground">Cartões, parcelas e vencimentos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  Organize o que vence, acompanhe parcelamentos e mantenha seus cartões sob controle antes que o mês aperte.
                </p>
              </CardContent>
            </Card>

            <Card className="app-panel-soft group border-color:var(--app-panel-border) shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <Smartphone className="h-6 w-6 transition-transform group-hover:scale-110" />
                </div>
                <CardTitle className="text-foreground">Feito para a vida real</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  Lance ganhos e gastos em segundos pelo celular e mantenha o controle mesmo nos dias corridos.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="relative px-4 py-20 sm:px-6 sm:py-24" id="pricing">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 space-y-4">
            <Badge className="mb-2 border-primary/20 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/15">Escada de Valor Clara</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Free para registrar. Premium para organizar. Pro para decidir.</h2>
            <p className="text-lg text-muted-foreground">
              Comece no básico, suba quando precisar de mais controle e chegue no Pro quando quiser direção diária.
            </p>
          </div>

          <div className="mx-auto grid max-w-6xl items-stretch gap-5 md:grid-cols-3 md:items-center">

            {/* PLANO FREE */}
            {plans.free.active && (
              <Card className="app-panel-subtle z-0 rounded-4xl border-color:var(--app-panel-border) shadow-sm transition-all duration-300 hover:border-primary/25 hover:shadow-md md:scale-90 md:hover:scale-95">
                <CardHeader className="p-8 pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-xl font-bold  flex items-center gap-2">
                      {plans.free.name} <Medal className="h-5 w-5" />
                    </CardTitle>
                    <Badge variant="outline" className="border-border/80">Registrar</Badge>
                  </div>
                  <CardDescription>{plans.free.description}</CardDescription>
                  <div className="pt-6 pb-2">
                    <span className="text-4xl font-bold ">R$ {plans.free.price}</span>
                  </div>
                </CardHeader>
                <CardContent className="p-8 pt-6 space-y-4">
                  <ul className="space-y-3 text-sm">
                    {plans.free.features.map((feature, i) => (
                      <li key={i} className="flex gap-3"><CheckCircle2 className="h-5 w-5" /> {feature}</li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="p-8 pt-0">
                  <Link href={primaryHref} className="w-full">
                    <Button className="h-12 w-full rounded-2xl border border-color:var(--app-panel-border) bg-card text-foreground shadow-sm transition-all duration-200 hover:scale-105 hover:bg-accent active:scale-95">
                      {hasSession ? "Abrir painel" : "Começar no Free"}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            )}

            {/* PLANO PREMIUM */}
            {plans.premium.active && (
              <Card className="app-panel-soft relative z-10 rounded-4xl border-2 border-primary/35 shadow-2xl shadow-primary/15 md:scale-105 lg:scale-110">
                <div className="absolute left-0 top-0 h-10 w-full rounded-t-4xl bg-primary">
                  <CardTitle className="flex h-full w-full items-center justify-center text-xs font-bold uppercase tracking-widest text-primary-foreground">Recomendado</CardTitle>
                </div>
                <CardHeader className="p-8 pb-0 mt-6">
                  <div className="flex justify-between items-center mb-2">
                    <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                      {plans.premium.name} <Medal className="h-5 w-5 text-primary" />
                    </CardTitle>
                    <Badge className="border-none bg-primary/10 text-primary hover:bg-primary/15">Organizar</Badge>
                  </div>
                  <CardDescription className="text-muted-foreground">{plans.premium.description}</CardDescription>
                  <div className="pt-6 pb-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">R$ {plans.premium.price}</span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>
                </CardHeader>
                <CardContent className="p-8 pt-6 space-y-4">
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    {plans.premium.features.map((feature, i) => (
                      <li key={i} className="flex gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> {feature}</li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="p-8 pt-0">
                  <Button
                    className="h-12 w-full rounded-2xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-200 hover:scale-105 hover:bg-primary/90 active:scale-95"
                    disabled={isOpeningCheckout !== null}
                    onClick={() => void handlePlanCheckout("premium")}
                  >
                    {isOpeningCheckout === "premium" ? "Abrindo checkout..." : "Ir para o Premium"}
                  </Button>
                </CardFooter>
              </Card>
            )}

            {/* PLANO PRO */}
            {plans.pro.active && (
              <Card className="app-panel-subtle z-0 rounded-4xl border-color:var(--app-panel-border) shadow-sm transition-all duration-300 hover:border-primary/25 hover:shadow-md md:scale-90 md:hover:scale-95">
                <CardHeader className="p-8 pb-0">
                  <div className="flex justify-between items-center mb-2">
                    <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                      {plans.pro.name} <Medal className="h-5 w-5 text-primary" />
                    </CardTitle>
                    <Badge variant="outline" className="border-primary/25 text-primary">Decidir</Badge>
                  </div>
                  <CardDescription className="text-muted-foreground">{plans.pro.description}</CardDescription>
                  <div className="pt-6 pb-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">R$ {plans.pro.price}</span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>
                </CardHeader>
                <CardContent className="p-8 pt-6 space-y-4">
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    {plans.pro.features.map((feature, i) => (
                      <li key={i} className="flex gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> {feature}</li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="p-8 pt-0">
                  <Button
                    className="h-12 w-full rounded-2xl border border-color:var(--app-panel-border) bg-card text-foreground shadow-sm transition-all duration-200 hover:scale-105 hover:bg-accent active:scale-95"
                    variant="outline"
                    disabled={isOpeningCheckout !== null}
                    onClick={() => void handlePlanCheckout("pro")}
                  >
                    {isOpeningCheckout === "pro" ? "Abrindo checkout..." : "Ir para o Pro"}
                  </Button>
                </CardFooter>
              </Card>
            )}
          </div>

          <div className="mt-16 text-center">
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-5 w-5 text-primary" /> Pagamento seguro processado por Mercado Pago
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
