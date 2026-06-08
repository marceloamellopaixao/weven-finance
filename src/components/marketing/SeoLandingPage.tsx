import Link from "next/link";
import { ArrowRight, Calculator, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SeoLandingPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  keyword: string;
  benefits: string[];
  sections: Array<{ title: string; text: string }>;
  primaryCta?: string;
  secondaryCta?: string;
  finalTitle?: string;
  finalDescription?: string;
  finalCta?: string;
};

export function SeoLandingPage({
  eyebrow,
  title,
  description,
  keyword,
  benefits,
  sections,
  primaryCta = "Começar grátis",
  secondaryCta = "Calcular quanto posso gastar",
  finalTitle,
  finalDescription,
  finalCta = "Salvar meu controle no WevenFinance",
}: SeoLandingPageProps) {
  return (
    <main className="bg-transparent px-4 py-16 sm:px-6 sm:py-24">
      <div className="container mx-auto max-w-5xl space-y-14">
        <section className="space-y-6 text-center">
          <Badge className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/15">{eyebrow}</Badge>
          <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">{description}</p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild className="h-12 rounded-full px-7">
              <Link href="/register">{primaryCta} <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" className="h-12 rounded-full px-7">
              <Link href="/calculadora/quanto-posso-gastar-hoje">{secondaryCta}</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {benefits.map((benefit) => (
            <Card key={benefit} className="app-panel-soft rounded-2xl border-color:var(--app-panel-border)">
              <CardHeader>
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{benefit}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          {sections.map((section) => (
            <Card key={section.title} className="app-panel-subtle rounded-2xl border-color:var(--app-panel-border)">
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">{section.text}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border) p-6 text-center shadow-xl shadow-primary/10 sm:p-8">
          <Calculator className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-4 text-2xl font-bold">{finalTitle ?? `Transforme ${keyword} em uma decisão diária.`}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            {finalDescription ?? "O WevenFinance organiza o que entra, o que sai e o que vence para responder o que importa: quanto você pode gastar hoje sem apertar o fim do mês."}
          </p>
          <Button asChild className="mt-6 h-12 rounded-full px-7">
            <Link href="/register">{finalCta}</Link>
          </Button>
        </section>
      </div>
    </main>
  );
}
