import type { Metadata } from "next";

import { SeoLandingPage } from "@/components/marketing/SeoLandingPage";

export const metadata: Metadata = {
  title: "Controle financeiro simples para não passar aperto",
  description: "Organize gastos, cartões e vencimentos sem planilha e descubra quanto pode gastar hoje.",
  alternates: { canonical: "/controle-financeiro-simples" },
};

export default function Page() {
  return (
    <SeoLandingPage
      eyebrow="Controle financeiro simples"
      title="Controle financeiro simples para quem quer clareza sem planilha"
      description="Registre o essencial, acompanhe vencimentos e entenda se o dinheiro do mês ainda está seguro."
      keyword="controle financeiro simples"
      benefits={["Sem planilha complicada", "Gastos e vencimentos no mesmo lugar", "Resposta clara para o dia a dia"]}
      sections={[
        { title: "Para quem sente que o dinheiro some", text: "O foco não é virar especialista em finanças. É enxergar entradas, saídas e compromissos antes que o mês aperte." },
        { title: "Do registro para a decisão", text: "Cada lançamento ajuda a calcular sua previsão e seu limite diário, transformando dados em uma orientação simples." },
      ]}
    />
  );
}
