import { getAccessTokenOrThrow } from "@/services/auth/token";
import { getImpersonationHeader } from "@/lib/impersonation/client";
import {
  AppearancePreferences,
  DEFAULT_APPEARANCE_PREFERENCES,
} from "@/types/appearance";
import { normalizeAppearancePreferences } from "@/lib/appearance/preferences";
import { isAuthErrorMessage } from "@/lib/api/error";

const APPEARANCE_CHANGED_EVENT = "wevenfinance:appearance-settings:changed";

function emitAppearanceChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(APPEARANCE_CHANGED_EVENT));
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

export async function getAppearancePreferences() {
  try {
    const response = await apiFetch("/api/user-settings/appearance", { method: "GET" });
    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      appearance?: AppearancePreferences;
    };

    if (!response.ok || !payload.ok || !payload.appearance) {
      return DEFAULT_APPEARANCE_PREFERENCES;
    }

    return normalizeAppearancePreferences(payload.appearance);
  } catch (error) {
    if (error instanceof Error && isAuthErrorMessage(error.message)) {
      return DEFAULT_APPEARANCE_PREFERENCES;
    }
    return DEFAULT_APPEARANCE_PREFERENCES;
  }
}

export async function updateAppearancePreferences(next: AppearancePreferences) {
  const response = await apiFetch("/api/user-settings/appearance", {
    method: "PUT",
    body: JSON.stringify({ appearance: next }),
  });

  const payload = (await response.json()) as {
    ok?: boolean;
    error?: string;
    appearance?: AppearancePreferences;
  };

  if (!response.ok || !payload.ok || !payload.appearance) {
    throw new Error(payload.error || "Nao foi possivel atualizar a aparencia");
  }

  emitAppearanceChanged();
  return normalizeAppearancePreferences(payload.appearance);
}

export function subscribeToAppearanceSettings(onChange: () => void) {
  const handler = () => onChange();
  window.addEventListener(APPEARANCE_CHANGED_EVENT, handler);
  return () => window.removeEventListener(APPEARANCE_CHANGED_EVENT, handler);
}
