"use client";

import type { PerformanceMetricName } from "@/lib/observability/performance";

export function createCorrelationId() {
  return crypto.randomUUID();
}

export function sendPerformanceMetric(input: {
  name: PerformanceMetricName;
  durationMs: number;
  correlationId?: string;
  rating?: "good" | "needs-improvement" | "poor";
  errorCode?: string;
  route?: string;
}) {
  if (typeof window === "undefined") return;
  void fetch("/api/observability/performance", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Request-Id": input.correlationId || createCorrelationId() },
    body: JSON.stringify({ ...input, route: input.route || window.location.pathname }),
    keepalive: true,
  }).catch(() => undefined);
}
