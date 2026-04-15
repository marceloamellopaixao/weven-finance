import { NextRequest, NextResponse } from "next/server";
import { resolveApiErrorStatus } from "@/lib/api/error";
import { verifyRequestAuth } from "@/lib/auth/server";
import { hasAccess, normalizeAccessControlConfig } from "@/lib/access-control/config";
import { DEFAULT_ACCESS_CONTROL_CONFIG, AccessControlConfig } from "@/types/system";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";

const CREATOR_SUPREME = "Z3ciyXudWuZZywhojA6iWJTurH52";
const ACCESS_CONTROL_CACHE_TTL_MS = 60000;
let accessControlCache: { at: number; value: AccessControlConfig } | null = null;

async function getUidFromBearer(request: NextRequest): Promise<string> {
  const auth = await verifyRequestAuth(request);
  return auth.uid;
}

async function getProfile(uid: string): Promise<{ role: string; plan: "free" | "premium" | "pro" }> {
  const rows = await supabaseSelect("profiles", {
    select: "role,plan,raw",
    filters: { uid },
    limit: 1,
  });
  const raw = (rows[0]?.raw as Record<string, unknown> | null) ?? {};
  const role = String(rows[0]?.role || raw.role || "client");
  const rawPlan = rows[0]?.plan ?? raw.plan;
  const plan = rawPlan === "premium" || rawPlan === "pro" ? rawPlan : "free";
  return { role, plan };
}

async function getCurrentConfig() {
  const rows = await supabaseSelect("system_configs", {
    select: "data",
    filters: { key: "access_control" },
    limit: 1,
  });
  return rows.length > 0
    ? normalizeAccessControlConfig(rows[0]?.data)
    : DEFAULT_ACCESS_CONTROL_CONFIG;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const uid = await getUidFromBearer(request);
    const [profile, accessControl] = await Promise.all([getProfile(uid), getCurrentConfig()]);
    if (
      uid !== CREATOR_SUPREME &&
      !hasAccess(accessControl, { uid, plan: profile.plan, role: profile.role }, "admin.permissions.read", "read")
    ) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    if (accessControlCache && Date.now() - accessControlCache.at < ACCESS_CONTROL_CACHE_TTL_MS) {
      return NextResponse.json({ ok: true, accessControl: accessControlCache.value }, { status: 200 });
    }

    accessControlCache = { at: Date.now(), value: accessControl };
    return NextResponse.json({ ok: true, accessControl }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ ok: false, error: message }, { status: resolveApiErrorStatus(message) });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const uid = await getUidFromBearer(request);
    const current = await getCurrentConfig();
    const profile = await getProfile(uid);
    if (
      uid !== CREATOR_SUPREME &&
      !hasAccess(current, { uid, plan: profile.plan, role: profile.role }, "admin.permissions.write", "write")
    ) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { accessControl?: AccessControlConfig };
    if (!body.accessControl || typeof body.accessControl !== "object") {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const normalized = normalizeAccessControlConfig(body.accessControl);

    if (uid !== CREATOR_SUPREME) {
      const incomingRuleIds = new Set(normalized.rules.map((rule) => rule.id));
      const incomingRoleKeys = new Set(normalized.roles.map((roleDefinition) => roleDefinition.key));
      const removedRule = current.rules.some((rule) => !incomingRuleIds.has(rule.id));
      const removedRole = current.roles.some((roleDefinition) => !incomingRoleKeys.has(roleDefinition.key));
      if (removedRule || removedRole) {
        return NextResponse.json({ ok: false, error: "delete_forbidden" }, { status: 403 });
      }
    }

    await supabaseUpsertRows(
      "system_configs",
      [
        {
          key: "access_control",
          data: normalized,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "key" }
    );
    accessControlCache = { at: Date.now(), value: normalized };
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ ok: false, error: message }, { status: resolveApiErrorStatus(message) });
  }
}
