import { getAuth } from "firebase/auth";
import { getImpersonationHeader } from "@/lib/impersonation/client";
import { PiggyBank, PiggyBankDetail, PiggyBankGoalType } from "@/types/piggyBank";

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

export async function getPiggyBanks(): Promise<PiggyBank[]> {
  const response = await fetchWithAuth("/api/piggy-banks", { method: "GET" });
  const payload = (await response.json()) as { ok: boolean; error?: string; piggyBanks?: PiggyBank[] };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível carregar porquinhos");
  }
  return payload.piggyBanks || [];
}

export async function getPiggyBankBySlug(slug: string): Promise<PiggyBankDetail> {
  const response = await fetchWithAuth(`/api/piggy-banks/${encodeURIComponent(slug)}`, { method: "GET" });
  const payload = (await response.json()) as { ok: boolean; error?: string; piggyBank?: PiggyBankDetail };
  if (!response.ok || !payload.ok || !payload.piggyBank) {
    throw new Error(payload.error || "Porquinho não encontrado");
  }
  return payload.piggyBank;
}

export interface SavePiggyDepositInput {
  goalType: PiggyBankGoalType;
  goalName: string;
  amount: number;
  withdrawalMode?: string;
  yieldType?: string;
  sourceType?: "bank" | "cash";
  cardId?: string;
}

export async function savePiggyDeposit(input: SavePiggyDepositInput) {
  const response = await fetchWithAuth("/api/piggy-banks", {
    method: "POST",
    body: JSON.stringify({
      action: "deposit",
      ...input,
    }),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string; slug?: string };
  if (!response.ok || !payload.ok || !payload.slug) {
    throw new Error(payload.error || "Não foi possível guardar o valor");
  }
  return payload.slug;
}
