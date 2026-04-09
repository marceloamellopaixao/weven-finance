import "server-only";

import { decryptServerPayload, encryptServerPayload } from "@/lib/secure-store/server";

export function readSecureSettingData<T extends object>(value: unknown) {
  const data = ((value as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  const securePayload = decryptServerPayload<T>(data.securePayload);

  return {
    ...data,
    ...(securePayload ?? {}),
  } as T & Record<string, unknown>;
}

export function writeSecureSettingData<T extends object>(
  payload: T,
  extras?: Record<string, unknown>
) {
  return {
    ...(extras ?? {}),
    securePayload: encryptServerPayload(payload),
  };
}
