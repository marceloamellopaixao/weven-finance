import Link from "next/link";
import { Headset, LifeBuoy, Mail, MessageCircle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const CONTACT_OPTIONS = [
  {
    icon: Headset,
    title: "Suporte dentro do app",
    description: "Se você já tem conta, use a aba de ajuda em Configurações para abrir um atendimento ou enviar uma sugestão.",
  },
  {
    icon: Mail,
    title: "Contato institucional",
    description: "Para assuntos comerciais e institucionais, você também pode entrar em contato com a Weven Tech.",
  },
  {
    icon: MessageCircle,
    title: "Feedback de produto",
    description: "Quer pedir uma melhoria? O canal interno de ideias é o caminho mais rápido para chegar ao time de produto.",
  },
];

export default function ContactPage() {
  return (
    <div className="bg-transparent px-4 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Contato</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">Fale com a WevenFinance</h1>
          <p className="mx-auto max-w-2xl text-base leading-7 text-muted-foreground">
            Se você precisa de ajuda, tem uma dúvida sobre sua conta ou quer sugerir algo, estes são os canais certos.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {CONTACT_OPTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="app-panel-soft rounded-3xl border-color:var(--app-panel-border) shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-foreground">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="app-panel-soft rounded-3xl border-color:var(--app-panel-border) shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <LifeBuoy className="h-5 w-5 text-primary" />
              Próximo passo
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Link href="/settings?tab=help" className="w-full sm:w-auto">
              <Button className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
                Abrir ajuda no aplicativo
              </Button>
            </Link>
            <a href="https://weven.tech" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full rounded-xl">
                Visitar Weven Tech
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
