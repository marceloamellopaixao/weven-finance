import { UserPlan } from "@/types/user";

export async function getCheckoutLink(
  plan: Exclude<UserPlan, "free">,
  idToken: string
): Promise<{ checkoutUrl: string; preapprovalId?: string | null }> {
  const response = await fetch(`/api/billing/checkout-link?plan=${plan}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  const payload = (await response.json()) as {
    ok: boolean;
    checkoutUrl?: string;
    preapprovalId?: string | null;
    error?: string;
  };
  if (!response.ok || !payload.ok || !payload.checkoutUrl) {
    throw new Error(payload.error || "Nao foi possivel gerar o link de pagamento");
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
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
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
    throw new Error(payload.error || "Nao foi possivel confirmar a assinatura");
  }

  return {
    targetPlan: payload.targetPlan,
    targetPaymentStatus: payload.targetPaymentStatus,
  };
}

export async function cancelSubscription(
  idToken: string
): Promise<{ targetPlan: UserPlan; targetPaymentStatus: string }> {
  const response = await fetch("/api/billing/cancel-subscription", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
  });

  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    targetPlan?: UserPlan;
    targetPaymentStatus?: string;
  };

  if (!response.ok || !payload.ok || !payload.targetPlan || !payload.targetPaymentStatus) {
    throw new Error(payload.error || "Nao foi possivel cancelar a assinatura");
  }

  return {
    targetPlan: payload.targetPlan,
    targetPaymentStatus: payload.targetPaymentStatus,
  };
}
