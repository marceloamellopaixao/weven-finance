import { NextRequest, NextResponse } from "next/server";

import { canAccessAdminArea } from "@/lib/access-control/roles";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { verifyRequestAuth, type ServerAuthUser } from "@/lib/auth/server";
import { cancelSubscriptionForUser } from "@/lib/billing/mercadopago";
import { pushNotification } from "@/lib/notifications/server";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { formatPlanName } from "@/lib/plans/capabilities";
import { getUserPlanContext } from "@/lib/plans/server";
import { toWorkspaceInvitation, toWorkspaceMember } from "@/lib/workspaces/server";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
import type { PendingWorkspaceInvitation, WorkspaceInvitation, WorkspaceMember } from "@/types/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function updateRawStatus(row: Record<string, unknown>, status: string) {
  const now = new Date().toISOString();
  const raw = ((row.raw as Record<string, unknown> | null) || {}) as Record<string, unknown>;
  return {
    ...raw,
    status,
    acceptedAt: status === "accepted" ? now : raw.acceptedAt,
    rejectedAt: status === "revoked" ? now : raw.rejectedAt,
    updatedAt: now,
  };
}

async function getAccessiblePendingRows(auth: ServerAuthUser, invitationId?: string) {
  const email = normalizeEmail(auth.email);
  const rows = await supabaseSelect("workspace_invitations", {
    filters: {
      ...(invitationId ? { id: invitationId } : {}),
      invitation_status: "pending",
    },
    or: `invited_member_uid.eq.${auth.uid}${email ? `,email.eq.${email}` : ""}`,
    order: "created_at.desc",
    limit: invitationId ? 1 : 20,
  });
  const now = Date.now();
  return rows.filter((row) => {
    const expiresAt = typeof row.expires_at === "string" ? Date.parse(row.expires_at) : Number.NaN;
    return !Number.isFinite(expiresAt) || expiresAt > now;
  });
}

async function getInvitationAccountImpact(auth: ServerAuthUser) {
  const [planContext, profileRows] = await Promise.all([
    getUserPlanContext(auth.uid),
    supabaseSelect("profiles", {
      select: "email,plan,role,payment_status,billing,raw",
      filters: { uid: auth.uid },
      limit: 1,
    }),
  ]);
  const profile = profileRows[0] || {};
  const raw = ((profile.raw as Record<string, unknown> | null) || {}) as Record<string, unknown>;
  const billing = ((profile.billing as Record<string, unknown> | null) || (raw.billing as Record<string, unknown> | null) || {}) as Record<string, unknown>;
  const providerSubscriptionId = String(billing.providerSubscriptionId || billing.preapprovalId || "").trim();
  const paymentStatus = String(profile.payment_status || raw.paymentStatus || "").trim().toLowerCase();
  const subscriptionStatus = String(billing.subscriptionStatus || "").trim().toLowerCase();
  const isStaff = canAccessAdminArea({ uid: auth.uid, role: planContext.role });
  const hasActiveProviderSubscription = Boolean(providerSubscriptionId)
    && paymentStatus !== "canceled"
    && subscriptionStatus !== "canceled"
    && subscriptionStatus !== "expired";
  const hasContractedPlan = planContext.plan !== "free" && paymentStatus !== "free" && paymentStatus !== "canceled";

  return {
    currentPlan: planContext.plan,
    currentPlanName: formatPlanName(planContext.plan),
    isStaff,
    requiresSubscriptionCancellation: !isStaff && (hasContractedPlan || hasActiveProviderSubscription),
    userEmail: String(profile.email || raw.email || auth.email || "").trim(),
  };
}

