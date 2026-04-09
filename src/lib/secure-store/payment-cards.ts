import "server-only";

import { decryptServerPayload, encryptServerPayload } from "@/lib/secure-store/server";

type CardPayload = Record<string, unknown>;

export function readSecureCardPayload(value: unknown) {
  const raw = ((value as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  const securePayload = decryptServerPayload<CardPayload>(raw.secureCard);
  return {
    ...raw,
    ...(securePayload ?? {}),
  } as CardPayload;
}

export function writeSecureCardPayload(payload: CardPayload) {
  const {
    bankName,
    last4,
    brand,
    bin,
    dueDate,
    type,
    limitEnabled,
    creditLimit,
    alertThresholdPct,
    blockOnLimitExceeded,
    ...rest
  } = payload;

  return {
    ...rest,
    secureCard: encryptServerPayload({
      bankName,
      last4,
      brand,
      bin,
      dueDate,
      type,
      limitEnabled,
      creditLimit,
      alertThresholdPct,
      blockOnLimitExceeded,
    }),
  };
}
