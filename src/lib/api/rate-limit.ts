import { createHash, createHmac } from "node:crypto";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";

export type RateLimitIdentity = { userId?: string | null; tenantId?: string | null };
export type LimitConfig = {
  key: string;
  max: number;
  windowMs: number;
  cost?: number;
  identity?: RateLimitIdentity;
  critical?: boolean;
};
export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  source: "redis" | "memory" | "fail-closed";
  reason?: "limit_exceeded" | "distributed_store_unavailable";
};
export type RateLimitBucket = { count: number; resetAt: number };

export class RateLimitExceededError extends Error {
  constructor(public readonly result: RateLimitResult) {
    super("rate_limited");
  }
}

export function assertRateLimit(rate: RateLimitResult) {
  if (!rate.allowed) throw new RateLimitExceededError(rate);
}

const memoryBuckets = new Map<string, RateLimitBucket>();
const ATOMIC_FIXED_WINDOW_LUA = `
local current = redis.call('INCRBY', KEYS[1], ARGV[2])
if current == tonumber(ARGV[2]) then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return {current, ttl}
`.trim();

function retryAfter(resetAt: number, timestamp: number) {
  return Math.max(1, Math.ceil((resetAt - timestamp) / 1000));
}

function normalizeIdentityPart(value: string | null | undefined, fallback: string) {
  const normalized = String(value || "").trim().slice(0, 180);
  return normalized || fallback;
}

export function resolveTrustedClientIp(headers: Headers, env: Record<string, string | undefined> = process.env) {
  let headerName = String(env.RATE_LIMIT_TRUSTED_PROXY_HEADER || "").trim().toLowerCase();
  if (!headerName && env.VERCEL === "1") headerName = "x-forwarded-for";
  if (!headerName && env.CF_PAGES === "1") headerName = "cf-connecting-ip";
  if (!headerName) return env.NODE_ENV === "production" ? "untrusted-proxy" : "local";
  const candidate = String(headers.get(headerName) || "").split(",", 1)[0].trim();
  return isIP(candidate) ? candidate : "invalid-proxy-ip";
}

export function buildRateLimitIdentity(headers: Headers, identity?: RateLimitIdentity, env: Record<string, string | undefined> = process.env) {
  const raw = [
    normalizeIdentityPart(identity?.userId, "anonymous"),
    normalizeIdentityPart(identity?.tenantId, "no-tenant"),
    resolveTrustedClientIp(headers, env),
  ].join("|");
  const secret = env.RATE_LIMIT_IP_HASH_SECRET;
  return secret ? createHmac("sha256", secret).update(raw).digest("hex") : createHash("sha256").update(raw).digest("hex");
}

export function shouldFailClosedRateLimit(critical: boolean | undefined, env: Record<string, string | undefined> = process.env) {
  return env.NODE_ENV === "production" && critical === true;
}

export function consumeMemoryRateLimit(store: Map<string, RateLimitBucket>, key: string, config: Pick<LimitConfig, "max" | "windowMs" | "cost">, timestamp = Date.now()): RateLimitResult {
  const cost = Math.max(1, Math.floor(config.cost || 1));
  const current = store.get(key);
  const bucket = !current || current.resetAt <= timestamp
    ? { count: cost, resetAt: timestamp + config.windowMs }
    : { count: current.count + cost, resetAt: current.resetAt };
  store.set(key, bucket);
  const allowed = bucket.count <= config.max;
  return { allowed, remaining: allowed ? Math.max(config.max - bucket.count, 0) : 0, resetAt: bucket.resetAt, retryAfterSeconds: retryAfter(bucket.resetAt, timestamp), source: "memory", reason: allowed ? undefined : "limit_exceeded" };
}

function cleanupMemoryBuckets(timestamp: number) {
  for (const [key, bucket] of memoryBuckets.entries()) if (bucket.resetAt <= timestamp) memoryBuckets.delete(key);
}

async function consumeRedisRateLimit(redisKey: string, config: LimitConfig): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const cost = Math.max(1, Math.floor(config.cost || 1));
  const response = await fetch(url.replace(/\/$/, ""), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(["EVAL", ATOMIC_FIXED_WINDOW_LUA, "1", redisKey, String(config.windowMs), String(cost)]),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`upstash_rate_limit_failed_${response.status}`);
  const payload = (await response.json()) as { result?: unknown; error?: string };
  if (payload.error || !Array.isArray(payload.result)) throw new Error("upstash_rate_limit_invalid_response");
  const count = Number(payload.result[0]);
  const ttl = Number(payload.result[1]);
  if (!Number.isFinite(count)) throw new Error("upstash_rate_limit_invalid_count");
  const timestamp = Date.now();
  const resetAt = timestamp + (Number.isFinite(ttl) && ttl > 0 ? ttl : config.windowMs);
  const allowed = count <= config.max;
  return { allowed, remaining: allowed ? Math.max(config.max - count, 0) : 0, resetAt, retryAfterSeconds: retryAfter(resetAt, timestamp), source: "redis", reason: allowed ? undefined : "limit_exceeded" };
}

export async function checkRateLimit(request: NextRequest, config: LimitConfig): Promise<RateLimitResult> {
  const identityHash = buildRateLimitIdentity(request.headers, config.identity);
  const redisKey = `ratelimit:${config.key}:${identityHash}`;
  try {
    const distributed = await consumeRedisRateLimit(redisKey, config);
    if (distributed) return distributed;
    if (shouldFailClosedRateLimit(config.critical)) throw new Error("distributed_rate_limit_not_configured");
  } catch {
    if (shouldFailClosedRateLimit(config.critical)) {
      const timestamp = Date.now();
      const resetAt = timestamp + Math.min(config.windowMs, 30_000);
      return { allowed: false, remaining: 0, resetAt, retryAfterSeconds: retryAfter(resetAt, timestamp), source: "fail-closed", reason: "distributed_store_unavailable" };
    }
  }
  const timestamp = Date.now();
  cleanupMemoryBuckets(timestamp);
  return consumeMemoryRateLimit(memoryBuckets, redisKey, config, timestamp);
}

export function rateLimitResponse(rate: RateLimitResult) {
  return NextResponse.json({ ok: false, error: "rate_limited" }, {
    status: 429,
    headers: {
      "Retry-After": String(rate.retryAfterSeconds),
      "X-RateLimit-Remaining": String(rate.remaining),
      "X-RateLimit-Reset": String(Math.ceil(rate.resetAt / 1000)),
    },
  });
}
