import { FileText, ShieldCheck, CreditCard, AlertTriangle } from "lucide-react";

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
    <div className="min-h-screen bg-zinc-50/40 px-4 py-24">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-600">Termos</p>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900">Termos de uso resumidos</h1>
          <p className="mx-auto max-w-2xl text-base text-zinc-600">
            Esta versão resume os pontos principais de uso do produto até a publicação de uma versão jurídica expandida.
          </p>
        </div>

        <div className="grid gap-4">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <Card key={section.title} className="rounded-3xl border-zinc-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-zinc-900">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                      <Icon className="h-5 w-5" />
                    </span>
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-6 text-zinc-600">
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
