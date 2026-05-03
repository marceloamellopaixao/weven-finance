import type { Metadata } from "next";

import { SeoLandingPage } from "@/components/marketing/SeoLandingPage";

export const metadata: Metadata = {
  title: "App para sair das dívidas com controle simples",
  description: "Organize gastos, vencimentos e metas para parar de se perder e recuperar previsibilidade financeira.",
  alternates: { canonical: "/app-para-sair-das-dividas" },
};

export default function Page() {
  return (
    <SeoLandingPage
      eyebrow="Sair das dívidas"
      title="Um app para sair das dívidas com clareza no dia a dia"
      description="Veja o que ainda vence, reduza gastos antes do aperto e acompanhe metas para recuperar controle financeiro."
      keyword="app para sair das dívidas"
      benefits={["Vencimentos visíveis", "Limite diário para segurar gastos", "Metas para reconstruir reserva"]}
      sections={[
        { title: "Comece pelo que vence", text: "Antes de tentar mudar tudo, veja boletos, faturas e recorrências que ainda vão consumir seu saldo." },
        { title: "Pequenas decisões diarias", text: "Sair das dívidas depende de saber quando gastar e quando segurar. O limite diário deixa essa decisão mais concreta." },
      ]}
    />
  );
}
