import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_PLANS_CONFIG, PlansConfig } from "@/types/system";
import { resolveApiErrorStatus } from "@/lib/api/error";
import { requireAccessResource } from "@/lib/access-control/server";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLANS_CACHE_TTL_MS = 60000;
let plansCache: { at: number; value: PlansConfig } | null = null;

export async function GET() {
  try {
    if (plansCache && Date.now() - plansCache.at < PLANS_CACHE_TTL_MS) {
      return NextResponse.json(
        { ok: true, plans: plansCache.value },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
          },
        }
      );
    }

    const rows = await supabaseSelect("system_configs", {
      select: "key,data",
      filters: { key: "plans" },
      limit: 1,
    });
    const plans = rows.length > 0 ? ((rows[0].data as PlansConfig | undefined) ?? DEFAULT_PLANS_CONFIG) : DEFAULT_PLANS_CONFIG;
    plansCache = { at: Date.now(), value: plans };

    return NextResponse.json(
      { ok: true, plans },
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
    await requireAccessResource(request, "admin.plans.write", "write");

    const body = (await request.json()) as { plans?: PlansConfig };
    if (!body.plans || typeof body.plans !== "object") {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    await supabaseUpsertRows(
      "system_configs",
      [
        {
          key: "plans",
          data: body.plans,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "key" }
    );
    plansCache = { at: Date.now(), value: body.plans };
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

