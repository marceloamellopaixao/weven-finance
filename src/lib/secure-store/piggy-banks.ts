import "server-only";

import { decryptServerPayload, encryptServerPayload } from "@/lib/secure-store/server";

type PiggyPayload = Record<string, unknown>;

export function readSecurePiggyPayload(value: unknown) {
  const raw = ((value as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  const securePayload = decryptServerPayload<PiggyPayload>(raw.securePiggy);
  return {
    ...raw,
    ...(securePayload ?? {}),
  } as PiggyPayload;
}

export function writeSecurePiggyPayload(payload: PiggyPayload) {
  const {
    slug,
    name,
    goalType,
    totalSaved,
    cardId,
    cardLabel,
    withdrawalMode,
    yieldType,
    lastDepositAt,
    ...rest
  } = payload;

  return {
    ...rest,
    securePiggy: encryptServerPayload({
      slug,
      name,
      goalType,
      totalSaved,
      cardId,
      cardLabel,
      withdrawalMode,
      yieldType,
      lastDepositAt,
    }),
  };
}

export function readSecurePiggyHistoryPayload(value: unknown) {
  const raw = ((value as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  const securePayload = decryptServerPayload<PiggyPayload>(raw.secureHistory);
  return {
    ...raw,
    ...(securePayload ?? {}),
  } as PiggyPayload;
}

export function writeSecurePiggyHistoryPayload(payload: PiggyPayload) {
  const {
    piggyBankId,
    amount,
    sourceType,
    withdrawalMode,
    yieldType,
    cardId,
    cardLabel,
    appliedToCardLimit,
    adjustmentDirection,
    ...rest
  } = payload;

  return {
    ...rest,
    secureHistory: encryptServerPayload({
      piggyBankId,
      amount,
      sourceType,
      withdrawalMode,
      yieldType,
      cardId,
      cardLabel,
      appliedToCardLimit,
      adjustmentDirection,
    }),
  };
}
