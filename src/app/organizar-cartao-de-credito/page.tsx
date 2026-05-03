import type { Metadata } from "next";

import { SeoLandingPage } from "@/components/marketing/SeoLandingPage";

export const metadata: Metadata = {
  title: "Como organizar cartão de crédito e parcelas?",
  description: "Controle limite, fatura, vencimentos e compras parceladas sem confundir cartão com renda.",
  alternates: { canonical: "/organizar-cartao-de-credito" },
};

export default function Page() {
  return (
    <SeoLandingPage
      eyebrow="Cartão de Crédito"
      title="Organize o cartão de crédito antes que a fatura vire surpresa"
      description="Acompanhe compras, parcelas e vencimento da fatura para decidir melhor quanto ainda pode gastar."
      keyword="organizar cartão de crédito"
      benefits={["Fatura e Vencimento Claros", "Parcelas Dentro da Previsão", "Limite Tratado como Compromisso, Não Renda"]}
      sections={[
        { title: "Cartão não aumenta o salário", text: "O WevenFinance mostra o impacto da fatura no mês para evitar a falsa sensação de dinheiro disponível." },
        { title: "Parcelas entram na previsão", text: "Compras parceladas deixam de ser surpresa quando aparecem no cálculo do seu mês e do seu limite diário." },
      ]}
    />
  );
}
