import { getImpersonationHeader } from "@/lib/impersonation/client";
import { PiggyBank, PiggyBankDetail, PiggyBankGoalType } from "@/types/piggyBank";
import { getAccessTokenOrThrow } from "@/services/auth/token";
import { getActiveWorkspaceId } from "@/services/workspaceService";

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

function withActiveWorkspace(path: string) {
  const workspaceId = getActiveWorkspaceId();
  if (!workspaceId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}workspaceId=${encodeURIComponent(workspaceId)}`;
}

function withActiveWorkspaceBody<T extends Record<string, unknown>>(body: T): T & { workspaceId?: string } {
  const workspaceId = getActiveWorkspaceId();
  return workspaceId ? { ...body, workspaceId } : body;
}

export async function getPiggyBanks(): Promise<PiggyBank[]> {
  const response = await fetchWithAuth(withActiveWorkspace("/api/piggy-banks"), { method: "GET" });
  const payload = (await response.json()) as { ok: boolean; error?: string; piggyBanks?: PiggyBank[] };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível carregar porquinhos");
  }
  return payload.piggyBanks || [];
}

export async function getPiggyBankBySlug(
  slug: string,
  options?: { historyPage?: number; historyLimit?: number },
): Promise<PiggyBankDetail> {
  const historyPage = Math.max(1, Number(options?.historyPage || 1));
  const historyLimit = Math.max(1, Math.min(25, Number(options?.historyLimit || 10)));
  const path = withActiveWorkspace(
    `/api/piggy-banks/${encodeURIComponent(slug)}?historyPage=${historyPage}&historyLimit=${historyLimit}`,
  );
  const response = await fetchWithAuth(path, { method: "GET" });
  const payload = (await response.json()) as { ok: boolean; error?: string; piggyBank?: PiggyBankDetail };
  if (!response.ok || !payload.ok || !payload.piggyBank) {
    throw new Error(payload.error || "Não foi possível encontrar o porquinho");
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
    body: JSON.stringify(withActiveWorkspaceBody({
      action: "deposit",
      ...input,
    })),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string; slug?: string };
  if (!response.ok || !payload.ok || !payload.slug) {
    throw new Error(payload.error || "Não foi possível guardar o valor");
  }
  return payload.slug;
}

export interface UpdatePiggyBankInput {
  name: string;
  withdrawalMode?: string;
  yieldType?: string;
}

export async function updatePiggyBank(slug: string, input: UpdatePiggyBankInput) {
  const response = await fetchWithAuth(`/api/piggy-banks/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    body: JSON.stringify(withActiveWorkspaceBody({
      action: "edit",
      ...input,
    })),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string; piggyBank?: PiggyBankDetail };
  if (!response.ok || !payload.ok || !payload.piggyBank) {
    throw new Error(payload.error || "Não foi possível atualizar o porquinho");
  }
  return payload.piggyBank;
}

export async function adjustPiggyBankBalance(
  slug: string,
  input: {
    amount: number;
    direction: "deposit" | "withdraw";
    sourceType?: "bank" | "cash";
  }
) {
  const response = await fetchWithAuth(`/api/piggy-banks/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    body: JSON.stringify(withActiveWorkspaceBody({
      action: "adjustBalance",
      ...input,
    })),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string; piggyBank?: PiggyBankDetail };
  if (!response.ok || !payload.ok || !payload.piggyBank) {
    throw new Error(payload.error || "Não foi possível ajustar o saldo do porquinho");
  }
  return payload.piggyBank;
}

export async function deletePiggyBank(slug: string) {
  const response = await fetchWithAuth(withActiveWorkspace(`/api/piggy-banks/${encodeURIComponent(slug)}`), {
    method: "DELETE",
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível excluir o porquinho");
  }
}
