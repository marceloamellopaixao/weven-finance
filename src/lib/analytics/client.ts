"use client";

export type ProductEventName =
  | "landing_viewed"
  | "pricing_viewed"
  | "billing_interval_selected"
  | "plan_selected"
  | "registration_started"
  | "registration_completed"
  | "checkout_started"
  | "checkout_redirected"
  | "checkout_completed"
  | "checkout_failed";

const SESSION_KEY = "wevenfinance:analytics-session:v1";

function getSessionId() {
  if (typeof window === "undefined") return undefined;
  let value = sessionStorage.getItem(SESSION_KEY);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, value);
  }
  return value;
}

export function trackProductEvent(name: ProductEventName, properties?: Record<string, string | number | boolean | null>) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    name,
    sessionId: getSessionId(),
    path: window.location.pathname,
    properties: properties ?? {},
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics/events", new Blob([payload], { type: "application/json" }));
    return;
  }

  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  });
}
