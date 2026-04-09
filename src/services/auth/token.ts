"use client";

import { resolveUserUidFromMetadata } from "@/lib/auth/user-uid";
import { getSupabaseClient, isSupabaseAuthEnabled } from "@/services/supabase/client";

export async function getAccessTokenOrThrow() {
  if (!isSupabaseAuthEnabled()) {
    throw new Error("supabase_auth_disabled");
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("missing_auth_token");
  return data.session.access_token;
}

export async function getCurrentUidOrThrow() {
  if (!isSupabaseAuthEnabled()) {
    throw new Error("supabase_auth_disabled");
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("missing_auth_user");
  return resolveUserUidFromMetadata(data.user.user_metadata || {}, data.user.id);
}
