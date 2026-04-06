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
    <div className="min-h-screen bg-zinc-50/40 px-4 py-24">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-600">Contato</p>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900">Fale com a WevenFinance</h1>
          <p className="mx-auto max-w-2xl text-base text-zinc-600">
            Se você precisa de ajuda, tem uma dúvida sobre sua conta ou quer sugerir algo, estes são os canais certos.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {CONTACT_OPTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="rounded-3xl border-zinc-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-zinc-900">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                      <Icon className="h-5 w-5" />
                    </span>
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-6 text-zinc-600">
                    {item.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="rounded-3xl border-zinc-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-900">
              <LifeBuoy className="h-5 w-5 text-violet-600" />
              Próximo passo
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Link href="/settings?tab=help" className="w-full sm:w-auto">
              <Button className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
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
