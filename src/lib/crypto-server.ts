import "server-only";

import crypto from "node:crypto";

const APP_SALT = "WEVEN_FINANCE_SECURE_SALT_2026";
const IV_LENGTH = 12;

function bufferToBase64(buffer: Buffer | Uint8Array) {
  return Buffer.from(buffer).toString("base64");
}

function deriveUserKey(uid: string) {
  return crypto.pbkdf2Sync(uid, APP_SALT, 100000, 32, "sha256");
}

export function encryptDataForUser(data: string | number, uid: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveUserKey(uid);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(data), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([encrypted, tag]);
  return `${bufferToBase64(iv)}:${bufferToBase64(combined)}`;
}
