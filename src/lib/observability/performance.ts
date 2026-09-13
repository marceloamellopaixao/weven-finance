export const PERFORMANCE_METRIC_NAMES = [
  "boot.session_restore",
  "boot.profile_plan_permissions",
  "boot.workspace_impersonation",
  "boot.app_loading",
  "dashboard.first_data",
  "support.ticket_submit",
  "support.evidence_upload",
  "web_vital.CLS",
  "web_vital.FCP",
  "web_vital.INP",
  "web_vital.LCP",
  "web_vital.TTFB",
] as const;

export type PerformanceMetricName = (typeof PERFORMANCE_METRIC_NAMES)[number];

export const PERFORMANCE_BUDGETS_MS: Partial<Record<PerformanceMetricName, number>> = {
  "boot.session_restore": 800,
  "boot.profile_plan_permissions": 1_200,
  "boot.workspace_impersonation": 1_000,
  "boot.app_loading": 2_000,
  "dashboard.first_data": 1_800,
  "support.ticket_submit": 3_000,
  "support.evidence_upload": 5_000,
  "web_vital.FCP": 1_800,
  "web_vital.INP": 200,
  "web_vital.LCP": 2_500,
  "web_vital.TTFB": 800,
};

export function isPerformanceMetricName(value: unknown): value is PerformanceMetricName {
  return typeof value === "string" && (PERFORMANCE_METRIC_NAMES as readonly string[]).includes(value);
}

export function sanitizeMetricRoute(value: unknown) {
  if (typeof value !== "string") return undefined;
  const route = value.split(/[?#]/, 1)[0].trim();
  return route.startsWith("/") ? route.slice(0, 240) : undefined;
}

export function sanitizeMetricCategory(value: unknown) {
  if (typeof value !== "string") return undefined;
  const category = value.trim().toLowerCase();
  return /^[a-z0-9_.-]{1,64}$/.test(category) ? category : undefined;
}

export function percentile(values: number[], quantile: number) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const index = Math.ceil(Math.min(1, Math.max(0, quantile)) * sorted.length) - 1;
  return Math.round(sorted[Math.max(0, index)] * 100) / 100;
}
