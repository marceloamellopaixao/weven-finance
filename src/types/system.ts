export interface PlanDetails {
  name: string;
  price: number;
  description: string;
  paymentLink: string;
  features: string[];
  limit?: number;
  highlight?: boolean;
  active: boolean;
}

export interface PlansConfig {
  free: PlanDetails;
  premium: PlanDetails;
  pro: PlanDetails;
}

export const DEFAULT_PLANS_CONFIG: PlansConfig = {
  free: {
    name: "Free",
    price: 0,
    description: "Para sair do caos e registrar o essencial do mês.",
    paymentLink: "",
    features: [
      "Até 20 lançamentos por mês",
      "1 cartão para acompanhar gastos",
      "1 meta ativa no porquinho",
      "Visão mensal básica do fluxo financeiro",
    ],
    limit: 20,
    active: true,
  },
  premium: {
    name: "Premium",
    price: 19.9,
    description: "Para organizar cartões, vencimentos, parcelas e metas com clareza.",
    paymentLink: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=018bc64fcdfa44e384fc7d74c430be10",
    features: [
      "Lançamentos ilimitados",
      "Até 5 cartões para limites e faturas",
      "Até 5 metas ativas no porquinho",
      "Parcelamentos, vencimentos e projeção do mês",
    ],
    highlight: true,
    active: true,
  },
  pro: {
    name: "Pro",
    price: 49.9,
    description: "Para decidir melhor todos os dias com mais orientação.",
    paymentLink: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=cc495aef2c0043c5a272ad5f8594d78e",
    features: [
      "Tudo do Premium",
      "Cartões e metas sem limite",
      "Limite diário inteligente no dashboard",
      "Camada extra de orientação financeira",
    ],
    highlight: false,
    active: true,
  },
};
