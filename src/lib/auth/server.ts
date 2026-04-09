import { NextRequest } from "next/server";
import { resolveUserUidFromMetadata } from "@/lib/auth/user-uid";

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
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !apikey) {
    throw new Error("missing_supabase_env");
  }

  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("invalid_auth_token");
  }

  const user = (await response.json()) as {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  };

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
