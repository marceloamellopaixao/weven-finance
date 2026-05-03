import type { Metadata } from "next";

import { DailyLimitCalculator } from "@/components/marketing/DailyLimitCalculator";

export const metadata: Metadata = {
  title: "Calculadora: quanto posso gastar hoje?",
  description: "Calcule grátis quanto você pode gastar hoje sem comprometer o fim do mês.",
  alternates: { canonical: "/calculadora/quanto-posso-gastar-hoje" },
};

export default function Page() {
  return (
    <main className="bg-transparent px-4 py-16 sm:px-6 sm:py-24">
      <div className="container mx-auto max-w-5xl space-y-10">
        <section className="space-y-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Calculadora gratuita</p>
          <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">
            Quanto posso gastar hoje sem comprometer o fim do mês?
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Informe seu saldo, contas previstas, cartão e reserva desejada. O resultado e uma estimativa simples para orientar sua decisão de hoje.
          </p>
        </section>
        <DailyLimitCalculator />
      </div>
    </main>
  );
}
