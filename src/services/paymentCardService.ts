import { getAuth } from "firebase/auth";
import { getImpersonationHeader } from "@/lib/impersonation/client";
import { PaymentCard, PaymentCardIdentification } from "@/types/paymentCard";

async function getIdTokenOrThrow() {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("missing_auth_user");
  return currentUser.getIdToken();
}

async function fetchWithAuth(path: string, init?: RequestInit) {
  const idToken = await getIdTokenOrThrow();
  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      ...getImpersonationHeader(),
      ...(init?.headers || {}),
    },
  });
}

export async function getPaymentCards() {
  const response = await fetchWithAuth("/api/payment-cards", { method: "GET" });
  const payload = (await response.json()) as { ok: boolean; error?: string; cards?: PaymentCard[] };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Nao foi possivel carregar cartoes");
  }
  return payload.cards || [];
}

export async function createPaymentCard(
  input: Pick<PaymentCard, "bankName" | "last4" | "type" | "brand" | "bin" | "dueDate" | "limitEnabled" | "creditLimit" | "alertThresholdPct" | "blockOnLimitExceeded">
) {
  const response = await fetchWithAuth("/api/payment-cards", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string; id?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Nao foi possivel criar cartao");
  }
  return payload.id;
}

export async function updatePaymentCard(
  cardId: string,
  updates: Partial<Pick<PaymentCard, "bankName" | "last4" | "type" | "brand" | "bin" | "dueDate" | "limitEnabled" | "creditLimit" | "alertThresholdPct" | "blockOnLimitExceeded">>
) {
  const response = await fetchWithAuth("/api/payment-cards", {
    method: "PATCH",
    body: JSON.stringify({ cardId, updates }),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Nao foi possivel atualizar cartao");
  }
}

export async function deletePaymentCard(cardId: string) {
  const response = await fetchWithAuth(`/api/payment-cards?cardId=${encodeURIComponent(cardId)}`, {
    method: "DELETE",
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Nao foi possivel excluir cartao");
  }
}

export async function identifyPaymentCard(bin: string): Promise<PaymentCardIdentification> {
  const safeBin = String(bin || "").replace(/\D/g, "").slice(0, 8);
  if (safeBin.length < 6) {
    return { brand: null, bankName: null, suggestedType: null };
  }

  const response = await fetchWithAuth(`/api/payment-cards/identify?bin=${encodeURIComponent(safeBin)}`, {
    method: "GET",
  });

  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    identification?: PaymentCardIdentification;
  };

  if (!response.ok || !payload.ok || !payload.identification) {
    throw new Error(payload.error || "Nao foi possivel identificar cartao");
  }

  return payload.identification;
}
