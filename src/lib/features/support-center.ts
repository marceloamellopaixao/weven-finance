import { createHash } from "node:crypto";

type RolloutIdentity = {
  uid: string;
  role: string;
  environment?: string;
};

type RolloutEnvironment = Record<string, string | undefined>;

export type SupportCenterDecision = {
  enabled: boolean;
  reason: "disabled" | "environment" | "role" | "allowlist" | "percentage" | "excluded";
  bucket: number;
};

function csv(value: string | undefined) {
  return new Set(String(value || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean));
}

export function stableRolloutBucket(uid: string, salt = "support-center-v1") {
  const digest = createHash("sha256").update(`${salt}:${uid}`).digest();
  return digest.readUInt32BE(0) % 100;
}

export function evaluateSupportCenterRollout(
  identity: RolloutIdentity,
  env: RolloutEnvironment = process.env,
): SupportCenterDecision {
  const bucket = stableRolloutBucket(identity.uid, env.SUPPORT_CENTER_ROLLOUT_SALT || undefined);
  if (env.SUPPORT_CENTER_ENABLED !== "true") return { enabled: false, reason: "disabled", bucket };

  const environment = String(identity.environment || env.APP_ENV || env.VERCEL_ENV || env.NODE_ENV || "unknown").toLowerCase();
  const environments = csv(env.SUPPORT_CENTER_ENVIRONMENTS || "development,preview");
  if (!environments.has(environment)) return { enabled: false, reason: "environment", bucket };

  const allowlist = csv(env.SUPPORT_CENTER_INTERNAL_UIDS);
  if (allowlist.has(identity.uid.toLowerCase())) return { enabled: true, reason: "allowlist", bucket };

  const roles = csv(env.SUPPORT_CENTER_ALLOWED_ROLES);
  if (roles.size > 0 && !roles.has(identity.role.toLowerCase())) return { enabled: false, reason: "role", bucket };

  const percentage = Math.min(100, Math.max(0, Number(env.SUPPORT_CENTER_ROLLOUT_PERCENT || 0)));
  return bucket < percentage
    ? { enabled: true, reason: "percentage", bucket }
    : { enabled: false, reason: "excluded", bucket };
}
