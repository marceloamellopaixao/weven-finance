export const OPEN_SUPPORT_REPORTER_EVENT = "wevenfinance:support:open";

export function openSupportReporter() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_SUPPORT_REPORTER_EVENT));
}
