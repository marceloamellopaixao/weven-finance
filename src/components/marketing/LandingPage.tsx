"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Wallet, ShieldCheck, Zap, BarChart3, ArrowRight, Star, CreditCard } from "lucide-react";
import Link from "next/link";

// Links de Pagamento (Mercado Pago)
const LINK_PRO = "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=018bc64fcdfa44e384fc7d74c430be10";
// const LINK_PREMIUM = "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=cc495aef2c0043c5a272ad5f8594d78e";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black font-sans selection:bg-violet-500/30">
      
      {/* Navbar Marketing */}
      <nav className="fixed top-0 w-full z-50 bg-white/70 dark:bg-black/70 backdrop-blur-xl border-b border-zinc-200/50 dark:border-zinc-800/50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-violet-600 p-2 rounded-xl shadow-lg shadow-violet-500/20">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-white">
              Weven<span className="text-violet-600">Finance</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="rounded-full font-medium text-zinc-600 dark:text-zinc-300">Entrar</Button>
            </Link>
            <Link href="/register">
              <Button className="rounded-full bg-violet-600 hover:bg-violet-700 text-white font-medium px-6 shadow-lg shadow-violet-500/25 transition-all hover:scale-105">
                Começar Grátis
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        {/* Efeitos de Fundo */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-violet-500/20 rounded-full blur-[120px] -z-10 opacity-50 dark:opacity-100" />
        
        <div className="container mx-auto text-center max-w-4xl space-y-8">
          <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700 px-4 py-1.5 rounded-full text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-700">
            ✨ Controle total, sem planilhas chatas
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-zinc-900 dark:text-white leading-[1.1] animate-in fade-in slide-in-from-bottom-8 duration-1000">
            Suas finanças, <br/>
            <span className="text-transparent bg-clip-text bg-linear-to-r from-violet-600 to-indigo-600">organizadas e seguras.</span>
          </h1>
          
          <p className="text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-10 duration-1000">
            Pare de perder dinheiro com assinaturas esquecidas e parcelamentos infinitos. 
            O Weven Finance te dá clareza financeira em segundos.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-in fade-in slide-in-from-bottom-12 duration-1000">
            <Link href="/register">
              <Button size="lg" className="rounded-full h-14 px-8 text-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 shadow-xl w-full sm:w-auto">
                Criar Conta Gratuita <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="rounded-full h-14 px-8 text-lg border-zinc-300 dark:border-zinc-700 w-full sm:w-auto" asChild>
              <a href="#pricing">Ver Planos</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features de Segurança */}
      <section className="py-20 bg-white dark:bg-zinc-900/50 border-y border-zinc-100 dark:border-zinc-800">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 mb-4">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-zinc-900 dark:text-white">Privacidade Absoluta</h3>
              <p className="text-zinc-500">Seus dados são criptografados. Nós não vendemos seus dados e nem temos acesso ao seu saldo bancário real.</p>
            </div>
            <div className="p-8 rounded-3xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 mb-4">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-zinc-900 dark:text-white">Fim das Assinaturas Fantasmas</h3>
              <p className="text-zinc-500">Gerencie Netflix, Spotify e outros streamings separadamente. Cancele previsões futuras com um clique.</p>
            </div>
            <div className="p-8 rounded-3xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center text-orange-600 mb-4">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-zinc-900 dark:text-white">Previsão de Futuro</h3>
              <p className="text-zinc-500">Não olhe apenas o passado. Nosso sistema projeta seu saldo no final do mês considerando o que ainda vai cair.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section - A Área de Venda */}
      <section className="py-24 px-6 relative" id="pricing">
        <div className="absolute inset-0 bg-zinc-50/50 dark:bg-black -z-10" />
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">Investimento no seu futuro</h2>
            <p className="text-zinc-500 text-lg max-w-2xl mx-auto">
              Escolha o plano que se adapta ao seu momento financeiro. 
              <br/>Transparência total, cancele quando quiser via Mercado Pago.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-start">
            
            {/* PLANO BÁSICO */}
            <Card className="rounded-4xl border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all bg-white dark:bg-zinc-900">
              <CardHeader className="p-8 pb-0">
                <CardTitle className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Iniciante</CardTitle>
                <CardDescription>Para organizar o básico do dia a dia.</CardDescription>
                <div className="pt-6 pb-2">
                  <span className="text-4xl font-bold text-zinc-900 dark:text-white">Grátis</span>
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-4 space-y-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">O que está incluso:</p>
                <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                  <li className="flex gap-3"><CheckCircle2 className="h-5 w-5 text-zinc-400" /> Até 20 transações/mês</li>
                  <li className="flex gap-3"><CheckCircle2 className="h-5 w-5 text-zinc-400" /> Gráficos Simples</li>
                  <li className="flex gap-3"><CheckCircle2 className="h-5 w-5 text-zinc-400" /> Controle Manual</li>
                </ul>
              </CardContent>
              <CardFooter className="p-8 pt-0">
                <Link href="/register" className="w-full">
                  <Button className="w-full rounded-2xl h-12" variant="outline">Criar Conta Grátis</Button>
                </Link>
              </CardFooter>
            </Card>

            {/* PLANO PRO (DESTACADO) */}
            <Card className="rounded-4xl border-violet-500 shadow-2xl relative scale-105 bg-zinc-900 text-white z-10 overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-violet-500 to-indigo-500" />
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg">
                Recomendado
              </div>
              <CardHeader className="p-8 pb-0">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  Pro <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                </CardTitle>
                <CardDescription className="text-zinc-400">Controle total da sua vida financeira.</CardDescription>
                <div className="pt-6 pb-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">R$ 19,90</span>
                  <span className="text-zinc-400 text-sm">/mês</span>
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-4 space-y-4">
                <p className="text-xs font-medium uppercase tracking-wide text-violet-300">Tudo do Grátis, mais:</p>
                <ul className="space-y-3 text-sm text-zinc-200">
                  <li className="flex gap-3"><CheckCircle2 className="h-5 w-5 text-violet-400 shrink-0" /> <span className="font-medium">Transações Ilimitadas</span></li>
                  <li className="flex gap-3"><CheckCircle2 className="h-5 w-5 text-violet-400 shrink-0" /> Gestão de Streaming/Assinaturas</li>
                  <li className="flex gap-3"><CheckCircle2 className="h-5 w-5 text-violet-400 shrink-0" /> Projeção de Saldo Futuro</li>
                  <li className="flex gap-3"><CheckCircle2 className="h-5 w-5 text-violet-400 shrink-0" /> Suporte Prioritário</li>
                </ul>
              </CardContent>
              <CardFooter className="p-8 pt-0">
                {/* Botão para Mercado Pago */}
                <a href={LINK_PRO} target="_blank" rel="noopener noreferrer" className="w-full">
                  <Button className="w-full rounded-2xl bg-white text-black hover:bg-zinc-200 font-bold h-12 shadow-lg">
                    Assinar Pro Agora
                  </Button>
                </a>
              </CardFooter>
            </Card>

            {/* PLANO PREMIUM */}
            <Card className="rounded-4xl border-zinc-200 dark:border-zinc-800 shadow-lg hover:shadow-xl transition-all bg-white dark:bg-zinc-900">
              <CardHeader className="p-8 pb-0">
                <CardTitle className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                   Premium <CreditCard className="h-5 w-5 text-emerald-500" />
                </CardTitle>
                <CardDescription>Para empresários e investidores.</CardDescription>
                <div className="pt-6 pb-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-zinc-900 dark:text-white">R$ 49,90</span>
                  <span className="text-zinc-500 text-sm">/mês</span>
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-4 space-y-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Tudo do Pro, mais:</p>
                <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                  <li className="flex gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" /> Multi-usuários (Família)</li>
                  <li className="flex gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" /> Consultoria Financeira (IA)</li>
                  <li className="flex gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" /> Exportação para Excel/CSV</li>
                </ul>
              </CardContent>
              <CardFooter className="p-8 pt-0">
                 {/* Botão para Mercado Pago */}
                 <a /*href={LINK_PREMIUM}*/ onClick={() => alert("Este plano está em manutenção!!")} target="_blank" rel="noopener noreferrer" className="w-full">
                  <Button className="w-full rounded-2xl h-12 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" variant="outline">
                    Assinar Premium
                  </Button>
                </a>
              </CardFooter>
            </Card>

          </div>

          <div className="mt-16 p-6 rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-center text-sm text-zinc-500">
            <p className="flex items-center justify-center gap-2">
              <ShieldCheck className="h-4 w-4" /> 
              Pagamentos processados com segurança pelo <strong>Mercado Pago</strong>. A liberação do plano Pro/Premium ocorre em até 24h após a confirmação.
            </p>
          </div>
        </div>
      </section>

      <footer className="py-10 text-center text-zinc-500 text-sm border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black">
        <div className="container mx-auto px-6">
          <div className="flex justify-center items-center gap-2 mb-4">
            <Wallet className="h-5 w-5 text-violet-600" />
            <span className="font-bold text-lg text-zinc-900 dark:text-white">Weven Finance</span>
          </div>
          <p>© {new Date().getFullYear()} Weven Finance. Todos os direitos reservados.</p>
          <div className="flex justify-center gap-6 mt-4">
            <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Termos de Uso</a>
            <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Política de Privacidade</a>
            <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Suporte</a>
          </div>
        </div>
      </footer>
    </div>
  );
}