import { NextRequest, NextResponse } from "next/server";
import { UserProfile } from "@/types/user";
import { verifyRequestAuth } from "@/lib/auth/server";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import { assertPhoneAvailable } from "@/lib/profile/server";

async function getAuthContext(request: NextRequest) {
  const decoded = await verifyRequestAuth(request);
  return { uid: decoded.uid, rawUid: decoded.rawUid, email: decoded.email || "" };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const body = (await request.json()) as { profile?: Partial<UserProfile> };
    const profile = body.profile || {};
    const normalizedPhone = await assertPhoneAvailable(profile.phone || "", auth.uid);

    const existingRows = await supabaseSelect("profiles", {
      filters: { uid: auth.uid },
      limit: 1,
    });

    if (existingRows.length === 0) {
      const newProfile: Partial<UserProfile> = {
        uid: auth.uid,
        email: auth.email,
        displayName: profile.displayName || "Usuário",
        completeName: profile.completeName || profile.displayName || "",
        phone: normalizedPhone,
        photoURL: profile.photoURL || "",
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
        authProviders: profile.authProviders || [],
        needsPasswordSetup: profile.needsPasswordSetup ?? false,
      };
      const rawProfile = { ...newProfile, authUserId: auth.rawUid };

      await supabaseUpsertRows(
        "profiles",
        [
          {
            uid: auth.uid,
            email: newProfile.email ?? "",
            display_name: newProfile.displayName ?? "",
            complete_name: newProfile.completeName ?? "",
            phone: normalizedPhone,
            photo_url: newProfile.photoURL ?? "",
            role: newProfile.role ?? "client",
            plan: newProfile.plan ?? "free",
            status: newProfile.status ?? "active",
            payment_status: newProfile.paymentStatus ?? "pending",
            billing: newProfile.billing ?? {},
            transaction_count: newProfile.transactionCount ?? 0,
            verified_email: Boolean(newProfile.verifiedEmail),
            created_at: newProfile.createdAt ?? new Date().toISOString(),
            raw: rawProfile,
          },
        ],
        { onConflict: "uid" }
      );
      return NextResponse.json({ ok: true, created: true }, { status: 200 });
    }

    const existing = existingRows[0];
    const raw = ((existing.raw as Record<string, unknown> | undefined) || {});
    const patch: Record<string, unknown> = { uid: auth.uid };
    let shouldUpdate = false;

    if (raw.authUserId !== auth.rawUid) {
      raw.authUserId = auth.rawUid;
      shouldUpdate = true;
    }

    if (profile.deletedAt === null) {
      raw.deletedAt = null;
      patch.deleted_at = null;
      shouldUpdate = true;
    }

    if (typeof profile.email === "string" && profile.email.trim() && profile.email !== existing.email) {
      patch.email = profile.email.trim();
      raw.email = profile.email.trim();
      shouldUpdate = true;
    }

    if (typeof profile.displayName === "string" && profile.displayName !== (existing.display_name ?? raw.displayName ?? "")) {
      patch.display_name = profile.displayName;
      raw.displayName = profile.displayName;
      shouldUpdate = true;
    }

    if (typeof profile.completeName === "string" && profile.completeName !== (existing.complete_name ?? raw.completeName ?? "")) {
      patch.complete_name = profile.completeName;
      raw.completeName = profile.completeName;
      shouldUpdate = true;
    }

    if (typeof profile.phone === "string" && normalizedPhone !== normalizePhone(String(existing.phone ?? raw.phone ?? ""))) {
      patch.phone = normalizedPhone;
      raw.phone = normalizedPhone;
      shouldUpdate = true;
    }

    if (typeof profile.photoURL === "string" && profile.photoURL !== (existing.photo_url ?? raw.photoURL ?? "")) {
      patch.photo_url = profile.photoURL;
      raw.photoURL = profile.photoURL;
      shouldUpdate = true;
    }

    if (typeof profile.verifiedEmail === "boolean" && profile.verifiedEmail !== (existing.verified_email ?? raw.verifiedEmail ?? false)) {
      patch.verified_email = profile.verifiedEmail;
      raw.verifiedEmail = profile.verifiedEmail;
      shouldUpdate = true;
    }

    if (typeof profile.needsPasswordSetup === "boolean" && profile.needsPasswordSetup !== (raw.needsPasswordSetup ?? false)) {
      raw.needsPasswordSetup = profile.needsPasswordSetup;
      shouldUpdate = true;
    }

    if (Array.isArray(profile.authProviders)) {
      const normalizedProviders = profile.authProviders.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
      const currentProviders = Array.isArray(raw.authProviders)
        ? raw.authProviders.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [];

      if (JSON.stringify(normalizedProviders) !== JSON.stringify(currentProviders)) {
        raw.authProviders = normalizedProviders;
        shouldUpdate = true;
      }
    }

    if (shouldUpdate) {
      patch.raw = raw;
      await supabaseUpsertRows("profiles", [patch], { onConflict: "uid" });
    }

    return NextResponse.json({ ok: true, created: false }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status =
      message === "missing_auth_token"
        ? 401
        : message === "phone_already_in_use"
          ? 409
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

