export interface PlanDetails {
  name: string;
  price: number;
  description: string;
  paymentLink: string; // Link do Mercado Pago
  features: string[]; // Lista de benefícios
  limit?: number; // Limite de transações (apenas para o Free)
  highlight?: boolean; // Se é o plano "Recomendado"
  active: boolean; // NOVO: Se o plano está visível para compra
}

export interface PlansConfig {
  free: PlanDetails;
  pro: PlanDetails;
  premium: PlanDetails;
}

// Configuração Padrão (Fallback)
export const DEFAULT_PLANS_CONFIG: PlansConfig = {
  free: {
    name: "Iniciante",
    price: 0,
    description: "Para testar e organizar o básico.",
    paymentLink: "",
    features: ["Até 20 lançamentos/mês", "Gráficos Básicos", "Controle Manual"],
    limit: 20,
    active: true
  },
  pro: {
    name: "Pro",
    price: 19.90,
    description: "Liberdade total para suas finanças.",
    paymentLink: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=018bc64fcdfa44e384fc7d74c430be10",
    features: ["Lançamentos Ilimitados", "Gestão de Streaming", "Projeção de Saldo", "Suporte Prioritário"],
    highlight: true,
    active: true
  },
  premium: {
    name: "Premium",
    price: 49.90,
    description: "O máximo de poder e segurança.",
    paymentLink: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=cc495aef2c0043c5a272ad5f8594d78e",
    features: ["Tudo do Plano Pro", "Criptografia E2E (Chave Pessoal)", "Exportação CSV", "Suporte VIP"],
    highlight: false,
    active: true
  }
};