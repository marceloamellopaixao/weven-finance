"use client";

import { getSupabaseClient } from "@/services/supabase/client";

export type PasswordAccessIntent = "first-access" | "change-password" | "recovery";

const PASSWORD_ACCESS_INTENT_KEY = "wevenfinance.password_access.intent";
const PASSWORD_ACCESS_EMAIL_KEY = "wevenfinance.password_access.email";

function isPasswordAccessIntent(value: string | null): value is PasswordAccessIntent {
  return value === "first-access" || value === "change-password" || value === "recovery";
}

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function buildPasswordAccessRedirectUrl() {
  return new URL("/first-access", window.location.origin).toString();
}

export function rememberPasswordAccessContext(intent: PasswordAccessIntent, email?: string) {
  if (!canUseBrowserStorage()) return;
  window.localStorage.setItem(PASSWORD_ACCESS_INTENT_KEY, intent);
  if (email) {
    window.localStorage.setItem(PASSWORD_ACCESS_EMAIL_KEY, email);
  }
}

export function readPasswordAccessIntent(): PasswordAccessIntent | null {
  if (!canUseBrowserStorage()) return null;
  const value = window.localStorage.getItem(PASSWORD_ACCESS_INTENT_KEY);
  return isPasswordAccessIntent(value) ? value : null;
}

export function readPasswordAccessEmail() {
  if (!canUseBrowserStorage()) return null;
  return window.localStorage.getItem(PASSWORD_ACCESS_EMAIL_KEY);
}

export function clearPasswordAccessContext() {
  if (!canUseBrowserStorage()) return;
  window.localStorage.removeItem(PASSWORD_ACCESS_INTENT_KEY);
  window.localStorage.removeItem(PASSWORD_ACCESS_EMAIL_KEY);
}

export async function sendPasswordAccessEmail(email: string, intent: PasswordAccessIntent) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: buildPasswordAccessRedirectUrl(),
  });

  if (error) {
    throw new Error(error.message || "Erro ao enviar e-mail de acesso.");
  }

  rememberPasswordAccessContext(intent, email);
}

export async function updateCurrentUserPassword(password: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) {
    throw new Error(error.message || "Erro ao atualizar senha.");
  }
  return data.user;
}
