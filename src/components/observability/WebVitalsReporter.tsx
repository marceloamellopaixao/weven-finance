"use client";

import { useReportWebVitals } from "next/web-vitals";
import { sendPerformanceMetric } from "@/lib/observability/client-performance";
import { isPerformanceMetricName } from "@/lib/observability/performance";

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    const name = `web_vital.${metric.name}`;
    if (!isPerformanceMetricName(name)) return;
    sendPerformanceMetric({ name, durationMs: metric.value, correlationId: metric.id, rating: metric.rating });
  });
  return null;
}
