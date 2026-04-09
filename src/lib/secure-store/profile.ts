import "server-only";

import { decryptServerPayload, encryptServerPayload } from "@/lib/secure-store/server";

type SecureProfilePayload = {
  email?: string;
  displayName?: string;
  completeName?: string;
  phone?: string;
};

export function readSecureProfilePayload(value: unknown) {
  const raw = ((value as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  const securePayload = decryptServerPayload<SecureProfilePayload>(raw.secureProfile);
  return {
    ...raw,
    ...(securePayload ?? {}),
  } as Record<string, unknown>;
}

export function writeSecureProfilePayload(payload: Record<string, unknown>) {
  const rest = { ...payload };
  delete rest.secureProfile;
  const { email, displayName, completeName, phone } = rest;

  return {
    ...rest,
    secureProfile: encryptServerPayload({
      email,
      displayName,
      completeName,
      phone,
    }),
  };
}
