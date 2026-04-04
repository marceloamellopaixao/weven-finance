"use client";

const PENDING_VERIFICATION_EMAIL_KEY = "wevenfinance.pending_verification.email";

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function buildEmailVerificationRedirectUrl() {
  return new URL("/verify-email", window.location.origin).toString();
}

export function rememberPendingVerificationEmail(email: string) {
  if (!canUseBrowserStorage()) return;
  window.localStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, email);
}

export function readPendingVerificationEmail() {
  if (!canUseBrowserStorage()) return null;
  return window.localStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY);
}

export function clearPendingVerificationEmail() {
  if (!canUseBrowserStorage()) return;
  window.localStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
}
