import { NextRequest, NextResponse } from "next/server";

import { requireAccessResource } from "@/lib/access-control/server";
import { resolveApiErrorStatus } from "@/lib/api/error";
import {
  DEFAULT_CATEGORY_PRESETS_CONFIG,
  normalizeCategoryPresetsConfig,
  type CategoryPresetsConfig,
} from "@/lib/categories/defaultCategories";
import { cacheCategoryPresetsConfig, getCategoryPresetsConfig } from "@/lib/categories/server";
import { supabaseUpsertRows } from "@/services/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAccessResource(request, "admin.plans.read", "read");
    const categoryPresets = await getCategoryPresetsConfig();
    return NextResponse.json({ ok: true, categoryPresets }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ ok: false, error: message }, { status: resolveApiErrorStatus(message) });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAccessResource(request, "admin.plans.write", "write");
    const body = (await request.json()) as { categoryPresets?: CategoryPresetsConfig };
    if (!body.categoryPresets || typeof body.categoryPresets !== "object") {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const categoryPresets = normalizeCategoryPresetsConfig(
      body.categoryPresets,
      DEFAULT_CATEGORY_PRESETS_CONFIG,
    );
    await supabaseUpsertRows("system_configs", [{
      key: "category_presets",
      data: categoryPresets,
      updated_at: new Date().toISOString(),
    }], { onConflict: "key" });
    cacheCategoryPresetsConfig(categoryPresets);

    return NextResponse.json({ ok: true, categoryPresets }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ ok: false, error: message }, { status: resolveApiErrorStatus(message) });
  }
}
