"use client";

const ACCOUNT_DELETION_SESSION_KEY = "wevenfinance:account-deletion-requested";

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function rememberAccountDeletionRequest() {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.setItem(ACCOUNT_DELETION_SESSION_KEY, "1");
}

export function hasAccountDeletionRequest() {
  if (!canUseSessionStorage()) return false;
  return window.sessionStorage.getItem(ACCOUNT_DELETION_SESSION_KEY) === "1";
}
