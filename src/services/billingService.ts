import { getImpersonationHeader } from "@/lib/impersonation/client";
import { UserPlan } from "@/types/user";
import type { BillingInterval } from "@/lib/plans/catalog";

export type BillingHistoryItem = {
  id: string;
  createdAt: string | null;
  provider: string;
  eventType: string;
  action: string;
  plan: string | null;
  paymentStatus: string | null;
  amount: number | null;
  currency: string | null;
};

export type BillingHistoryPage = {
  history: BillingHistoryItem[];
  page: number;
  limit: number;
  total: number;
};

function authHeaders(idToken: string, includeJson = false) {
  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${idToken}`,
    ...getImpersonationHeader(),
  };
}

export async function getCheckoutLink(
  plan: Exclude<UserPlan, "free">,
  idToken: string,
  interval: BillingInterval = "monthly",
  options?: { adminTest?: boolean }
): Promise<{
  checkoutUrl?: string | null;
  preapprovalId?: string | null;
  checkoutAttemptId?: string | null;
  changedInPlace?: boolean;
  targetPlan?: UserPlan;
  nextChargeAt?: string | null;
  amount?: number;
}> {
  const params = new URLSearchParams({ plan, interval });
  if (options?.adminTest) params.set("mode", "admin-test");
  const response = await fetch(`/api/billing/checkout-link?${params.toString()}`, {
    method: "GET",
    headers: authHeaders(idToken),
  });

  const payload = (await response.json()) as {
    ok: boolean;
    checkoutUrl?: string;
    preapprovalId?: string | null;
    checkoutAttemptId?: string | null;
    changedInPlace?: boolean;
    targetPlan?: UserPlan;
    nextChargeAt?: string | null;
    amount?: number;
    error?: string;
  };
  if (!response.ok || !payload.ok || (!payload.checkoutUrl && !payload.changedInPlace)) {
    const messages: Record<string, string> = {
      foundation_plan_limit_reached: "A oferta Foundation atingiu o limite de usuários.",
      foundation_offer_expired: "Você já utilizou o período promocional do Foundation. Escolha Premium ou Pro.",
      foundation_plan_database_not_configured: "A campanha Foundation ainda não foi configurada no banco de dados.",
      foundation_plan_not_configured: "Informe o plano Foundation do Mercado Pago antes de abrir esta oferta.",
      foundation_plan_must_have_12_repetitions: "Configure o plano Foundation com exatamente 12 cobranças.",
      foundation_plan_must_be_monthly: "Configure o plano Foundation com cobrança mensal.",
      foundation_plan_invalid_price: "Configure o plano Foundation por R$ 9,90 em BRL.",
      foundation_plan_invalid_back_url: "Configure no Mercado Pago uma URL HTTPS de retorno para o plano Foundation.",
      invalid_foundation_interval: "O plano Foundation está disponível somente na cobrança mensal.",
    };
    throw new Error((payload.error && messages[payload.error]) || payload.error || "Não foi possível gerar o link de pagamento");
  }

  return {
    checkoutUrl: payload.checkoutUrl,
    preapprovalId: payload.preapprovalId ?? null,
    checkoutAttemptId: payload.checkoutAttemptId ?? null,
    changedInPlace: payload.changedInPlace === true,
    targetPlan: payload.targetPlan,
    nextChargeAt: payload.nextChargeAt ?? null,
    amount: payload.amount,
  };
}

export async function confirmPreapproval(
  preapprovalId: string | undefined,
  idToken: string,
  expectedPlan?: Exclude<UserPlan, "free">,
  checkoutAttemptId?: string
): Promise<{ targetPlan: UserPlan; targetPaymentStatus: string }> {
  const response = await fetch("/api/billing/confirm-preapproval", {
    method: "POST",
    headers: authHeaders(idToken, true),
    body: JSON.stringify({
      preapprovalId: preapprovalId || undefined,
      expectedPlan,
      checkoutAttemptId: checkoutAttemptId || undefined,
    }),
  });

  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    targetPlan?: UserPlan;
    targetPaymentStatus?: string;
  };

  if (!response.ok || !payload.ok || !payload.targetPlan || !payload.targetPaymentStatus) {
    throw new Error(payload.error || "Não foi possível confirmar a assinatura");
  }

  return {
    targetPlan: payload.targetPlan,
    targetPaymentStatus: payload.targetPaymentStatus,
  };
}

export async function getBillingHistory(
  idToken: string,
  params?: { page?: number; limit?: number }
): Promise<BillingHistoryPage> {
  const query = new URLSearchParams();
  query.set("page", String(Math.max(1, Number(params?.page || 1))));
  query.set("limit", String(Math.max(1, Math.min(100, Number(params?.limit || 8)))));

  const response = await fetch(`/api/billing/history?${query.toString()}`, {
    method: "GET",
    headers: authHeaders(idToken),
  });

  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    history?: BillingHistoryItem[];
    page?: number;
    limit?: number;
    total?: number;
  };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível carregar o histórico");
  }

  return {
    history: Array.isArray(payload.history) ? payload.history : [],
    page: Number(payload.page || params?.page || 1),
    limit: Number(payload.limit || params?.limit || 8),
    total: Number(payload.total || 0),
  };
}

export async function cancelSubscription(
  idToken: string
): Promise<{ targetPlan: UserPlan; targetPaymentStatus: string }> {
  const response = await fetch("/api/billing/cancel-subscription", {
    method: "POST",
    headers: authHeaders(idToken, true),
  });

  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    targetPlan?: UserPlan;
    targetPaymentStatus?: string;
  };

  if (!response.ok || !payload.ok || !payload.targetPlan || !payload.targetPaymentStatus) {
    throw new Error(payload.error || "Não foi possível cancelar a assinatura");
  }

  return {
    targetPlan: payload.targetPlan,
    targetPaymentStatus: payload.targetPaymentStatus,
  };
}
