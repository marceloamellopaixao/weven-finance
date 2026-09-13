"use client";

import { getAccessTokenOrThrow } from "@/services/auth/token";

export async function requestMfaRecovery(clientRequestId: string) {
  const token = await getAccessTokenOrThrow();
  const response = await fetch("/api/auth/mfa-recovery", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": clientRequestId,
    },
    body: JSON.stringify({ clientRequestId }),
  });
  const payload = (await response.json()) as { ok?: boolean; error?: string; protocol?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.error || "mfa_recovery_failed");
  return payload.protocol || "";
}
