import "server-only";

import crypto from "node:crypto";

const SECURE_VERSION = "encv1";
const IV_LENGTH = 12;

function getSecureStoreSecret() {
  return (
    process.env.APP_DATA_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "weven-finance-local-encryption-fallback"
  );
}

function getSecureStoreKey() {
  return crypto.createHash("sha256").update(getSecureStoreSecret()).digest();
}

export function encryptServerPayload(value: unknown) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", getSecureStoreKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${SECURE_VERSION}:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptServerPayload<T>(value: unknown): T | null {
  if (typeof value !== "string" || !value.startsWith(`${SECURE_VERSION}:`)) {
    return null;
  }

  const [, ivB64, tagB64, encryptedB64] = value.split(":");
  if (!ivB64 || !tagB64 || !encryptedB64) {
    return null;
  }

  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getSecureStoreKey(),
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedB64, "base64")),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString("utf8")) as T;
  } catch {
    return null;
  }
}
