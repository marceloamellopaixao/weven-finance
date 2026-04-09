import { getAccessTokenOrThrow } from "@/services/auth/token";
import { getImpersonationHeader } from "@/lib/impersonation/client";
import {
  DEFAULT_NAVIGATION_PREFERENCES,
  NavigationPreferences,
} from "@/types/navigation";
import { normalizeNavigationPreferences } from "@/lib/navigation/apps";

const NAVIGATION_CHANGED_EVENT = "wevenfinance:navigation-settings:changed";

function emitNavigationChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NAVIGATION_CHANGED_EVENT));
}

async function apiFetch(path: string, init?: RequestInit) {
  const idToken = await getAccessTokenOrThrow();
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

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForActionApproval(actionRequestId: string, timeoutMs = 120000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const response = await apiFetch(`/api/impersonation?actionRequestId=${encodeURIComponent(actionRequestId)}`, {
      method: "GET",
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      request?: { status?: string } | null;
    };
    const status = payload.request?.status;
    if (status === "approved") return;
    if (status === "rejected" || status === "expired") {
      throw new Error("impersonation_action_rejected");
    }
    await sleep(2500);
  }
  throw new Error("impersonation_action_timeout");
}

async function apiFetchWithOptionalApproval(path: string, init?: RequestInit) {
  const response = await apiFetch(path, init);
  const payload = (await response.json()) as {
    ok?: boolean;
    error?: string;
    actionRequestId?: string;
    navigation?: NavigationPreferences;
  };

  if (
    response.status === 409 &&
    payload.error === "impersonation_write_confirmation_required" &&
    payload.actionRequestId
  ) {
    await waitForActionApproval(payload.actionRequestId);
    const retry = await apiFetch(path, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        "x-impersonation-action-id": payload.actionRequestId,
      },
    });
    const retryPayload = (await retry.json()) as {
      ok?: boolean;
      error?: string;
      navigation?: NavigationPreferences;
    };
    return { response: retry, payload: retryPayload };
  }

  return { response, payload };
}

export async function getNavigationPreferences() {
  const response = await apiFetch("/api/user-settings/navigation", { method: "GET" });
  const payload = (await response.json()) as {
    ok?: boolean;
    error?: string;
    navigation?: NavigationPreferences;
  };
  if (!response.ok || !payload.ok || !payload.navigation) {
    return DEFAULT_NAVIGATION_PREFERENCES;
  }
  return normalizeNavigationPreferences(payload.navigation);
}

export async function updateNavigationPreferences(next: NavigationPreferences) {
  const { response, payload } = await apiFetchWithOptionalApproval("/api/user-settings/navigation", {
    method: "PUT",
    body: JSON.stringify({ navigation: next }),
  });

  if (!response.ok || !payload.ok || !payload.navigation) {
    throw new Error(payload.error || "Não foi possível atualizar os atalhos");
  }

  emitNavigationChanged();
  return normalizeNavigationPreferences(payload.navigation);
}

export function subscribeToNavigationSettings(onChange: () => void) {
  const handler = () => onChange();
  window.addEventListener(NAVIGATION_CHANGED_EVENT, handler);
  return () => window.removeEventListener(NAVIGATION_CHANGED_EVENT, handler);
}
