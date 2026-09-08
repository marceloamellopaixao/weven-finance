import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRateLimitIdentity,
  consumeMemoryRateLimit,
  rateLimitResponse,
  resolveTrustedClientIp,
  shouldFailClosedRateLimit,
  type RateLimitBucket,
} from "@/lib/api/rate-limit";

test("simulated instances share one atomic counter under concurrency", async () => {
  const shared = new Map<string, RateLimitBucket>();
  const consumeFromInstance = () => Promise.resolve().then(() =>
    consumeMemoryRateLimit(shared, "shared-instance-key", { max: 5, windowMs: 1_000 }, 100));
  const results = await Promise.all(Array.from({ length: 6 }, consumeFromInstance));
  assert.equal(results.filter((result) => result.allowed).length, 5);
  assert.equal(results.at(-1)?.remaining, 0);
});

test("supports byte costs and recovers after the window", () => {
  const store = new Map<string, RateLimitBucket>();
  assert.equal(consumeMemoryRateLimit(store, "bytes", { max: 10, windowMs: 1_000, cost: 8 }, 100).allowed, true);
  assert.equal(consumeMemoryRateLimit(store, "bytes", { max: 10, windowMs: 1_000, cost: 3 }, 200).allowed, false);
  assert.equal(consumeMemoryRateLimit(store, "bytes", { max: 10, windowMs: 1_000, cost: 3 }, 1_101).allowed, true);
});

test("does not trust spoofable forwarded headers without infrastructure configuration", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.10, 10.0.0.1" });
  assert.equal(resolveTrustedClientIp(headers, { NODE_ENV: "production" }), "untrusted-proxy");
  assert.equal(resolveTrustedClientIp(headers, { NODE_ENV: "production", RATE_LIMIT_TRUSTED_PROXY_HEADER: "x-forwarded-for" }), "203.0.113.10");
});

test("hashes the combined user, tenant and IP identity", () => {
  const headers = new Headers({ "x-real-ip": "203.0.113.10" });
  const env = { NODE_ENV: "production", RATE_LIMIT_TRUSTED_PROXY_HEADER: "x-real-ip", RATE_LIMIT_IP_HASH_SECRET: "test-secret" };
  const first = buildRateLimitIdentity(headers, { userId: "user-a", tenantId: "tenant-a" }, env);
  const second = buildRateLimitIdentity(headers, { userId: "user-a", tenantId: "tenant-b" }, env);
  assert.notEqual(first, second);
  assert.equal(first.includes("203.0.113.10"), false);
});

test("fails closed only for critical production routes", () => {
  assert.equal(shouldFailClosedRateLimit(true, { NODE_ENV: "production" }), true);
  assert.equal(shouldFailClosedRateLimit(false, { NODE_ENV: "production" }), false);
  assert.equal(shouldFailClosedRateLimit(true, { NODE_ENV: "test" }), false);
});

test("returns a consistent 429 response with Retry-After", async () => {
  const response = rateLimitResponse({ allowed: false, remaining: 0, resetAt: 10_000, retryAfterSeconds: 7, source: "memory", reason: "limit_exceeded" });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "7");
  assert.deepEqual(await response.json(), { ok: false, error: "rate_limited" });
});
