import { NextRequest, NextResponse } from "next/server";
import { resolveApiErrorStatus } from "@/lib/api/error";
import { verifyRequestAuth } from "@/lib/auth/server";
import { normalizeFeatureAccessConfig } from "@/lib/plans/feature-access";
import { DEFAULT_FEATURE_ACCESS_CONFIG, FeatureAccessConfig } from "@/types/system";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";

async function getUidFromBearer(request: NextRequest): Promise<string> {
  const auth = await verifyRequestAuth(request);
  return auth.uid;
}

async function getRole(uid: string): Promise<string> {
  const rows = await supabaseSelect("profiles", {
    select: "role,raw",
    filters: { uid },
    limit: 1,
  });
  if (rows.length === 0) return "client";
  const raw = (rows[0].raw as Record<string, unknown> | null) ?? {};
  return String(rows[0].role || raw.role || "client");
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FEATURE_ACCESS_CACHE_TTL_MS = 60000;
let featureAccessCache: { at: number; value: FeatureAccessConfig } | null = null;

export async function GET() {
  try {
    if (featureAccessCache && Date.now() - featureAccessCache.at < FEATURE_ACCESS_CACHE_TTL_MS) {
      return NextResponse.json(
        { ok: true, featureAccess: featureAccessCache.value },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
          },
        }
      );
    }

    const rows = await supabaseSelect("system_configs", {
      select: "data",
      filters: { key: "feature_access" },
      limit: 1,
    });
    const featureAccess = rows.length > 0
      ? normalizeFeatureAccessConfig(rows[0]?.data)
      : DEFAULT_FEATURE_ACCESS_CONFIG;
    featureAccessCache = { at: Date.now(), value: featureAccess };

    return NextResponse.json(
      { ok: true, featureAccess },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ ok: false, error: message }, { status: resolveApiErrorStatus(message) });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const uid = await getUidFromBearer(request);
    const role = await getRole(uid);
    if (role !== "admin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { featureAccess?: FeatureAccessConfig };
    if (!body.featureAccess || typeof body.featureAccess !== "object") {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const normalized = normalizeFeatureAccessConfig(body.featureAccess);
    await supabaseUpsertRows(
      "system_configs",
      [
        {
          key: "feature_access",
          data: normalized,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "key" }
    );
    featureAccessCache = { at: Date.now(), value: normalized };
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
