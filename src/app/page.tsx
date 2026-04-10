"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ShieldCheck, Zap, ArrowRight, Smartphone, Medal, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePlans } from "@/hooks/usePlans";
import { useAuth } from "@/hooks/useAuth";
import { buildUpgradeCheckoutPath, rememberPendingUpgradePlan } from "@/services/billing/checkoutIntent";
import { getCheckoutLink } from "@/services/billingService";

export default function LandingPage() {
  const { plans, loading: plansLoading } = usePlans();
  const { user, userProfile, loading: authLoading } = useAuth();
  const [isOpeningCheckout, setIsOpeningCheckout] = useState<"premium" | "pro" | null>(null);

  // Constantes de Animação (Padrão do Sistema)
  const fadeInUp = "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both";
  const zoomIn = "animate-in fade-in zoom-in-50 duration-500 fill-mode-both";

  // Estado de carregamento elegante
  if (plansLoading || authLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
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
      const token = await user.getIdToken();
      rememberPendingUpgradePlan(plan);
      const session = await getCheckoutLink(plan, token);
      window.location.assign(session.checkoutUrl || buildUpgradeCheckoutPath(plan));
    } catch (error) {
      console.error("Erro ao iniciar checkout:", error);
    } finally {
      setIsOpeningCheckout(null);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-zinc-900 selection:bg-violet-100 selection:text-violet-900 transition-all duration-800 flex flex-col">

      {/* Hero Section */}
      <section className="pt-40 pb-24 px-6 relative overflow-hidden flex-1">
        {/* Glow Effects */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet-100/50 rounded-full blur-[120px] -z-10" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-50/50 rounded-full blur-[100px] -z-10" />

        <div className="container mx-auto text-center max-w-4xl space-y-8">
          <div className={`${zoomIn}`}>
            <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700 px-4 py-1.5 rounded-full text-sm font-medium backdrop-blur-md shadow-sm">
              Feito para quem quer sair do caos financeiro com clareza.
            </Badge>
          </div>

          <h1 className={`${fadeInUp} delay-150 text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] text-zinc-900`}>
            Pare de terminar o mês <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-violet-600 to-indigo-600">sem saber para onde o dinheiro foi.</span>
          </h1>

          <p className={`${fadeInUp} delay-200 text-xl text-zinc-500 max-w-2xl mx-auto leading-relaxed`}>
            O WevenFinance organiza gastos, cartões, parcelamentos, vencimentos e metas em um lugar simples, para você entender o mês sem planilha e sem ansiedade.
          </p>

          <div className={`${fadeInUp} delay-300 flex flex-col sm:flex-row items-center justify-center gap-4 pt-6`}>
            <Link href={primaryHref} className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto rounded-full h-14 px-8 text-lg bg-violet-600 hover:bg-violet-700 text-white shadow-xl shadow-violet-200 transition-all hover:scale-105 hover:-translate-y-1 hover:cursor-pointer duration-200">
                {primaryLabel} <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full h-14 px-8 text-lg border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-300 transition-all hover:cursor-pointer duration-200" asChild>
              <a href="#pricing">Ver Preços</a>
            </Button>
          </div>

          <div className={`${fadeInUp} delay-400 flex flex-col sm:flex-row items-center justify-center gap-3 text-sm text-zinc-500`}>
            <span className="rounded-full border border-zinc-200 bg-white/70 px-4 py-2">Entenda o que vence</span>
            <span className="rounded-full border border-zinc-200 bg-white/70 px-4 py-2">Controle cartões e parcelas</span>
            <span className="rounded-full border border-zinc-200 bg-white/70 px-4 py-2">Saiba quanto ainda pode gastar</span>
          </div>

          {/* Dashboard Preview Mockup */}
          <div className={`${fadeInUp} delay-500 mt-16 relative mx-auto max-w-5xl rounded-2xl border border-zinc-200 bg-white/50 backdrop-blur-sm shadow-2xl shadow-zinc-200/50 overflow-hidden aspect-video group`}>
            <div className="absolute inset-0 bg-linear-to-t from-white via-transparent to-transparent z-10" />
            {/* Abstract UI representation */}
            <div className="p-6 grid grid-cols-3 gap-6 h-full opacity-60 group-hover:opacity-100 transition-opacity duration-700">
              <div className="col-span-1 space-y-4 pt-8 pl-4">
                <div className="h-24 w-full bg-zinc-600 rounded-xl border border-zinc-100" />
                <div className="h-24 w-full bg-zinc-600 rounded-xl border border-zinc-100" />
                <div className="h-40 w-full bg-zinc-600 rounded-xl border border-zinc-100" />
              </div>
              <div className="col-span-2 space-y-4 pt-8 pr-4">
                <div className="h-64 w-full bg-zinc-600 rounded-xl border border-zinc-100 flex items-center justify-center text-zinc-300 font-mono text-sm">
                  Gráfico Interativo
                </div>
                <div className="h-32 w-full bg-zinc-600 rounded-xl border border-zinc-100" />
              </div>
            </div>
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20">
              <p className="text-zinc-500 text-sm font-medium bg-white/70 px-4 py-2 rounded-full shadow-sm backdrop-blur-md">Clareza para agir hoje, não só para olhar números.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Grid de Benefícios */}
      <section className="py-24 bg-zinc-50 border-y border-zinc-100" id="features">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-zinc-900">O que muda quando você usa o WevenFinance</h2>
            <p className="text-zinc-500">Menos desorganização, menos ansiedade e mais direção sobre o seu mês.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-white border-zinc-100 shadow-sm hover:shadow-xl hover:shadow-violet-100/50 hover:border-violet-100 transition-all duration-300 group">
              <CardHeader>
                <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-violet-50 transition-colors">
                  <ShieldCheck className="h-6 w-6 text-zinc-400 group-hover:text-violet-500 transition-colors" />
                </div>
                <CardTitle className="text-zinc-900">Visão clara do mês</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-500 leading-relaxed">
                  Veja entradas, saídas e previsão de fechamento em uma interface que ajuda você a entender o mês sem depender de planilhas.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border-zinc-100 shadow-sm hover:shadow-xl hover:shadow-blue-100/50 hover:border-blue-100 transition-all duration-300 group">
              <CardHeader>
                <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-50 transition-colors">
                  <Zap className="h-6 w-6 text-zinc-400 group-hover:text-blue-500 transition-colors" />
                </div>
                <CardTitle className="text-zinc-900">Cartões, parcelas e vencimentos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-500 leading-relaxed">
                  Organize o que vence, acompanhe parcelamentos e mantenha seus cartões sob controle antes que o mês aperte.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border-zinc-100 shadow-sm hover:shadow-xl hover:shadow-emerald-100/50 hover:border-emerald-100 transition-all duration-300 group">
              <CardHeader>
                <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-50 transition-colors">
                  <Smartphone className="h-6 w-6 text-zinc-400 group-hover:text-emerald-500 transition-colors" />
                </div>
                <CardTitle className="text-zinc-900">Feito para a vida real</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-500 leading-relaxed">
                  Lance ganhos e gastos em segundos pelo celular e mantenha o controle mesmo nos dias corridos.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 px-6 relative bg-white" id="pricing">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 space-y-4">
            <Badge className="bg-violet-50 text-violet-600 hover:bg-violet-100 border-violet-100 mb-2 px-3 py-1">Escada de Valor Clara</Badge>
            <h2 className="text-4xl font-bold tracking-tight text-zinc-900">Free para registrar. Premium para organizar. Pro para decidir.</h2>
            <p className="text-zinc-500 text-lg">
              Comece no básico, suba quando precisar de mais controle e chegue no Pro quando quiser direção diária.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 items-center max-w-6xl mx-auto">

            {/* PLANO FREE */}
            {plans.free.active && (
              <Card className="app-panel-subtle shadow-sm hover:border-primary/20 hover:shadow-md transition-all rounded-4xl scale-90 hover:scale-95 z-0 duration-300">
                <CardHeader className="p-8 pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-xl font-bold  flex items-center gap-2">
                      {plans.free.name} <Medal className="h-5 w-5" />
                    </CardTitle>
                    <Badge variant="outline" className="border-zinc-200">Registrar</Badge>
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
                    <Button className="w-full rounded-2xl h-12 bg-white hover:bg-zinc-50  border border-zinc-200 shadow-sm font-medium transition-all hover:scale-105 active:scale-95 hover:cursor-pointer duration-200">
                      {hasSession ? "Abrir painel" : "Começar no Free"}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            )}

            {/* PLANO PREMIUM */}
            {plans.premium.active && (
              <Card className="bg-white border-violet-200 shadow-2xl shadow-violet-200/50 rounded-4xl relative scale-110 z-10 border-2">
                <div className="absolute top-0 left-0 w-full h-10 bg-linear-to-r from-violet-500 to-indigo-500 rounded-t-4xl" >
                  <CardTitle className="flex justify-center items-center w-full h-full text-white text-xs uppercase tracking-widest font-bold">Recomendado</CardTitle>
                </div>
                <CardHeader className="p-8 pb-0 mt-6">
                  <div className="flex justify-between items-center mb-2">
                    <CardTitle className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                      {plans.premium.name} <Medal className="h-5 w-5 text-violet-500 fill-violet-100" />
                    </CardTitle>
                    <Badge className="bg-violet-100 text-violet-600 hover:bg-violet-200 border-none">Organizar</Badge>
                  </div>
                  <CardDescription className="text-zinc-500">{plans.premium.description}</CardDescription>
                  <div className="pt-6 pb-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-zinc-900">R$ {plans.premium.price}</span>
                    <span className="text-zinc-400 text-sm">/mês</span>
                  </div>
                </CardHeader>
                <CardContent className="p-8 pt-6 space-y-4">
                  <ul className="space-y-3 text-sm text-zinc-600">
                    {plans.premium.features.map((feature, i) => (
                      <li key={i} className="flex gap-3"><CheckCircle2 className="h-5 w-5 text-violet-500 shrink-0" /> {feature}</li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="p-8 pt-0">
                  <Button
                    className="w-full rounded-2xl bg-violet-600 text-white hover:bg-violet-700 font-bold h-12 shadow-lg shadow-violet-200 transition-all hover:scale-105 active:scale-95 hover:cursor-pointer duration-200"
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
              <Card className="bg-white border-zinc-200 shadow-sm hover:shadow-md hover:border-amber-400 hover:shadow-amber-100/50 transition-all rounded-4xl scale-90 hover:scale-95 z-0 duration-300">
                <CardHeader className="p-8 pb-0">
                  <div className="flex justify-between items-center mb-2">
                    <CardTitle className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                      {plans.pro.name} <Medal className="h-5 w-5 text-emerald-500" />
                    </CardTitle>
                    <Badge variant="outline" className="text-emerald-600 border-emerald-200">Decidir</Badge>
                  </div>
                  <CardDescription className="text-zinc-500">{plans.pro.description}</CardDescription>
                  <div className="pt-6 pb-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-zinc-900">R$ {plans.pro.price}</span>
                    <span className="text-zinc-500 text-sm">/mês</span>
                  </div>
                </CardHeader>
                <CardContent className="p-8 pt-6 space-y-4">
                  <ul className="space-y-3 text-sm text-zinc-600">
                    {plans.pro.features.map((feature, i) => (
                      <li key={i} className="flex gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" /> {feature}</li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="p-8 pt-0">
                  <Button
                    className="w-full rounded-2xl h-12 border border-zinc-200 bg-white text-zinc-900 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all hover:scale-105 active:scale-95 shadow-sm hover:cursor-pointer duration-200"
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
            <p className="text-sm text-zinc-500 flex justify-center items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-zinc-400" /> Pagamento seguro processado por Mercado Pago
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
