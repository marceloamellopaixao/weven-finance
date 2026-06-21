import { getImpersonationHeader } from "@/lib/impersonation/client";
import { CreditCardSettings, CreditCardState } from "@/types/creditCard";
import { getAccessTokenOrThrow } from "@/services/auth/token";
import { getActiveWorkspaceId } from "@/services/workspaceService";

async function getIdTokenOrThrow() {
  return getAccessTokenOrThrow();
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

export async function getCreditCardState(): Promise<CreditCardState> {
  const response = await fetchWithAuth(withActiveWorkspace("/api/credit-card"), { method: "GET" });
  const payload = (await response.json()) as { ok: boolean; error?: string; settings?: CreditCardSettings; summary?: CreditCardState["summary"] };
  if (!response.ok || !payload.ok || !payload.settings || !payload.summary) {
    throw new Error(payload.error || "Não foi possível carregar cartão de crédito");
  }
  return { settings: payload.settings, summary: payload.summary };
}

export async function updateCreditCardSettings(input: Partial<CreditCardSettings>): Promise<CreditCardState> {
  const response = await fetchWithAuth("/api/credit-card", {
    method: "PUT",
    body: JSON.stringify(withActiveWorkspaceBody(input)),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string; settings?: CreditCardSettings; summary?: CreditCardState["summary"] };
  if (!response.ok || !payload.ok || !payload.settings || !payload.summary) {
    throw new Error(payload.error || "Não foi possível salvar configurações do cartão");
  }
  return { settings: payload.settings, summary: payload.summary };
}

