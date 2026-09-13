import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { writeAdminAuditLog } from "@/lib/audit/admin";
import { pushNotifications } from "@/lib/notifications/server";
import { createSupportReport } from "@/lib/support/create-report.server";
import { getSupportAuthContext } from "@/lib/support/auth.server";
import { supabaseSelect } from "@/services/supabase/admin";
import { getSupabaseServiceClient, resolveSupabaseAuthUserId } from "@/services/supabase/service-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    const auth = await getSupportAuthContext(request, { skipFeatureGate: true });
    if (auth.isImpersonating) {
      return NextResponse.json({ ok: false, error: "impersonation_not_allowed" }, { status: 403 });
    }

    const rate = await checkRateLimit(request, {
      key: "api:auth:mfa-recovery",
      max: 3,
      windowMs: 24 * 60 * 60 * 1_000,
      identity: { userId: auth.uid, tenantId: auth.uid },
      critical: true,
    });
    if (!rate.allowed) return rateLimitResponse(rate);

    const authUserId = await resolveSupabaseAuthUserId({ uid: auth.uid, email: auth.email });
    if (!authUserId) {
      return NextResponse.json({ ok: false, error: "auth_user_not_found" }, { status: 404 });
    }
    const supabase = getSupabaseServiceClient();
    const factorResult = await supabase.auth.admin.mfa.listFactors({ userId: authUserId });
    if (factorResult.error) throw new Error("mfa_factor_lookup_failed");
    if ((factorResult.data?.factors || []).length === 0) {
      return NextResponse.json({ ok: false, error: "no_mfa_factors" }, { status: 409 });
    }

    const payload = (await request.json().catch(() => ({}))) as { clientRequestId?: unknown };
    const clientRequestId = typeof payload.clientRequestId === "string" && /^[0-9a-f-]{36}$/i.test(payload.clientRequestId)
      ? payload.clientRequestId
      : crypto.randomUUID();
    const reportRequest = new NextRequest(request.url, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": clientRequestId },
      body: JSON.stringify({
        type: "support",
        title: "Recuperação da autenticação em duas etapas",
        description: "O titular da conta informou que perdeu acesso a todos os autenticadores cadastrados.",
        includeTechnicalContext: false,
        clientRequestId,
      }),
    });
    const result = await createSupportReport(reportRequest, auth);

    const { data: ticket } = await supabase
      .from("support_requests")
      .select("raw")
      .eq("id", result.id)
      .single();
    const raw = (ticket?.raw as Record<string, unknown> | null) || {};
    const { error: updateError } = await supabase
      .from("support_requests")
      .update({ raw: { ...raw, supportKind: "mfa_recovery", priority: "high" } })
      .eq("id", result.id);
    if (updateError) throw new Error("mfa_recovery_ticket_update_failed");

    if (!result.duplicated) {
      const [admins, moderators, supports] = await Promise.all([
        supabaseSelect("profiles", { select: "uid", filters: { role: "admin" }, limit: 200 }),
        supabaseSelect("profiles", { select: "uid", filters: { role: "moderator" }, limit: 200 }),
        supabaseSelect("profiles", { select: "uid", filters: { role: "support" }, limit: 200 }),
      ]);
      const staffUids = Array.from(new Set(
        [...admins, ...moderators, ...supports].map((row) => String(row.uid || "").trim()).filter(Boolean),
      ));
      await pushNotifications(staffUids.map((uid) => ({
        uid,
        kind: "support" as const,
        title: "Recuperação de MFA solicitada",
        message: `${auth.name} informou que perdeu acesso aos autenticadores.`,
        href: "/admin?tab=support",
        meta: { ticketId: result.id, fromUid: auth.uid, supportKind: "mfa_recovery" },
        dedupeKey: `mfa-recovery:${result.id}`,
      })));
      await writeAdminAuditLog({
        actorUid: auth.uid,
        action: "auth.mfa_recovery.requested",
        targetUid: auth.uid,
        requestId: meta.requestId,
        route: meta.route,
        method: meta.method,
        ip: meta.ip,
        userAgent: meta.userAgent,
        details: { ticketId: result.id },
      });
    }

    return NextResponse.json({ ok: true, protocol: result.protocol, duplicated: result.duplicated }, { status: result.duplicated ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" || message === "invalid_auth_token"
      ? 401
      : message === "mfa_required"
        ? 403
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
