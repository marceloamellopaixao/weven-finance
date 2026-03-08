import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/auth/server";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";

async function getUidFromBearer(request: NextRequest): Promise<string> {
  const auth = await verifyRequestAuth(request);
  return auth.uid;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const uid = await getUidFromBearer(request);
    const existingRows = await supabaseSelect("profiles", { filters: { uid }, limit: 1 });
    const raw = ((existingRows[0]?.raw as Record<string, unknown> | undefined) || {});
    raw.verifiedEmail = true;
    raw.status = "active";

    await supabaseUpsertRows(
      "profiles",
      [
        {
          uid,
          verified_email: true,
          status: "active",
          raw,
        },
      ],
      { onConflict: "uid" }
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

