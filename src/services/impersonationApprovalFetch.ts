"use client";

import { getImpersonationHeader } from "@/lib/impersonation/client";
import { getAccessTokenOrThrow } from "@/services/auth/token";
import { getImpersonationActionStatus } from "@/services/impersonationService";

async function authenticatedFetch(path: string, init?: RequestInit) {
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

async function waitForApproval(actionRequestId: string, timeoutMs = 120_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const { request } = await getImpersonationActionStatus(actionRequestId);
    if (request?.status === "approved") return;
    if (request?.status === "rejected" || request?.status === "expired") {
      throw new Error("impersonation_action_rejected");
    }
    await new Promise((resolve) => setTimeout(resolve, 2_500));
  }
  throw new Error("impersonation_action_timeout");
}

export async function fetchWithImpersonationApproval(path: string, init?: RequestInit) {
  const firstResponse = await authenticatedFetch(path, init);
  const firstPayload = await firstResponse.clone().json() as {
    error?: string;
    actionRequestId?: string;
  };

  if (
    firstResponse.status !== 409 ||
    firstPayload.error !== "impersonation_write_confirmation_required" ||
    !firstPayload.actionRequestId
  ) {
    return firstResponse;
  }

  await waitForApproval(firstPayload.actionRequestId);
  return authenticatedFetch(path, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      "x-impersonation-action-id": firstPayload.actionRequestId,
    },
  });
}
