"use client";

import { getAccessTokenOrThrow } from "@/services/auth/token";
import { getImpersonationHeader } from "@/lib/impersonation/client";
import { subscribeToTableChanges } from "@/services/supabase/realtime";

export type OnboardingStatus = {
  dismissed: boolean;
  completed: boolean;
  progress: number;
  total: number;
  steps: {
    firstTransaction: boolean;
    firstCard: boolean;
    firstGoal: boolean;
    profileMenu: boolean;
  };
};

type OnboardingUpdatePayload = {
  dismissed?: boolean;
  steps?: Partial<OnboardingStatus["steps"]>;
};

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
  const response = await apiFetch("/api/onboarding", { method: "GET" });
  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    onboarding?: OnboardingStatus;
  };
  if (!response.ok || !payload.ok || !payload.onboarding) {
    throw new Error(payload.error || "erro_carregar_onboarding");
  }
  return payload.onboarding;
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
  const stopTransactions = subscribeToTableChanges({ table: "transactions", filter: `uid=eq.${uid}`, onChange: () => void run() });
  const stopCards = subscribeToTableChanges({ table: "payment_cards", filter: `uid=eq.${uid}`, onChange: () => void run() });
  const stopGoals = subscribeToTableChanges({ table: "piggy_banks", filter: `uid=eq.${uid}`, onChange: () => void run() });
  const stopSettings = subscribeToTableChanges({ table: "user_settings", filter: `uid=eq.${uid}`, onChange: () => void run() });

  return () => {
    cancelled = true;
    stopTransactions();
    stopCards();
    stopGoals();
    stopSettings();
  };
}
