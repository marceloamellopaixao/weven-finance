"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Wallet, ShieldCheck, Zap, ArrowRight, Lock, Smartphone, Medal, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePlans } from "@/hooks/usePlans"; // Importação do Hook

export const metadata = {
  title: "Weven Finance | Home",
  description: "Gerenciamento financeiro | Página Inicial",
  icons: {
    icon: "/wevenfinance.svg",
  },
};

export default function LandingPage() {
  const { plans, loading } = usePlans(); // Hook para buscar dados do Firestore

  // Estado de carregamento elegante
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        <p className="text-zinc-500">Carregando ofertas...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-zinc-900 selection:bg-violet-100 selection:text-violet-900 transition-all duration-800">

      {/* Hero Section */}
      <section className="pt-40 pb-24 px-6 relative overflow-hidden">
        {/* Glow Effects - Adjusted for Light Mode */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet-100/50 rounded-full blur-[120px] -z-10" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-50/50 rounded-full blur-[100px] -z-10" />

        <div className="container mx-auto text-center max-w-4xl space-y-8">
          <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700 px-4 py-1.5 rounded-full text-sm font-medium backdrop-blur-md shadow-sm">
            🔒 Seus dados financeiros, 100% criptografados.
          </Badge>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] text-zinc-900">
            O fim das planilhas <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-violet-600 to-indigo-600">financeiras complicadas.</span>
          </h1>

          <p className="text-xl text-zinc-500 max-w-2xl mx-auto leading-relaxed">
            Controle gastos, gerencie assinaturas e projete seu futuro financeiro com uma interface que você realmente vai querer usar.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Link href="/register" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto rounded-full h-14 px-8 text-lg bg-violet-600 hover:bg-violet-700 text-white shadow-xl shadow-violet-200 transition-all hover:scale-105 hover:-translate-y-1">
                Criar Conta Gratuita <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full h-14 px-8 text-lg border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-300 transition-all" asChild>
              <a href="#pricing">Ver Preços</a>
            </Button>
          </div>

          {/* Dashboard Preview Mockup - Light Version */}
          <div className="mt-16 relative mx-auto max-w-5xl rounded-2xl border border-zinc-200 bg-white/50 backdrop-blur-sm shadow-2xl shadow-zinc-200/50 overflow-hidden aspect-video group">
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
              <p className="text-zinc-500 text-sm font-medium bg-white/70 px-4 py-2 rounded-full shadow-sm backdrop-blur-md">Design focado em clareza e velocidade.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Grid de Benefícios - Light */}
      <section className="py-24 bg-zinc-50 border-y border-zinc-100">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-zinc-900">Por que escolher o Weven?</h2>
            <p className="text-zinc-500">Funcionalidades pensadas para quem valoriza tempo e segurança.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-white border-zinc-100 shadow-sm hover:shadow-xl hover:shadow-violet-100/50 hover:border-violet-100 transition-all duration-300 group">
              <CardHeader>
                <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-violet-50 transition-colors">
                  <Lock className="h-6 w-6 text-zinc-400 group-hover:text-violet-500 transition-colors" />
                </div>
                <CardTitle className="text-zinc-900">Criptografia E2E</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-500 leading-relaxed">
                  Seus dados são criptografados no seu dispositivo antes de serem salvos. Ninguém, nem nós, pode ver quanto você ganha ou gasta.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border-zinc-100 shadow-sm hover:shadow-xl hover:shadow-blue-100/50 hover:border-blue-100 transition-all duration-300 group">
              <CardHeader>
                <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-50 transition-colors">
                  <Zap className="h-6 w-6 text-zinc-400 group-hover:text-blue-500 transition-colors" />
                </div>
                <CardTitle className="text-zinc-900">Gestão de Recorrência</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-500 leading-relaxed">
                  Controle assinaturas (Netflix, Spotify) e parcelamentos com inteligência. Cancele futuros pagamentos com um clique.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border-zinc-100 shadow-sm hover:shadow-xl hover:shadow-emerald-100/50 hover:border-emerald-100 transition-all duration-300 group">
              <CardHeader>
                <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-50 transition-colors">
                  <Smartphone className="h-6 w-6 text-zinc-400 group-hover:text-emerald-500 transition-colors" />
                </div>
                <CardTitle className="text-zinc-900">Mobile First</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-500 leading-relaxed">
                  Uma interface que funciona perfeitamente no seu celular. Lance ganhos e gastos em segundos, onde quer que esteja.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section - Light & Dynamic */}
      <section className="py-24 px-6 relative bg-white" id="pricing">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 space-y-4">
            <Badge className="bg-violet-50 text-violet-600 hover:bg-violet-100 border-violet-100 mb-2 px-3 py-1">Preços Justos</Badge>
            <h2 className="text-4xl font-bold tracking-tight text-zinc-900">Comece grátis, cresça depois</h2>
            <p className="text-zinc-500 text-lg">
              Sem compromisso. Cancele sua assinatura a qualquer momento.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-start">

            {/* PLANO FREE (Dynamic - Medalha de Bronze) */}
            {plans.free.active && (
              <Card className="bg-zinc-50 border-zinc-200 shadow-none hover:border-zinc-300 transition-all rounded-4xl">
                <CardHeader className="p-8 pb-0">
                  <CardTitle className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                    {plans.free.name} <Medal className="h-5 w-5 text-zinc-400" />
                  </CardTitle>
                  <CardDescription className="text-zinc-500">{plans.free.description}</CardDescription>
                  <div className="pt-6 pb-2">
                    <span className="text-4xl font-bold text-zinc-900">R$ {plans.free.price}</span>
                  </div>
                </CardHeader>
                <CardContent className="p-8 pt-6 space-y-4">
                  <ul className="space-y-3 text-sm text-zinc-600">
                    {plans.free.features.map((feature, i) => (
                      <li key={i} className="flex gap-3"><CheckCircle2 className="h-5 w-5 text-zinc-400" /> {feature}</li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="p-8 pt-0">
                  <Link href="/register" className="w-full">
                    <Button className="w-full rounded-2xl h-12 bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 shadow-sm font-medium transition-all hover:scale-105 active:scale-95">Começar Agora</Button>
                  </Link>
                </CardFooter>
              </Card>
            )}

            {/* PLANO PREMIUM (Dynamic & Recommended - Medalha de Prata) */}
            {plans.premium.active && (
              <Card className="bg-white border-violet-200 shadow-2xl shadow-violet-200/50 rounded-4xl relative scale-105 z-10">
                <div className="absolute top-0 left-0 w-full h-10 bg-linear-to-r from-violet-500 to-indigo-500" >
                  <CardTitle className="flex justify-center items-center w-full h-full text-white text-xs uppercase tracking-widest font-bold">Recomendado</CardTitle>
                </div>
                <CardHeader className="p-8 pb-0 mt-6">
                  <div className="flex justify-between items-center mb-2">
                    <CardTitle className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                      {plans.premium.name} <Medal className="h-5 w-5 text-violet-500 fill-violet-100" />
                    </CardTitle>
                    <Badge className="bg-violet-100 text-violet-600 hover:bg-violet-200 border-none">Popular</Badge>
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
                  <a href={plans.premium.paymentLink} target="_blank" rel="noopener noreferrer" className="w-full">
                    <Button className="w-full rounded-2xl bg-violet-600 text-white hover:bg-violet-700 font-bold h-12 shadow-lg shadow-violet-200 transition-all hover:scale-105 active:scale-95">
                      Assinar {plans.premium.name}
                    </Button>
                  </a>
                </CardFooter>
              </Card>
            )}

            {/* PLANO PRO (Dynamic - Medalha de Ouro) */}
            {plans.pro.active && (
              <Card className="bg-white border-zinc-200 shadow-xl hover:border-amber-400 hover:shadow-amber-100/50 transition-all rounded-4xl">
                <CardHeader className="p-8 pb-0">
                  <div className="flex justify-between items-center mb-2">
                    <CardTitle className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                      {plans.pro.name} <Medal className="h-5 w-5 text-emerald-500" />
                    </CardTitle>
                    {/* Badge opcional para pro */}
                    <Badge variant="outline" className="text-emerald-600 border-emerald-200">Completo</Badge>
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
                  <a href={plans.pro.paymentLink} target="_blank" rel="noopener noreferrer" className="w-full">
                    <Button className="w-full rounded-2xl h-12 border border-zinc-200 bg-white text-zinc-900 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all hover:scale-105 active:scale-95 shadow-sm" variant="outline">
                      Assinar {plans.pro.name}
                    </Button>
                  </a>
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

      <footer className="py-10 text-center text-zinc-600 text-sm border-t border-zinc-900 bg-black">
        <div className="container mx-auto px-6">
          <div className="flex justify-center items-center gap-2 mb-4">
            <Wallet className="h-5 w-5 text-violet-600" />
            <span className="font-bold text-lg text-white">Weven</span>
          </div>
          <p className="mb-4 text-zinc-400">Desenvolvido para sua liberdade.</p>
          <p className="opacity-40">© {new Date().getFullYear()} Weven. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}