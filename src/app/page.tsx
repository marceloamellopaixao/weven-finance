import type { Metadata } from "next";
import { Calculator, CheckCircle2, CreditCard, Lock, Medal, ShieldCheck, Smartphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketingCtas } from "@/components/marketing/MarketingCtas";

export const metadata: Metadata = {
  title: "Quanto posso gastar hoje? Controle financeiro simples",
  description:
    "Saiba quanto voce pode gastar hoje sem se enrolar ate o fim do mes. Controle gastos, cartoes, parcelas e metas no WevenFinance.",
  alternates: { canonical: "/" },
};

const plans = {
  free: {
    name: "Free",
    description: "Para registrar o essencial e sair do escuro.",
    price: "0",
    tag: "Registrar",
    features: ["Até 20 lançamentos por mês", "1 cartão para acompanhar gastos", "1 meta ativa no porquinho"],
  },
  premium: {
    name: "Premium",
    description: "Para organizar cartões, parcelas, vencimentos e metas.",
    price: "19.9",
    tag: "Organizar",
    features: ["Lançamentos ilimitados", "Até 5 cartões para limites e faturas", "Até 5 metas ativas", "Parcelamentos e previsão de fechamento"],
  },
  pro: {
    name: "Pro",
    description: "Para decidir quanto pode gastar hoje com mais segurança.",
    price: "49.9",
    tag: "Decidir",
    features: ["Tudo do Premium", "Cartões e metas sem limite", "Limite diário inteligente", "Alertas para não apertar o fim do mês"],
  },
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-transparent font-sans text-foreground selection:bg-primary/15 selection:text-foreground">
      <section className="relative overflow-hidden px-4 pb-12 pt-24 sm:px-6 sm:pb-20 sm:pt-32 lg:pb-24 lg:pt-40">
        <div className="absolute left-1/2 top-20 -z-10 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />

        <div className="container mx-auto max-w-4xl space-y-6 text-center sm:space-y-8">
          <Badge variant="outline" className="max-w-full whitespace-normal rounded-full border-primary/20 bg-primary/10 px-4 py-1.5 text-center text-xs font-medium leading-relaxed text-primary shadow-sm backdrop-blur-md sm:text-sm">
            Controle financeiro simples para quem não quer passar aperto.
          </Badge>

          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl md:text-7xl">
            Saiba quanto você pode gastar hoje{" "}
            <span className="bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">sem se enrolar até o fim do mês.</span>
          </h1>

          <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
            O WevenFinance transforma saldo, cartões, parcelas, vencimentos e metas em uma resposta simples para o dia a dia: posso gastar ou preciso segurar?
          </p>

          <MarketingCtas variant="hero" />

          <div className="flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground sm:flex-row sm:gap-3">
            <span className="rounded-full border border-color:var(--app-panel-border) bg-card/70 px-4 py-2 backdrop-blur">Quanto posso gastar hoje?</span>
            <span className="rounded-full border border-color:var(--app-panel-border) bg-card/70 px-4 py-2 backdrop-blur">Controle de cartão e parcelas</span>
            <span className="rounded-full border border-color:var(--app-panel-border) bg-card/70 px-4 py-2 backdrop-blur">Metas sem planilha</span>
          </div>

          <div className="group relative mx-auto mt-8 aspect-[1.45/1] max-w-5xl overflow-hidden rounded-2xl border border-color:var(--app-panel-border) bg-card/50 shadow-2xl shadow-primary/10 backdrop-blur-sm sm:mt-12 sm:aspect-video">
            <div className="absolute inset-0 z-10 bg-linear-to-t from-background via-transparent to-transparent" />
            <div className="absolute inset-4 grid grid-cols-[0.85fr_1.15fr] gap-3 opacity-70 sm:inset-6 sm:grid-cols-3 sm:gap-6">
              <div className="grid min-h-0 grid-rows-[0.8fr_0.8fr_1.2fr] gap-3 sm:col-span-1 sm:gap-4">
                <div className="min-h-0 rounded-xl border border-emerald-300/50 bg-emerald-500/15" />
                <div className="min-h-0 rounded-xl border border-red-300/40 bg-red-500/10" />
                <div className="min-h-0 rounded-xl border border-amber-300/40 bg-amber-500/10" />
              </div>
              <div className="grid min-h-0 grid-rows-[1.45fr_0.75fr] gap-3 sm:col-span-2 sm:gap-4">
                <div className="flex min-h-0 items-center justify-center rounded-xl border border-color:var(--app-panel-border) bg-muted/60 text-xs font-semibold text-primary sm:text-sm">
                  <span className="hidden sm:inline">Hoje você pode gastar com segurança</span>
                </div>
                <div className="min-h-0 rounded-xl border border-color:var(--app-panel-border) bg-primary/10" />
              </div>
            </div>
            <div className="absolute bottom-4 left-1/2 z-20 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 sm:bottom-10 sm:w-auto sm:max-w-none">
              <p className="rounded-full border border-color:var(--app-panel-border) bg-card/80 px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-md sm:px-4 sm:text-sm">Pare de olhar saldo como se fosse dinheiro livre.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border/70 bg-muted/30 py-20 sm:py-24" id="features">
        <div className="container mx-auto px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">Controle diário de decisão financeira</h2>
            <p className="text-muted-foreground">Menos susto no fim do mês, mais clareza antes de comprar.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            {[
              { icon: Calculator, title: "Limite diário inteligente", text: "Veja quanto ainda pode gastar por dia considerando contas, cartão, parcelas e metas." },
              { icon: CreditCard, title: "Cartões sob controle", text: "Acompanhe vencimentos, faturas e compras parceladas sem transformar crédito em renda." },
              { icon: Smartphone, title: "Feito para a vida real", text: "Lance gastos em segundos pelo celular e receba feedback antes do mês apertar." },
            ].map(({ icon: Icon, title, text }) => (
              <Card key={title} className="app-panel-soft group border-color:var(--app-panel-border) shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-foreground">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="leading-relaxed text-muted-foreground">{text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 sm:py-24">
        <div className="container mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <Badge className="mb-3 border-primary/20 bg-primary/10 text-primary hover:bg-primary/15">Confiança para dados financeiros</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Segurança, privacidade e pagamento sério.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: Lock, title: "Dados protegidos", text: "Base preparada para criptografia, privacidade e controle de acesso." },
              { icon: ShieldCheck, title: "LGPD e Segurança", text: "Experiência pensada para reduzir exposição e dar controle ao usuário." },
              { icon: CreditCard, title: "Mercado Pago", text: "Assinaturas e pagamentos processados por uma infraestrutura reconhecida." },
            ].map(({ icon: Icon, title, text }) => (
              <Card key={title} className="app-panel-subtle rounded-2xl border-color:var(--app-panel-border)">
                <CardHeader>
                  <Icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{title}</CardTitle>
                  <CardDescription>{text}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-4 py-20 sm:px-6 sm:py-24" id="pricing">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-16 space-y-4 text-center">
            <Badge className="mb-2 border-primary/20 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/15">Escada de valor clara</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Free para registrar. Premium para organizar. Pro para decidir.</h2>
            <p className="text-lg text-muted-foreground">Comece no básico, suba quando precisar de mais controle e chegue no Pro quando quiser direção diária.</p>
          </div>

          <div className="mx-auto grid max-w-6xl items-stretch gap-5 md:grid-cols-3 md:items-center">
            {(["free", "premium", "pro"] as const).map((key) => {
              const plan = plans[key];
              const featured = key === "premium";
              return (
                <Card key={plan.name} className={`${featured ? "app-panel-soft relative z-10 rounded-4xl border-2 border-primary/35 shadow-2xl shadow-primary/15 md:scale-105 lg:scale-110" : "app-panel-subtle z-0 rounded-4xl border-color:var(--app-panel-border) shadow-sm transition-all duration-300 hover:border-primary/25 hover:shadow-md md:scale-90 md:hover:scale-95"}`}>
                  {featured && (
                    <div className="absolute left-0 top-0 h-10 w-full rounded-t-4xl bg-primary">
                      <CardTitle className="flex h-full w-full items-center justify-center text-xs font-bold uppercase tracking-widest text-primary-foreground">Recomendado</CardTitle>
                    </div>
                  )}
                  <CardHeader className={`p-8 pb-0 ${featured ? "mt-6" : ""}`}>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="flex items-center gap-2 text-xl font-bold">
                        {plan.name} <Medal className="h-5 w-5 text-primary" />
                      </CardTitle>
                      <Badge variant={featured ? "default" : "outline"}>{plan.tag}</Badge>
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="flex items-baseline gap-1 pb-2 pt-6">
                      <span className="text-4xl font-bold">R$ {plan.price}</span>
                      {key !== "free" && <span className="text-sm text-muted-foreground">/mês</span>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 p-8 pt-6">
                    <ul className="space-y-3 text-sm text-muted-foreground">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> {feature}</li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter className="p-8 pt-0">
                    <MarketingCtas variant={key} />
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
