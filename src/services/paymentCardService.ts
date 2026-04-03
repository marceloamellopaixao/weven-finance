import { getImpersonationHeader } from "@/lib/impersonation/client";
import { PaymentCard, PaymentCardIdentification } from "@/types/paymentCard";
import { getAccessTokenOrThrow } from "@/services/auth/token";
import { subscribeToTableChanges } from "@/services/supabase/realtime";

const PAYMENT_CARDS_CHANGED_EVENT = "wevenfinance:payment-cards:changed";

function emitPaymentCardsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PAYMENT_CARDS_CHANGED_EVENT));
}

async function getIdTokenOrThrow() {
  return getAccessTokenOrThrow();
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
    throw new Error(payload.error || "Não foi possível carregar cartões");
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
    throw new Error(payload.error || "Não foi possível criar cartão");
  }
  emitPaymentCardsChanged();
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
    throw new Error(payload.error || "Não foi possível atualizar cartão");
  }
  emitPaymentCardsChanged();
}

export async function deletePaymentCard(cardId: string) {
  const response = await fetchWithAuth(`/api/payment-cards?cardId=${encodeURIComponent(cardId)}`, {
    method: "DELETE",
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível excluir cartão");
  }
  emitPaymentCardsChanged();
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
    throw new Error(payload.error || "Não foi possível identificar cartão");
  }

  return payload.identification;
}

export const subscribeToPaymentCards = (
  uid: string,
  onChange: (cards: PaymentCard[]) => void,
  onError?: (error: Error) => void
) => {
  let cancelled = false;

  const run = async () => {
    try {
      const cards = await getPaymentCards();
      if (!cancelled) onChange(cards);
    } catch (error) {
      if (!cancelled) onError?.(error as Error);
    }
  };

  void run();
  const stopRealtime = subscribeToTableChanges({
    table: "payment_cards",
    filter: `uid=eq.${uid}`,
    onChange: () => void run(),
  });
  const onChangedEvent = () => void run();
  window.addEventListener(PAYMENT_CARDS_CHANGED_EVENT, onChangedEvent);

  return () => {
    cancelled = true;
    stopRealtime();
    window.removeEventListener(PAYMENT_CARDS_CHANGED_EVENT, onChangedEvent);
  };
};

