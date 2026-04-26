"use client";

const POST_AUTH_REDIRECT_KEY = "wevenfinance:post-auth-redirect:v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizePath(path: string | null | undefined) {
  if (!path) return null;
  const value = path.trim();
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}

export function rememberPostAuthRedirect(path: string) {
  if (!canUseStorage()) return;
  const normalized = normalizePath(path);
  if (!normalized) return;
  window.localStorage.setItem(POST_AUTH_REDIRECT_KEY, normalized);
}

export function readPostAuthRedirect() {
  if (!canUseStorage()) return null;
  return normalizePath(window.localStorage.getItem(POST_AUTH_REDIRECT_KEY));
}

export function clearPostAuthRedirect() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(POST_AUTH_REDIRECT_KEY);
}

export function buildBrowserRedirectUrl(path: string) {
  const fallbackOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  return new URL(path, fallbackOrigin).toString();
}
