"use client";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cachedClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (cachedClient) return cachedClient;
  if (!url || !anon) {
    throw new Error("missing_supabase_public_env");
  }
  cachedClient = createClient(url, anon);
  return cachedClient;
}

export function isSupabaseAuthEnabled() {
  return process.env.NEXT_PUBLIC_SUPABASE_AUTH_ENABLED === "true";
}