async function decorateInvitation(
  row: Record<string, unknown>,
  impact: Awaited<ReturnType<typeof getInvitationAccountImpact>>,
): Promise<PendingWorkspaceInvitation> {
  const invitation = toWorkspaceInvitation(row);
  const [workspaceRows, inviterRows] = await Promise.all([
    supabaseSelect("workspaces", {
      select: "name",
      filters: { uid: invitation.workspaceUid, source_id: invitation.workspaceId },
      limit: 1,
    }),
    supabaseSelect("profiles", {
      select: "display_name,email",
      filters: { uid: invitation.invitedByUid },
      limit: 1,
    }),
  ]);
  return {
    ...invitation,
    workspaceName: String(workspaceRows[0]?.name || "Família"),
    inviterName: String(inviterRows[0]?.display_name || inviterRows[0]?.email || "Responsável da família"),
    currentPlan: impact.currentPlan,
    currentPlanName: impact.currentPlanName,
    requiresSubscriptionCancellation: impact.requiresSubscriptionCancellation,
    isStaff: impact.isStaff,
  };
}

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:workspaces-family-accept:get", max: 60, windowMs: 60_000 });
    if (!rate.allowed) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    const auth = await verifyRequestAuth(request);
    const [rows, impact] = await Promise.all([getAccessiblePendingRows(auth), getInvitationAccountImpact(auth)]);
    const invitations = await Promise.all(rows.map((row) => decorateInvitation(row, impact)));
    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
    return NextResponse.json({ ok: true, invitations }, { status: 200 });
  } catch (error) {
    return handleError(error, meta, startedAt, "workspaces_family_invites_get_failed");
  }
}

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:workspaces-family-accept:post", max: 20, windowMs: 60_000 });
    if (!rate.allowed) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    const auth = await verifyRequestAuth(request);
    const body = await request.json().catch(() => ({})) as { invitationId?: string; cancelCurrentSubscription?: boolean };
    const invitationId = String(body.invitationId || "").trim();

    const invitationRows = await getAccessiblePendingRows(auth, invitationId || undefined);
    if (invitationId && invitationRows.length === 0) {
      return NextResponse.json({ ok: false, error: "invitation_not_found" }, { status: 404 });
    }

    const validatedMembers: Array<{ row: Record<string, unknown>; memberRow: Record<string, unknown> }> = [];
    for (const row of invitationRows) {
      const invitation = toWorkspaceInvitation(row);
      const email = normalizeEmail(auth.email);
      const memberRows = await supabaseSelect("workspace_members", {
        filters: { workspace_uid: invitation.workspaceUid, workspace_id: invitation.workspaceId },
        or: `member_uid.eq.${auth.uid}${email ? `,email.eq.${email}` : ""}`,
        limit: 1,
      });
      const memberRow = memberRows[0];
      if (!memberRow || memberRow.member_status === "disabled") throw new Error("invitation_member_not_found");
      validatedMembers.push({ row, memberRow });
    }

    const impact = await getInvitationAccountImpact(auth);
    if (impact.requiresSubscriptionCancellation && body.cancelCurrentSubscription !== true) {
      return NextResponse.json({ ok: false, error: "subscription_cancellation_confirmation_required", currentPlan: impact.currentPlan }, { status: 409 });
    }
    if (impact.requiresSubscriptionCancellation) {
      if (!impact.userEmail) return NextResponse.json({ ok: false, error: "missing_user_email" }, { status: 409 });
      await cancelSubscriptionForUser({ uid: auth.uid, userEmail: impact.userEmail });
    }

    const now = new Date().toISOString();
    const acceptedInvitations: WorkspaceInvitation[] = [];
    const activatedMembers: WorkspaceMember[] = [];
    for (const { row, memberRow } of validatedMembers) {
      const updatedInvitationRow = {
        ...row,
        invited_member_uid: auth.uid,
        invitation_status: "accepted",
        raw: updateRawStatus(row, "accepted"),
        updated_at: now,
      };
      await supabaseUpsertRows("workspace_invitations", [updatedInvitationRow], { onConflict: "id" });
      acceptedInvitations.push(toWorkspaceInvitation(updatedInvitationRow));

      const updatedMemberRow = {
        ...memberRow,
        member_uid: auth.uid,
        member_status: "active",
        raw: {
          ...(((memberRow.raw as Record<string, unknown> | null) || {}) as Record<string, unknown>),
          memberUid: auth.uid,
          status: "active",
          acceptedAt: now,
          updatedAt: now,
        },
        updated_at: now,
      };
      await supabaseUpsertRows("workspace_members", [updatedMemberRow], { onConflict: "id" });
      activatedMembers.push(toWorkspaceMember(updatedMemberRow));
    }

    if (impact.requiresSubscriptionCancellation) {
      await pushNotification({
        uid: auth.uid,
        kind: "billing",
        title: "Plano individual cancelado",
        message: "Seu convite foi aceito e agora seu acesso financeiro pertence ao perfil Família compartilhado.",
        href: "/dashboard",
        meta: { invitationId, previousPlan: impact.currentPlan },
      });
    }

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
    return NextResponse.json({
      ok: true,
      invitations: acceptedInvitations,
      members: activatedMembers,
      subscriptionCanceled: impact.requiresSubscriptionCancellation,
    }, { status: 200 });
  } catch (error) {
    return handleError(error, meta, startedAt, "workspaces_family_accept_failed");
  }
}

export async function DELETE(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:workspaces-family-accept:delete", max: 20, windowMs: 60_000 });
    if (!rate.allowed) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    const auth = await verifyRequestAuth(request);
    const invitationId = request.nextUrl.searchParams.get("invitationId")?.trim() || "";
    if (!invitationId) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    const rows = await getAccessiblePendingRows(auth, invitationId);
    const row = rows[0];
    if (!row) return NextResponse.json({ ok: false, error: "invitation_not_found" }, { status: 404 });

    const invitation = toWorkspaceInvitation(row);
    const now = new Date().toISOString();
    await supabaseUpsertRows("workspace_invitations", [{
      ...row,
      invitation_status: "revoked",
      raw: updateRawStatus(row, "revoked"),
      updated_at: now,
    }], { onConflict: "id" });

    const memberRows = await supabaseSelect("workspace_members", {
      filters: { workspace_uid: invitation.workspaceUid, workspace_id: invitation.workspaceId },
      or: `member_uid.eq.${auth.uid},email.eq.${normalizeEmail(auth.email)}`,
      limit: 1,
    });
    if (memberRows[0]) {
      const memberRow = memberRows[0];
      await supabaseUpsertRows("workspace_members", [{
        ...memberRow,
        member_status: "disabled",
        raw: { ...(((memberRow.raw as Record<string, unknown> | null) || {}) as Record<string, unknown>), status: "disabled", rejectedAt: now, updatedAt: now },
        updated_at: now,
      }], { onConflict: "id" });
    }

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return handleError(error, meta, startedAt, "workspaces_family_reject_failed");
  }
}

function handleError(error: unknown, meta: ReturnType<typeof getRequestMeta>, startedAt: number, message: string) {
  const errorMessage = error instanceof Error ? error.message : "unknown_error";
  const status = errorMessage === "missing_auth_token" || errorMessage === "invalid_auth_token"
    ? 401
    : errorMessage === "subscription_not_found" || errorMessage === "role_billing_exempt"
      ? 409
      : 500;
  apiLogger.error({ message, requestId: meta.requestId, route: meta.route, method: meta.method, meta: { error: errorMessage } });
  void writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: errorMessage });
  return NextResponse.json({ ok: false, error: errorMessage }, { status });
}
