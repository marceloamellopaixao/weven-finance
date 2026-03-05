import { UserPlan } from "@/types/user";

export async function getCheckoutLink(plan: Exclude<UserPlan, "free">, idToken: string): Promise<string> {
  const response = await fetch(`/api/billing/checkout-link?plan=${plan}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  const payload = (await response.json()) as { ok: boolean; checkoutUrl?: string; error?: string };
  if (!response.ok || !payload.ok || !payload.checkoutUrl) {
    throw new Error(payload.error || "Nao foi possivel gerar o link de pagamento");
  }

  return payload.checkoutUrl;
}
