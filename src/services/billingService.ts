import { getImpersonationHeader } from "@/lib/impersonation/client";
import { UserPlan } from "@/types/user";

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
  idToken: string
): Promise<{ checkoutUrl: string; preapprovalId?: string | null }> {
  const response = await fetch(`/api/billing/checkout-link?plan=${plan}`, {
    method: "GET",
    headers: authHeaders(idToken),
  });

  const payload = (await response.json()) as {
    ok: boolean;
    checkoutUrl?: string;
    preapprovalId?: string | null;
    error?: string;
  };
  if (!response.ok || !payload.ok || !payload.checkoutUrl) {
    throw new Error(payload.error || "Não foi possível gerar o link de pagamento");
  }

  return {
    checkoutUrl: payload.checkoutUrl,
    preapprovalId: payload.preapprovalId ?? null,
  };
}

export async function confirmPreapproval(
  preapprovalId: string | undefined,
  idToken: string,
  expectedPlan?: Exclude<UserPlan, "free">
): Promise<{ targetPlan: UserPlan; targetPaymentStatus: string }> {
  const response = await fetch("/api/billing/confirm-preapproval", {
    method: "POST",
    headers: authHeaders(idToken, true),
    body: JSON.stringify({
      preapprovalId: preapprovalId || undefined,
      expectedPlan,
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
