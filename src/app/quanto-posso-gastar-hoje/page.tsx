import type { Metadata } from "next";

import { SeoLandingPage } from "@/components/marketing/SeoLandingPage";

export const metadata: Metadata = {
  title: "Quanto posso gastar hoje sem comprometer o mês?",
  description: "Entenda quanto pode gastar hoje considerando saldo, contas, cartão e o que ainda vence no mês.",
  alternates: { canonical: "/quanto-posso-gastar-hoje" },
};

export default function Page() {
  return (
    <SeoLandingPage
      eyebrow="Quanto posso gastar hoje?"
      title="Saiba quanto voce pode gastar hoje sem comprometer o fim do mês"
      description="Pare de olhar apenas o saldo. O WevenFinance considera contas, cartão, parcelas e metas para orientar sua decisão diaria."
      keyword="quanto posso gastar hoje"
      benefits={["Limite diário estimado", "Previsão até o fim do mês", "Alertas para segurar antes de apertar"]}
      sections={[
        { title: "Saldo não é dinheiro livre", text: "Se ainda existem boletos, fatura e assinaturas para vencer, o saldo sozinho engana. O limite diário resolve isso." },
        { title: "Uma resposta para comprar melhor", text: "Antes de gastar, veja se aquele valor ainda cabe no seu mês ou se vai reduzir demais sua folga diária." },
      ]}
    />
  );
}
