import { NextRequest, NextResponse } from "next/server";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { resolveApiErrorStatus } from "@/lib/api/error";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { resolveEffectiveBillingState } from "@/lib/billing/effective";
import { hasBillingExemption } from "@/lib/access-control/config";
import { getServerAccessControlConfig } from "@/lib/access-control/server";
import { normalizePhone } from "@/lib/phone";
import { assertPhoneAvailable } from "@/lib/profile/server";
import { readSecureProfilePayload, writeSecureProfilePayload } from "@/lib/secure-store/profile";
import { resolvePermanentDeleteAt } from "@/lib/account-deletion/policy";
import { BillingInfo, UserPaymentStatus, UserPlan, UserRole, UserStatus } from "@/types/user";
import { syncSubscriptionStatus } from "@/lib/billing/mercadopago";

function asPlan(value: unknown): UserPlan {
  return value === "premium" || value === "pro" ? value : "free";
}

function asStatus(value: unknown): UserStatus {
  return value === "inactive" || value === "deleted" || value === "blocked" ? value : "active";
}

function asPaymentStatus(value: unknown): UserPaymentStatus {
  if (value === "free" || value === "paid" || value === "not_paid" || value === "overdue" || value === "canceled") return value;
  return "pending";
}

function shouldSyncBillingOnRead(billing: BillingInfo) {
  if (billing.provider !== "mercadopago") return false;
  const lastSyncAt = typeof billing.lastSyncAt === "string" ? new Date(billing.lastSyncAt).getTime() : 0;
  if (!lastSyncAt) return true;
  return Date.now() - lastSyncAt > 15 * 60 * 1000;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  let uid: string | null = null;
  try {
    const rate = await checkRateLimit(request, { key: "api:profile-me:get", max: 120, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const acting = await resolveActingContext(request);
    uid = acting.actingUid;
    const [initialRows, accessControl] = await Promise.all([
      supabaseSelect("profiles", {
        filters: { uid },
        limit: 1,
      }),
      getServerAccessControlConfig(),
    ]);
    let rows = initialRows;
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, profile: null }, { status: 200 });
    }
    const currentBilling = (rows[0].billing ?? ((rows[0].raw as Record<string, unknown> | null) ?? {}).billing ?? {}) as BillingInfo;
    if (shouldSyncBillingOnRead(currentBilling)) {
      try {
        await syncSubscriptionStatus(uid);
        rows = await supabaseSelect("profiles", {
          filters: { uid },
          limit: 1,
        });
      } catch (error) {
        apiLogger.warn({
          message: "profile_me_billing_sync_failed",
          requestId: meta.requestId,
          route: meta.route,
          method: meta.method,
          meta: { uid, error: error instanceof Error ? error.message : String(error) },
        });
      }
    }
    const row = rows[0];
    const raw = readSecureProfilePayload(row.raw);
    const role = String(row.role ?? raw.role ?? "client") as UserRole;
    const effective = resolveEffectiveBillingState({
      role,
      plan: asPlan(row.plan ?? raw.plan),
      status: asStatus(row.status ?? raw.status),
      paymentStatus: asPaymentStatus(row.payment_status ?? raw.paymentStatus),
      blockReason: String(row.block_reason ?? raw.blockReason ?? ""),
      billing: (row.billing ?? raw.billing ?? {}) as BillingInfo,
      billingExempt: hasBillingExemption(accessControl, { uid, role }),
    });
    const profileRow = effective.shouldEnforce
      ? {
        ...row,
        plan: effective.plan,
        status: effective.status,
        payment_status: effective.paymentStatus,
        block_reason: effective.blockReason || "",
        billing: effective.billing || {},
      }
      : row;
    const profileRaw = effective.shouldEnforce
      ? {
        ...raw,
        plan: effective.plan,
        status: effective.status,
        paymentStatus: effective.paymentStatus,
        blockReason: effective.blockReason || "",
        billing: effective.billing || {},
      }
      : raw;

    if (effective.shouldEnforce) {
      await supabaseUpsertRows(
        "profiles",
        [
          {
            uid,
            plan: effective.plan,
            status: effective.status,
            payment_status: effective.paymentStatus,
            block_reason: effective.blockReason || "",
            billing: effective.billing || {},
            raw: writeSecureProfilePayload(profileRaw),
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "uid" }
      );
    }
    const authProviders = Array.isArray(profileRaw.authProviders)
      ? profileRaw.authProviders.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json(
      {
        ok: true,
        profile: {
          uid,
          email: profileRow.email ?? profileRaw.email ?? "",
          displayName: profileRow.display_name ?? profileRaw.displayName ?? profileRaw.completeName ?? "Usuário",
          completeName: profileRow.complete_name ?? profileRaw.completeName ?? "",
          phone: normalizePhone(String(profileRow.phone ?? profileRaw.phone ?? "")),
          photoURL: profileRow.photo_url ?? profileRaw.photoURL ?? "",
          role: profileRow.role ?? profileRaw.role ?? "client",
          plan: profileRow.plan ?? profileRaw.plan ?? "free",
          status: profileRow.status ?? profileRaw.status ?? "active",
          blockReason: profileRow.block_reason ?? profileRaw.blockReason ?? "",
          paymentStatus: profileRow.payment_status ?? profileRaw.paymentStatus ?? "pending",
          transactionCount: profileRow.transaction_count ?? profileRaw.transactionCount ?? 0,
          billing: profileRow.billing ?? profileRaw.billing ?? {},
          verifiedEmail: profileRow.verified_email ?? profileRaw.verifiedEmail ?? false,
          authProviders,
          needsPasswordSetup: profileRaw.needsPasswordSetup ?? false,
          deletedAt: profileRow.deleted_at ?? profileRaw.deletedAt ?? undefined,
          permanentDeleteAt: resolvePermanentDeleteAt(
            typeof profileRow.deleted_at === "string" ? profileRow.deleted_at : typeof profileRaw.deletedAt === "string" ? profileRaw.deletedAt : null,
            profileRaw
          ) ?? undefined,
          createdAt: profileRow.created_at ?? profileRaw.createdAt ?? new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    const logPayload = {
      message: "profile_me_get_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { uid, error: message },
    };
    if (status === 401) {
      apiLogger.warn(logPayload);
    } else {
      apiLogger.error(logPayload);
    }
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  let uid: string | null = null;
  try {
    const rate = await checkRateLimit(request, { key: "api:profile-me:put", max: 40, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const acting = await resolveActingContext(request);
    uid = acting.actingUid;
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "profile:update",
      actionLabel: "Editar perfil do usuário",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const body = (await request.json()) as {
      displayName?: string;
      completeName?: string;
      phone?: string;
    };
    const normalizedPhone = await assertPhoneAvailable(body.phone ?? "", uid);
    const existing = await supabaseSelect("profiles", { filters: { uid }, limit: 1 });
    const raw = readSecureProfilePayload(existing[0]?.raw);
    raw.displayName = body.displayName ?? "";
    raw.completeName = body.completeName ?? "";
    raw.phone = normalizedPhone;

    await supabaseUpsertRows(
      "profiles",
      [
        {
          uid,
          display_name: body.displayName ?? "",
          complete_name: body.completeName ?? "",
          phone: normalizedPhone,
          raw: writeSecureProfilePayload(raw),
        },
      ],
      { onConflict: "uid" }
    );
    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "phone_already_in_use" ? 409 : resolveApiErrorStatus(message);
    apiLogger.error({
      message: "profile_me_put_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { uid, error: message },
    });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}


