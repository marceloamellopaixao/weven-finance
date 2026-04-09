import "server-only";

import { createClient } from "@supabase/supabase-js";

let cachedServiceClient: ReturnType<typeof createClient> | null = null;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSupabaseServiceUrl() {
  const value = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error("missing_supabase_env");
  }
  return value;
}

function getSupabaseServiceRoleKey() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) {
    throw new Error("missing_supabase_env");
  }
  return value;
}

export function getSupabaseServiceClient() {
  if (cachedServiceClient) return cachedServiceClient;

  cachedServiceClient = createClient(getSupabaseServiceUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedServiceClient;
}

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

export async function resolveSupabaseAuthUserId(input: {
  rawUid?: string | null;
  uid?: string | null;
  email?: string | null;
}) {
  const client = getSupabaseServiceClient();
  const candidateIds = Array.from(
    new Set([input.rawUid, input.uid].filter(isUuid))
  );

  for (const candidateId of candidateIds) {
    const result = await client.auth.admin.getUserById(candidateId);
    if (!result.error && result.data?.user?.id) {
      return result.data.user.id;
    }
  }

  const normalizedEmail = String(input.email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;

  const perPage = 200;
  for (let page = 1; page <= 25; page += 1) {
    const result = await client.auth.admin.listUsers({ page, perPage });
    if (result.error) {
      throw new Error(`supabase_auth_list_users_failed:${result.error.message}`);
    }

    const users = result.data?.users || [];
    const match = users.find((user) => String(user.email || "").trim().toLowerCase() === normalizedEmail);
    if (match?.id) {
      return match.id;
    }

    if (users.length < perPage) break;
  }

  return null;
}

export async function deleteSupabaseAuthUser(userId: string) {
  if (!isUuid(userId)) {
    throw new Error("supabase_auth_delete_failed:invalid_user_id");
  }

  const client = getSupabaseServiceClient();
  const result = await client.auth.admin.deleteUser(userId);
  if (result.error) {
    throw new Error(`supabase_auth_delete_failed:${result.error.message}`);
  }
}
