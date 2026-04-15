import { Database, EyeOff, Lock, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ITEMS = [
  {
    icon: ShieldCheck,
    title: "Proteção por camadas",
    description:
      "O WevenFinance aplica autenticação, regras de acesso, proteção de rotas e controles internos para reduzir exposição indevida dos seus dados.",
  },
  {
    icon: Lock,
    title: "Acesso vinculado à conta",
    description:
      "Seu acesso é controlado pela sua conta autenticada. Recursos sensíveis, como cobrança e suporte administrativo, passam por validações adicionais no backend.",
  },
  {
    icon: EyeOff,
    title: "Privacidade no aplicativo",
    description:
      "O app oferece modo discreto, separação de dados por usuário e controles de exibição para evitar exposição visual em ambientes públicos.",
  },
  {
    icon: Database,
    title: "Armazenamento e operação",
    description:
      "Os dados operacionais são armazenados na nuvem e processados pela WevenFinance para funcionalidades como dashboard, cartões, metas e assinatura.",
  },
];

export default function SecurityPage() {
  return (
    <div className="bg-transparent px-4 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Segurança</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">Como protegemos sua conta e seus dados</h1>
          <p className="mx-auto max-w-3xl text-base leading-7 text-muted-foreground">
            Esta página resume, em linguagem direta, como o WevenFinance trata acesso, privacidade e operação da plataforma.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {ITEMS.map((item) => {
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
            <CardTitle className="text-foreground">Importante</CardTitle>
            <CardDescription className="text-muted-foreground">
              Segurança é um compromisso contínuo. O produto ainda está evoluindo e algumas camadas seguem sendo aprimoradas conforme a plataforma cresce.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
