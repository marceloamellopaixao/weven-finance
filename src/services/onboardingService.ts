"use client";

import { getAccessTokenOrThrow } from "@/services/auth/token";
import { getImpersonationHeader } from "@/lib/impersonation/client";
import { subscribeToTableChanges } from "@/services/supabase/realtime";

export type OnboardingStatus = {
  dismissed: boolean;
  completed: boolean;
  progress: number;
  total: number;
  tourCompleted: boolean;
  steps: {
    firstTransaction: boolean;
    firstCard: boolean;
    firstGoal: boolean;
    profileMenu: boolean;
  };
};

type OnboardingUpdatePayload = {
  dismissed?: boolean;
  tourCompleted?: boolean;
  steps?: Partial<OnboardingStatus["steps"]>;
};

let onboardingCache: OnboardingStatus | null = null;
let onboardingCacheAt = 0;
let onboardingInFlight: Promise<OnboardingStatus> | null = null;
const ONBOARDING_CACHE_TTL_MS = 15_000;

async function apiFetch(path: string, init?: RequestInit) {
  const token = await getAccessTokenOrThrow();
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

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const now = Date.now();
  if (onboardingCache && now - onboardingCacheAt < ONBOARDING_CACHE_TTL_MS) return onboardingCache;
  if (onboardingInFlight) return onboardingInFlight;

  onboardingInFlight = (async () => {
    const response = await apiFetch("/api/onboarding", { method: "GET" });
    const payload = (await response.json()) as {
      ok: boolean;
      error?: string;
      onboarding?: OnboardingStatus;
    };
    if (!response.ok || !payload.ok || !payload.onboarding) {
      throw new Error(payload.error || "erro_carregar_onboarding");
    }
    onboardingCache = payload.onboarding;
    onboardingCacheAt = Date.now();
    return payload.onboarding;
  })();

  try {
    return await onboardingInFlight;
  } finally {
    onboardingInFlight = null;
  }
}

export async function updateOnboardingStatus(data: OnboardingUpdatePayload) {
  const response = await apiFetch("/api/onboarding", {
    method: "PUT",
    body: JSON.stringify(data),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "erro_atualizar_onboarding");
  }
  onboardingCache = null;
  onboardingCacheAt = 0;
}

export function subscribeToOnboarding(
  uid: string,
  onChange: (status: OnboardingStatus) => void,
  onError?: (error: Error) => void
) {
  let cancelled = false;

  const run = async () => {
    try {
      const status = await getOnboardingStatus();
      if (!cancelled) onChange(status);
    } catch (error) {
      if (!cancelled) onError?.(error as Error);
    }
  };

  void run();
  const stopSettings = subscribeToTableChanges({ table: "user_settings", filter: `uid=eq.${uid}`, onChange: () => void run() });

  return () => {
    cancelled = true;
    stopSettings();
  };
}
