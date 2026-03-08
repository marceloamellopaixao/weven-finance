import { NextRequest, NextResponse } from "next/server";
import { UserProfile } from "@/types/user";
import { verifyRequestAuth } from "@/lib/auth/server";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";

async function getAuthContext(request: NextRequest) {
  const decoded = await verifyRequestAuth(request);
  return { uid: decoded.uid, email: decoded.email || "" };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const body = (await request.json()) as { profile?: Partial<UserProfile> };
    const profile = body.profile || {};

    const existingRows = await supabaseSelect("profiles", {
      filters: { uid: auth.uid },
      limit: 1,
    });

    if (existingRows.length === 0) {
      const newProfile: Partial<UserProfile> = {
        uid: auth.uid,
        email: auth.email,
        displayName: profile.displayName || "Usuario",
        completeName: profile.completeName || profile.displayName || "",
        phone: profile.phone || "",
        role: profile.role || "client",
        plan: profile.plan || "free",
        status: profile.status || "active",
        createdAt: new Date().toISOString(),
        paymentStatus: profile.paymentStatus || "pending",
        billing: profile.billing || {
          source: "system",
          lastSyncAt: new Date().toISOString(),
        },
        transactionCount: profile.transactionCount ?? 0,
        verifiedEmail: profile.verifiedEmail ?? false,
      };

      await supabaseUpsertRows(
        "profiles",
        [
          {
            uid: auth.uid,
            email: newProfile.email ?? "",
            display_name: newProfile.displayName ?? "",
            complete_name: newProfile.completeName ?? "",
            phone: newProfile.phone ?? "",
            role: newProfile.role ?? "client",
            plan: newProfile.plan ?? "free",
            status: newProfile.status ?? "active",
            payment_status: newProfile.paymentStatus ?? "pending",
            billing: newProfile.billing ?? {},
            transaction_count: newProfile.transactionCount ?? 0,
            verified_email: Boolean(newProfile.verifiedEmail),
            created_at: newProfile.createdAt ?? new Date().toISOString(),
            raw: newProfile,
          },
        ],
        { onConflict: "uid" }
      );
      return NextResponse.json({ ok: true, created: true }, { status: 200 });
    }

    const existing = existingRows[0];
    const raw = ((existing.raw as Record<string, unknown> | undefined) || {});
    if (profile.deletedAt === null) {
      raw.deletedAt = null;
      await supabaseUpsertRows(
        "profiles",
        [
          {
            uid: auth.uid,
            deleted_at: null,
            raw,
          },
        ],
        { onConflict: "uid" }
      );
    }

    return NextResponse.json({ ok: true, created: false }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

