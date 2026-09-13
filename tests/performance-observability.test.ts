import assert from "node:assert/strict";
import test from "node:test";

import {
  isPerformanceMetricName,
  percentile,
  sanitizeMetricCategory,
  sanitizeMetricRoute,
} from "@/lib/observability/performance";

test("only accepts explicitly supported performance metrics", () => {
  assert.equal(isPerformanceMetricName("boot.app_loading"), true);
  assert.equal(isPerformanceMetricName("support.description"), false);
});

test("removes query strings and fragments from metric routes", () => {
  assert.equal(sanitizeMetricRoute("/dashboard?token=secret#saldo"), "/dashboard");
  assert.equal(sanitizeMetricRoute("https://example.com/private"), undefined);
});

test("rejects free text that could contain personal content", () => {
  assert.equal(sanitizeMetricCategory("timeout_error"), "timeout_error");
  assert.equal(sanitizeMetricCategory("Meu saldo é R$ 100"), undefined);
  assert.equal(sanitizeMetricCategory("user@example.com"), undefined);
});

test("calculates nearest-rank p50, p75 and p95", () => {
  const values = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1_000];
  assert.equal(percentile(values, 0.5), 500);
  assert.equal(percentile(values, 0.75), 800);
  assert.equal(percentile(values, 0.95), 1_000);
});
