import { NextRequest } from "next/server";
import { resolveUserUidFromMetadata } from "@/lib/auth/user-uid";
import { getSupabaseServiceClient } from "@/services/supabase/service-client";

export type ServerAuthUser = {
  uid: string;
  email: string;
  name: string;
  provider: "supabase";
  rawUid: string;
};

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
}

async function verifySupabaseToken(token: string): Promise<ServerAuthUser> {
  const client = getSupabaseServiceClient();
  let lastError: string | null = null;
  let user:
    | {
        id: string;
        email?: string | null;
        user_metadata?: Record<string, unknown> | null;
      }
    | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await client.auth.getUser(token);
    if (!result.error && result.data.user) {
      user = result.data.user;
      break;
    }

    lastError = result.error?.message || "invalid_auth_token";
    if (!/fetch failed/i.test(lastError)) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
  }

  if (!user) {
    throw new Error(lastError && /fetch failed/i.test(lastError) ? "auth_service_unavailable" : "invalid_auth_token");
  }

  const metadata = user.user_metadata || {};
  const mappedUid = resolveUserUidFromMetadata(metadata, user.id);

  return {
    uid: mappedUid,
    rawUid: user.id,
    email: String(user.email || ""),
    name: String(metadata.displayName || "Usuário"),
    provider: "supabase",
  };
}

export async function verifyRequestAuth(request: NextRequest): Promise<ServerAuthUser> {
  const token = getBearerToken(request);
  if (!token) throw new Error("missing_auth_token");
  return verifySupabaseToken(token);
}
