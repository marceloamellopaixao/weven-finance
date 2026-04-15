import { AlertTriangle, CreditCard, FileText, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SECTIONS = [
  {
    icon: FileText,
    title: "Uso da plataforma",
    text: "O WevenFinance é um software de organização financeira pessoal. O usuário é responsável pelas informações cadastradas e pelo uso da conta.",
  },
  {
    icon: ShieldCheck,
    title: "Conta e acesso",
    text: "Cada conta deve ser usada pelo próprio titular. O compartilhamento indevido de credenciais pode comprometer a segurança e o suporte da plataforma.",
  },
  {
    icon: CreditCard,
    title: "Assinatura e cobrança",
    text: "Planos pagos podem ser contratados por assinatura recorrente, com processamento de pagamento por parceiro externo. O status do plano depende da confirmação do pagamento.",
  },
  {
    icon: AlertTriangle,
    title: "Disponibilidade e evolução",
    text: "O produto segue em evolução contínua. Recursos, fluxos e integrações podem ser melhorados ou ajustados para aumentar segurança, clareza e estabilidade.",
  },
];

export default function TermsPage() {
  return (
    <div className="bg-transparent px-4 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Termos</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">Termos de uso resumidos</h1>
          <p className="mx-auto max-w-2xl text-base leading-7 text-muted-foreground">
            Esta versão resume os pontos principais de uso do produto até a publicação de uma versão jurídica expandida.
          </p>
        </div>

        <div className="grid gap-4">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <Card key={section.title} className="app-panel-soft rounded-3xl border-color:var(--app-panel-border) shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-foreground">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-6 text-muted-foreground">
                  {section.text}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
