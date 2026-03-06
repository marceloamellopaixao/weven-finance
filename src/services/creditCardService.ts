import { getAuth } from "firebase/auth";
import { getImpersonationHeader } from "@/lib/impersonation/client";
import { CreditCardSettings, CreditCardState } from "@/types/creditCard";

async function getIdTokenOrThrow() {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("missing_auth_user");
  return user.getIdToken();
}

async function fetchWithAuth(path: string, init?: RequestInit) {
  const token = await getIdTokenOrThrow();
  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...getImpersonationHeader(),
      ...(init?.headers || {}),
    },
  });
}

export async function getCreditCardState(): Promise<CreditCardState> {
  const response = await fetchWithAuth("/api/credit-card", { method: "GET" });
  const payload = (await response.json()) as { ok: boolean; error?: string; settings?: CreditCardSettings; summary?: CreditCardState["summary"] };
  if (!response.ok || !payload.ok || !payload.settings || !payload.summary) {
    throw new Error(payload.error || "Nao foi possivel carregar cartao de credito");
  }
  return { settings: payload.settings, summary: payload.summary };
}

export async function updateCreditCardSettings(input: Partial<CreditCardSettings>): Promise<CreditCardState> {
  const response = await fetchWithAuth("/api/credit-card", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string; settings?: CreditCardSettings; summary?: CreditCardState["summary"] };
  if (!response.ok || !payload.ok || !payload.settings || !payload.summary) {
    throw new Error(payload.error || "Nao foi possivel salvar configuracoes do cartao");
  }
  return { settings: payload.settings, summary: payload.summary };
}
