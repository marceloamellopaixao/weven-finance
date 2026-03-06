const IMPERSONATION_STORAGE_KEY = "wevenfinance:impersonation:targetUid";
const IMPERSONATION_EVENT = "wevenfinance:impersonation:changed";

function safeWindow(): Window | null {
  if (typeof window === "undefined") return null;
  return window;
}

export function getImpersonationTargetUid(): string | null {
  const w = safeWindow();
  if (!w) return null;
  const value = w.localStorage.getItem(IMPERSONATION_STORAGE_KEY)?.trim();
  return value || null;
}

export function setImpersonationTargetUid(targetUid: string) {
  const w = safeWindow();
  if (!w) return;
  w.localStorage.setItem(IMPERSONATION_STORAGE_KEY, targetUid);
  w.dispatchEvent(new CustomEvent(IMPERSONATION_EVENT));
}

export function clearImpersonationTargetUid() {
  const w = safeWindow();
  if (!w) return;
  w.localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
  w.dispatchEvent(new CustomEvent(IMPERSONATION_EVENT));
}

export function getImpersonationHeader(): Record<string, string> {
  const targetUid = getImpersonationTargetUid();
  if (!targetUid) return {};
  return { "x-impersonate-uid": targetUid };
}

export function subscribeToImpersonationChange(onChange: (targetUid: string | null) => void) {
  const w = safeWindow();
  if (!w) return () => {};

  const handler = () => onChange(getImpersonationTargetUid());
  w.addEventListener("storage", handler);
  w.addEventListener(IMPERSONATION_EVENT, handler as EventListener);
  return () => {
    w.removeEventListener("storage", handler);
    w.removeEventListener(IMPERSONATION_EVENT, handler as EventListener);
  };
}

