import type { Metadata } from "next";
import { Database, Eye, Scale, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRequestLocale } from "@/i18n/server";

const copy = {
  "pt-BR": {
    title: "Política de Privacidade", description: "Como o WevenFinance coleta, usa, protege e elimina seus dados.", updated: "Atualizada em 30 de agosto de 2026",
    sections: [
      ["Dados coletados", "Coletamos dados de conta, perfil, workspaces e as informações financeiras que você decide registrar. Também registramos eventos técnicos e de funil, como páginas visitadas, cadastro e checkout, usando um identificador temporário de sessão."],
      ["Como usamos", "Usamos os dados para autenticar sua conta, entregar os recursos financeiros, processar assinaturas, prevenir abuso, prestar suporte e melhorar conversão e estabilidade. Não vendemos dados pessoais."],
      ["Compartilhamento e segurança", "Supabase processa autenticação e armazenamento; Mercado Pago processa assinaturas. Aplicamos autenticação, RBAC, isolamento por workspace, criptografia de campos sensíveis e trilhas de auditoria."],
      ["Seus direitos", "Você pode consultar, corrigir, exportar ou solicitar a exclusão da conta e dos dados. Solicitações relacionadas à LGPD podem ser enviadas pela página de contato. Dados podem ser mantidos pelo prazo necessário ao cumprimento legal e prevenção de fraude."],
    ],
  },
  "en-US": {
    title: "Privacy Policy", description: "How WevenFinance collects, uses, protects, and deletes your data.", updated: "Updated August 30, 2026",
    sections: [
      ["Data we collect", "We collect account, profile, workspace, and financial information you choose to enter. We also record technical and funnel events, such as page views, registration, and checkout, using a temporary session identifier."],
      ["How we use it", "We use data to authenticate accounts, provide financial features, process subscriptions, prevent abuse, support users, and improve conversion and reliability. We do not sell personal data."],
      ["Sharing and security", "Supabase processes authentication and storage; Mercado Pago processes subscriptions. We apply authentication, RBAC, workspace isolation, sensitive-field encryption, and audit trails."],
      ["Your rights", "You may access, correct, export, or request deletion of your account and data through our contact page. Some records may be retained where required by law or fraud-prevention obligations."],
    ],
  },
  es: {
    title: "Política de Privacidad", description: "Cómo WevenFinance recopila, utiliza, protege y elimina tus datos.", updated: "Actualizada el 30 de agosto de 2026",
    sections: [
      ["Datos recopilados", "Recopilamos datos de cuenta, perfil, espacios de trabajo e información financiera que decides registrar. También registramos eventos técnicos y del embudo con un identificador temporal de sesión."],
      ["Cómo los usamos", "Usamos los datos para autenticar cuentas, ofrecer funciones financieras, procesar suscripciones, prevenir abusos, brindar soporte y mejorar la estabilidad. No vendemos datos personales."],
      ["Intercambio y seguridad", "Supabase procesa autenticación y almacenamiento; Mercado Pago procesa suscripciones. Aplicamos autenticación, RBAC, aislamiento por espacio, cifrado de campos sensibles y auditoría."],
      ["Tus derechos", "Puedes acceder, corregir, exportar o solicitar la eliminación de tu cuenta y datos mediante nuestra página de contacto. Algunos registros pueden conservarse por obligaciones legales o prevención de fraude."],
    ],
  },
} as const;

const icons = [Database, Eye, ShieldCheck, Scale];

export const metadata: Metadata = { title: "Política de Privacidade | WevenFinance", description: "Privacidade, proteção de dados e direitos dos usuários do WevenFinance.", alternates: { canonical: "/privacy" } };

export default async function PrivacyPage() {
  const locale = await getRequestLocale();
  const text = copy[locale];
  return <div className="px-4 py-16 sm:py-20"><div className="mx-auto max-w-4xl space-y-8">
    <header className="space-y-3 text-center"><h1 className="text-3xl font-bold sm:text-5xl">{text.title}</h1><p className="text-muted-foreground">{text.description}</p><p className="text-xs text-muted-foreground">{text.updated}</p></header>
    <div className="grid gap-4">{text.sections.map(([title, body], index) => { const Icon = icons[index]; return <Card key={title} className="app-panel-soft rounded-3xl"><CardHeader><CardTitle className="flex items-center gap-3"><Icon className="h-5 w-5 text-primary" />{title}</CardTitle></CardHeader><CardContent className="text-sm leading-7 text-muted-foreground">{body}</CardContent></Card>; })}</div>
  </div></div>;
}
