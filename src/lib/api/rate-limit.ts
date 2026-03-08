import { NextRequest } from "next/server";

type LimitConfig = {
  key: string;
  max: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const memoryBuckets = new Map<string, Bucket>();

function now() {
  return Date.now();
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = (forwardedFor?.split(",")[0] || "unknown").trim();
  return ip || "unknown";
}

function cleanupMemoryBuckets(nowTs: number) {
  for (const [key, bucket] of memoryBuckets.entries()) {
    if (bucket.resetAt <= nowTs) memoryBuckets.delete(key);
  }
}

function checkMemoryRateLimit(request: NextRequest, config: LimitConfig) {
  const ts = now();
  cleanupMemoryBuckets(ts);

  const clientKey = getClientIp(request);
  const key = `${config.key}:${clientKey}`;
  const current = memoryBuckets.get(key);

  if (!current || current.resetAt <= ts) {
    const resetAt = ts + config.windowMs;
    memoryBuckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.max - 1, resetAt };
  }

  if (current.count >= config.max) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  memoryBuckets.set(key, current);
  return {
    allowed: true,
    remaining: Math.max(config.max - current.count, 0),
    resetAt: current.resetAt,
  };
}

async function checkUpstashRateLimit(request: NextRequest, config: LimitConfig) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const clientKey = getClientIp(request);
  const redisKey = `ratelimit:${config.key}:${clientKey}`;

  const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["PTTL", redisKey],
      ["PEXPIRE", redisKey, config.windowMs, "NX"],
    ]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`upstash_rate_limit_failed_${response.status}`);
  }

  const payload = (await response.json()) as Array<{ result?: unknown }>;
  const countRaw = payload?.[0]?.result;
  const ttlRaw = payload?.[1]?.result;
  const count = Number(countRaw);
  const ttl = Number(ttlRaw);
  const ts = now();
  const resetAt = Number.isFinite(ttl) && ttl > 0 ? ts + ttl : ts + config.windowMs;

  if (!Number.isFinite(count)) {
    return { allowed: true, remaining: config.max - 1, resetAt };
  }

  if (count > config.max) {
    return { allowed: false, remaining: 0, resetAt };
  }

  return {
    allowed: true,
    remaining: Math.max(config.max - count, 0),
    resetAt,
  };
}

export async function checkRateLimit(request: NextRequest, config: LimitConfig) {
  try {
    const upstashResult = await checkUpstashRateLimit(request, config);
    if (upstashResult) return upstashResult;
  } catch {
    // Fallback para memória local (dev/erro de rede/config)
  }
  return checkMemoryRateLimit(request, config);
}
