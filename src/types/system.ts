export interface PlanDetails {
    name: string; // Nome do plano
    price: number; // Preço mensal
    description: string; // Descrição do plano
    paymentLink: string; // Link para a página de pagamento
    features: string[]; // Lista de funcionalidades do plano
    limit?: number; // Limite de transações (apenas para o Free)
    highlight?: boolean; // Indica se o plano deve ser destacado na UI
}

export interface PlansConfig {
    free: PlanDetails;
    premium: PlanDetails;
    pro: PlanDetails;
}

// Configuração Padrão dos Planos de Assinatura
export const DEFAULT_PLANS_CONFIG: PlansConfig = {
    free: {
        name: "Free",
        price: 0,
        description: "Para testar e gerenciar suas finanças básicas.",
        paymentLink: "/register", // Link para registro, pois é gratuito
        features: ["Até 20 lançamentos mensais", "Gráficos básicos", "Controle Manual"],
    },
    premium: {
        name: "Premium",
        price: 19.90,
        description: "Liberdade total para suas finanças.",
        paymentLink: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=cc495aef2c0043c5a272ad5f8594d78e",
        features: ["Lançamentos Ilimitados", "Projeção de Saldo", "Suporte Prioritário"],
        highlight: true
    },
    pro: {
        name: "Pro",
        price: 49.90,
        description: "O máximo de poder e segurança.",
        paymentLink: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=018bc64fcdfa44e384fc7d74c430be10",
        features: ["Tudo do Plano Premium", "Criptografia E2E (Chave Pessoal)", "Exportação CSV", "Suporte VIP"],
        highlight: false
    }
}