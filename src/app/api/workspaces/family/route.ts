import { NextRequest, NextResponse } from "next/server";

import { resolveApiErrorStatus } from "@/lib/api/error";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { verifyRequestAuth } from "@/lib/auth/server";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { pushNotification } from "@/lib/notifications/server";
import { getPlanCapabilities } from "@/lib/plans/capabilities";
import { getUserPlanContext } from "@/lib/plans/server";
import {
  DEFAULT_FAMILY_ROLE_PERMISSIONS,
  canEditFamilyMembers,
  canEditFamilyPermissions,
  canInviteFamilyMembers,
  canViewFamilyMembers,
  normalizeFamilyPermissions,
  normalizeFamilyRole,
} from "@/lib/workspaces/family";
import {
  getOwnedWorkspace,
  getWorkspaceMember,
  toWorkspaceInvitation,
  toWorkspaceMember,
} from "@/lib/workspaces/server";
import { supabasePatchByFilters, supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
import { getSupabaseServiceClient, resolveSupabaseAuthUserId } from "@/services/supabase/service-client";
import { resolveUserUidFromMetadata } from "@/lib/auth/user-uid";
import { readSecureProfilePayload, writeSecureProfilePayload } from "@/lib/secure-store/profile";
import { buildWorkspaceSeatSummary, countOccupiedWorkspaceSeats } from "@/lib/workspaces/seats";
import type { FamilyRole, WorkspaceInvitation, WorkspaceMember, WorkspaceSeatSummary } from "@/types/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function safePushFamilyNotification(input: Parameters<typeof pushNotification>[0]) {
  try {
    await pushNotification(input);
  } catch (error) {
    apiLogger.warn({
      message: "family_invitation_notification_failed",
      uid: input.uid,
      meta: { error: error instanceof Error ? error.message : "unknown_error" },
    });
  }
}

function toMemberRow(input: {
  workspaceUid: string;
  workspaceId: string;
  memberUid: string;
  email: string;
  displayName: string;
  role: FamilyRole;
  permissions: string[];
  status?: "active" | "pending" | "disabled";
  invitedByUid?: string;
}) {
  const now = new Date().toISOString();
  const id = `${input.workspaceUid}__${input.workspaceId}__${input.memberUid}`;
  const raw = {
    id,
    workspaceUid: input.workspaceUid,
    workspaceId: input.workspaceId,
    memberUid: input.memberUid,
    email: input.email,
    displayName: input.displayName,
    role: input.role,
    permissions: input.permissions,
    status: input.status || "active",
    invitedByUid: input.invitedByUid,
    createdAt: now,
    updatedAt: now,
  };
  return {
    id,
    workspace_uid: input.workspaceUid,
    workspace_id: input.workspaceId,
    member_uid: input.memberUid,
    email: input.email,
    display_name: input.displayName,
    member_role: input.role,
    permissions: input.permissions,
    member_status: input.status || "active",
    invited_by_uid: input.invitedByUid || null,
    raw,
    created_at: now,
    updated_at: now,
  };
}

function toInvitationRow(input: {
  id?: string;
  workspaceUid: string;
  workspaceId: string;
  email: string;
  role: FamilyRole;
  permissions: string[];
  invitedByUid: string;
  invitedMemberUid?: string | null;
  recipientAccountExisted?: boolean;
  status?: "pending" | "accepted" | "revoked" | "expired";
}) {
  const now = new Date().toISOString();
  const id = input.id || crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const raw = {
    id,
    workspaceUid: input.workspaceUid,
    workspaceId: input.workspaceId,
    email: input.email,
    role: input.role,
    permissions: input.permissions,
    status: input.status || "pending",
    invitedByUid: input.invitedByUid,
    invitedMemberUid: input.invitedMemberUid || null,
    recipientAccountExisted: Boolean(input.recipientAccountExisted),
    expiresAt,
    createdAt: now,
    updatedAt: now,
  };
  return {
    id,
    workspace_uid: input.workspaceUid,
    workspace_id: input.workspaceId,
    email: input.email,
    member_role: input.role,
    permissions: input.permissions,
    invitation_status: input.status || "pending",
    invited_by_uid: input.invitedByUid,
    invited_member_uid: input.invitedMemberUid || null,
    expires_at: expiresAt,
    raw,
    created_at: now,
    updated_at: now,
  };
}

type FamilyManageAction = "manage_members" | "invite_members" | "edit_permissions";

function canPerformFamilyManageAction(member: WorkspaceMember | null, action: FamilyManageAction) {
  if (action === "invite_members") return canInviteFamilyMembers(member);
  if (action === "edit_permissions") return canEditFamilyPermissions(member);
  return canEditFamilyMembers(member);
}

async function assertCanManage(uid: string, workspaceId: string, action: FamilyManageAction = "manage_members") {
  const owned = await getOwnedWorkspace(uid, workspaceId);
  if (owned) {
    if (owned.workspace_type !== "family") throw new Error("workspace_not_family");
    return { workspaceUid: uid, workspaceId, owner: true as const, manager: null };
  }

  const rows = await supabaseSelect("workspace_members", {
    filters: { member_uid: uid, workspace_id: workspaceId, member_status: "active" },
    limit: 1,
  });
  const manager = rows[0] ? toWorkspaceMember(rows[0]) : null;
  if (!manager || !canPerformFamilyManageAction(manager, action)) throw new Error("forbidden");
  const familyWorkspace = await getOwnedWorkspace(manager.workspaceUid, workspaceId);
  if (familyWorkspace?.workspace_type !== "family") throw new Error("workspace_not_family");
  return { workspaceUid: manager.workspaceUid, workspaceId, owner: false as const, manager };
}

async function assertCanView(uid: string, workspaceId: string) {
  const owned = await getOwnedWorkspace(uid, workspaceId);
  if (owned) {
    if (owned.workspace_type !== "family") throw new Error("workspace_not_family");
    return { workspaceUid: uid, workspaceId, owner: true as const, manager: null };
  }

  const rows = await supabaseSelect("workspace_members", {
    filters: { member_uid: uid, workspace_id: workspaceId, member_status: "active" },
    limit: 1,
  });
  const manager = rows[0] ? toWorkspaceMember(rows[0]) : null;
  if (!manager || !canViewFamilyMembers(manager)) throw new Error("forbidden");
  const familyWorkspace = await getOwnedWorkspace(manager.workspaceUid, workspaceId);
  if (familyWorkspace?.workspace_type !== "family") throw new Error("workspace_not_family");
  return { workspaceUid: manager.workspaceUid, workspaceId, owner: false as const, manager };
}

async function ensureProfileForMember(input: {
  uid: string;
  email: string;
  displayName: string;
  needsPasswordSetup: boolean;
}) {
  const existing = await supabaseSelect("profiles", { filters: { uid: input.uid }, limit: 1 });
  const now = new Date().toISOString();
  if (existing.length > 0) {
    const row = existing[0];
    const raw = readSecureProfilePayload(row.raw);
    const nextRaw = writeSecureProfilePayload({
      ...raw,
      email: row.email || raw.email || input.email,
      displayName: row.display_name || raw.displayName || input.displayName,
      authProviders: Array.from(new Set([...(Array.isArray(raw.authProviders) ? raw.authProviders : []), "email"])),
      needsPasswordSetup: input.needsPasswordSetup || Boolean(raw.needsPasswordSetup),
      updatedAt: now,
    });
    await supabaseUpsertRows(
      "profiles",
      [
        {
          uid: input.uid,
          raw: nextRaw,
          updated_at: now,
        },
      ],
      { onConflict: "uid" },
    );
    return;
  }
  await supabaseUpsertRows(
    "profiles",
    [
      {
        uid: input.uid,
        email: input.email,
        display_name: input.displayName,
        complete_name: input.displayName,
        phone: "",
        role: "client",
        plan: "free",
        status: "active",
        payment_status: "pending",
        billing: { source: "family_invite", lastSyncAt: now },
        transaction_count: 0,
        verified_email: false,
        created_at: now,
        raw: writeSecureProfilePayload({
          uid: input.uid,
          email: input.email,
          displayName: input.displayName,
          completeName: input.displayName,
          phone: "",
          role: "client",
          plan: "free",
          status: "active",
          paymentStatus: "pending",
          billing: { source: "family_invite", lastSyncAt: now },
          transactionCount: 0,
          verifiedEmail: false,
          authProviders: ["email"],
          needsPasswordSetup: input.needsPasswordSetup,
          createdAt: now,
        }),
      },
    ],
    { onConflict: "uid" },
  );
}

async function resolveOrCreateAuthUser(input: {
  email: string;
  displayName: string;
  redirectTo: string;
}) {
  const profileRows = await supabaseSelect("profiles", {
    conditions: { email: `ilike.${input.email}` },
    limit: 1,
  });
  const existingProfile = profileRows[0];
  if (existingProfile?.uid) {
    return {
      uid: String(existingProfile.uid),
      created: false,
      needsPasswordSetup: false,
      emailSent: false,
      accountExists: true,
      profileExists: true,
      displayName: String(existingProfile.display_name || input.displayName),
    };
  }

  const existingUserId = await resolveSupabaseAuthUserId({ email: input.email });
  const client = getSupabaseServiceClient();
  if (existingUserId) {
    const authResult = await client.auth.admin.getUserById(existingUserId);
    if (authResult.error || !authResult.data.user) {
      throw new Error(`supabase_auth_user_lookup_failed:${authResult.error?.message || "not_found"}`);
    }
    const uid = resolveUserUidFromMetadata(authResult.data.user.user_metadata, existingUserId);
    return {
      uid,
      created: false,
      needsPasswordSetup: false,
      emailSent: false,
      accountExists: true,
      profileExists: false,
      displayName: String(authResult.data.user.user_metadata?.displayName || input.displayName),
    };
  }

  const invite = await client.auth.admin.inviteUserByEmail(input.email, {
    data: { displayName: input.displayName },
    redirectTo: input.redirectTo,
  });
  if (invite.error) throw new Error(`supabase_invite_failed:${invite.error.message}`);
  return {
    uid: invite.data.user?.id || "",
    created: true,
    needsPasswordSetup: true,
    emailSent: true,
    accountExists: false,
    profileExists: false,
    displayName: input.displayName,
  };
}

async function sendPasswordSetupEmail(client: ReturnType<typeof getSupabaseServiceClient>, email: string, redirectTo: string) {
  const result = await client.auth.resetPasswordForEmail(email, { redirectTo });
  if (result.error) throw new Error(`supabase_password_email_failed:${result.error.message}`);
}

async function getFamilySeatSummary(
  workspaceUid: string,
  workspaceId: string,
  memberRows?: Array<Record<string, unknown>>,
): Promise<WorkspaceSeatSummary> {
  const planContext = await getUserPlanContext(workspaceUid);
  const capabilities = getPlanCapabilities(planContext.plan, planContext.plans, planContext.featureAccess);
  const rows = memberRows ?? await supabaseSelect("workspace_members", {
    filters: { workspace_uid: workspaceUid, workspace_id: workspaceId },
    conditions: { member_status: "in.(active,pending)" },
    limit: 100,
  });
  const profileRows = await supabaseSelect("profiles", {
    select: "billing,raw",
    filters: { uid: workspaceUid },
    limit: 1,
  });
  const profileRaw = (profileRows[0]?.raw as Record<string, unknown> | null) || {};
  const billing = ((profileRows[0]?.billing as Record<string, unknown> | null) ||
    (profileRaw.billing as Record<string, unknown> | null) || {}) as Record<string, unknown>;
  const configuredPlan = planContext.plans.family;
  return buildWorkspaceSeatSummary({
    plan: configuredPlan,
    occupied: countOccupiedWorkspaceSeats(workspaceUid, rows),
    additionalSeats: billing.additionalSeats,
    fallbackIncluded: capabilities.maxFamilyMembers ?? 4,
  });
}

async function expirePendingFamilyInvitations(workspaceUid: string, workspaceId: string) {
  const expiredRows = await supabaseSelect("workspace_invitations", {
    filters: { workspace_uid: workspaceUid, workspace_id: workspaceId, invitation_status: "pending" },
    conditions: { expires_at: `lt.${new Date().toISOString()}` },
    limit: 100,
  });
  const now = new Date().toISOString();
  for (const row of expiredRows) {
    const raw = ((row.raw as Record<string, unknown> | null) || {}) as Record<string, unknown>;
    await supabaseUpsertRows("workspace_invitations", [{
      ...row,
      invitation_status: "expired",
      raw: { ...raw, status: "expired", expiredAt: now, updatedAt: now },
      updated_at: now,
    }], { onConflict: "id" });
    if (row.invited_member_uid) {
      await supabasePatchByFilters("workspace_members", {
        workspace_uid: workspaceUid,
        workspace_id: workspaceId,
        member_uid: String(row.invited_member_uid),
        member_status: "pending",
      }, {
        member_status: "disabled",
        updated_at: now,
      });
    }
  }
}

async function assertFamilyInviteAllowed(workspaceUid: string, workspaceId: string, email: string) {
  await expirePendingFamilyInvitations(workspaceUid, workspaceId);
  const planContext = await getUserPlanContext(workspaceUid);
  const capabilities = getPlanCapabilities(planContext.plan, planContext.plans, planContext.featureAccess);
  if (!planContext.isBillingExempt && !capabilities.hasFamilyWorkspace) {
    throw new Error("Para convidar familiares, use o plano Família.");
  }

  const memberRows = await supabaseSelect("workspace_members", {
    filters: { workspace_uid: workspaceUid, workspace_id: workspaceId },
    conditions: { member_status: "in.(active,pending)" },
    limit: 100,
  });
  const normalizedEmail = normalizeEmail(email);
  const alreadyAdded = memberRows.some((row) => normalizeEmail(row.email) === normalizedEmail);
  if (alreadyAdded) throw new Error("family_member_already_invited");
  const seats = await getFamilySeatSummary(workspaceUid, workspaceId, memberRows);
  if (!planContext.isBillingExempt && seats.available <= 0) {
    throw new Error(`Limite de ${seats.capacity} pessoas atingido. Contrate um usuário adicional antes de convidar outro familiar.`);
  }
  return seats;
}

function getFamilyErrorStatus(message: string) {
  if (message.startsWith("Para convidar") || message.startsWith("Limite de")) return 403;
  if (message === "family_member_already_invited") return 409;
  if (message === "family_seat_capacity_changed") return 409;
  if (message === "cannot_invite_yourself") return 400;
  if (message === "forbidden") return 403;
  return resolveApiErrorStatus(message);
}

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:workspaces-family:get", max: 120, windowMs: 60_000 });
    if (!rate.allowed) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    const auth = await verifyRequestAuth(request);
    const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
    if (!workspaceId) return NextResponse.json({ ok: false, error: "missing_workspace_id" }, { status: 400 });
    const access = await assertCanView(auth.uid, workspaceId);
    await expirePendingFamilyInvitations(access.workspaceUid, access.workspaceId);
    const [memberRows, invitationRows] = await Promise.all([
      supabaseSelect("workspace_members", {
        filters: { workspace_uid: access.workspaceUid, workspace_id: access.workspaceId },
        conditions: { member_status: "in.(active,pending)" },
        order: "created_at.asc",
      }),
      supabaseSelect("workspace_invitations", {
        filters: { workspace_uid: access.workspaceUid, workspace_id: access.workspaceId },
        order: "created_at.desc",
        limit: 50,
      }),
    ]);
    const seats = await getFamilySeatSummary(access.workspaceUid, access.workspaceId, memberRows);
    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
    return NextResponse.json({
      ok: true,
      members: memberRows.map(toWorkspaceMember),
      invitations: invitationRows.map(toWorkspaceInvitation),
      seats,
    }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = getFamilyErrorStatus(message);
    apiLogger.error({ message: "workspaces_family_get_failed", requestId: meta.requestId, route: meta.route, method: meta.method, meta: { error: message } });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:workspaces-family:post", max: 30, windowMs: 60_000 });
    if (!rate.allowed) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    const auth = await verifyRequestAuth(request);
    const body = (await request.json()) as {
      workspaceId?: string;
      email?: string;
      displayName?: string;
      role?: unknown;
      permissions?: unknown;
    };
    const workspaceId = String(body.workspaceId || "").trim();
    const email = normalizeEmail(body.email);
    if (!workspaceId || !email) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    if (email === normalizeEmail(auth.email)) throw new Error("cannot_invite_yourself");
    const access = await assertCanManage(auth.uid, workspaceId, "invite_members");
    await assertFamilyInviteAllowed(access.workspaceUid, workspaceId, email);
    const role = normalizeFamilyRole(body.role);
    const permissions = normalizeFamilyPermissions(body.permissions || DEFAULT_FAMILY_ROLE_PERMISSIONS[role], role);
    const displayName = String(body.displayName || email.split("@")[0] || "Familiar").trim();

    const authUser = await resolveOrCreateAuthUser({
      email,
      displayName,
      redirectTo: new URL("/first-access?intent=first-access&familyInvite=1", request.nextUrl.origin).toString(),
    });
    if (!authUser.uid) throw new Error("supabase_user_create_failed:missing_user_id");

    if (!authUser.profileExists) {
      await ensureProfileForMember({ uid: authUser.uid, email, displayName, needsPasswordSetup: authUser.needsPasswordSetup });
    }
    const memberDisplayName = authUser.displayName || displayName;
    const memberRow = toMemberRow({
      workspaceUid: access.workspaceUid,
      workspaceId,
      memberUid: authUser.uid,
      email,
      displayName: memberDisplayName,
      role,
      permissions,
      invitedByUid: auth.uid,
      status: "pending",
    });
    const invitationRow = toInvitationRow({
      workspaceUid: access.workspaceUid,
      workspaceId,
      email,
      role,
      permissions,
      invitedByUid: auth.uid,
      invitedMemberUid: authUser.uid,
      recipientAccountExisted: authUser.accountExists,
      status: "pending",
    });

    await supabaseUpsertRows("workspace_members", [memberRow], { onConflict: "id" });
    await supabaseUpsertRows("workspace_invitations", [invitationRow], { onConflict: "id" });
    const seats = await getFamilySeatSummary(access.workspaceUid, workspaceId);
    const ownerPlanContext = await getUserPlanContext(access.workspaceUid);
    if (!ownerPlanContext.isBillingExempt && seats.occupied > seats.capacity) {
      const now = new Date().toISOString();
      await supabaseUpsertRows("workspace_members", [{
        ...memberRow,
        member_status: "disabled",
        raw: { ...((memberRow.raw as Record<string, unknown>) || {}), status: "disabled", updatedAt: now },
        updated_at: now,
      }], { onConflict: "id" });
      await supabaseUpsertRows("workspace_invitations", [{
        ...invitationRow,
        invitation_status: "revoked",
        raw: { ...((invitationRow.raw as Record<string, unknown>) || {}), status: "revoked", updatedAt: now },
        updated_at: now,
      }], { onConflict: "id" });
      throw new Error("family_seat_capacity_changed");
    }
    const member = toWorkspaceMember(memberRow);
    const invitation = toWorkspaceInvitation(invitationRow);
    if (authUser.accountExists) {
      await safePushFamilyNotification({
        uid: authUser.uid,
        kind: "workspace",
        title: "Convite para uma família",
        message: `${auth.name || "Um responsável"} convidou você para compartilhar um perfil financeiro familiar.`,
        href: "/dashboard?workspaceInvite=1",
        meta: { invitationId: invitation.id, workspaceId, workspaceUid: access.workspaceUid },
      });
    }
    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
    return NextResponse.json({
      ok: true,
      member,
      invitation,
      generatedPasswordExposed: false,
      emailSent: Boolean(authUser.emailSent),
      recipientType: authUser.accountExists ? "existing_account" : "new_account",
      seats,
    }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = getFamilyErrorStatus(message);
    apiLogger.error({ message: "workspaces_family_post_failed", requestId: meta.requestId, route: meta.route, method: meta.method, meta: { error: message } });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:workspaces-family:put", max: 30, windowMs: 60_000 });
    if (!rate.allowed) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    const auth = await verifyRequestAuth(request);
    const body = (await request.json()) as {
      workspaceId?: string;
      invitationId?: string;
      memberUid?: string;
    };
    const workspaceId = String(body.workspaceId || "").trim();
    const invitationId = String(body.invitationId || "").trim();
    const memberUid = String(body.memberUid || "").trim();
    if (!workspaceId || (!invitationId && !memberUid)) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    const access = await assertCanManage(auth.uid, workspaceId, "invite_members");
    if (memberUid) {
      if (memberUid === access.workspaceUid) {
        return NextResponse.json({ ok: false, error: "cannot_resend_owner_access" }, { status: 400 });
      }
      const member = await getWorkspaceMember(access.workspaceUid, workspaceId, memberUid);
      if (!member || member.status === "disabled") return NextResponse.json({ ok: false, error: "member_not_found" }, { status: 404 });
      const memberInvitationRows = await supabaseSelect("workspace_invitations", {
        filters: { workspace_uid: access.workspaceUid, workspace_id: access.workspaceId, invited_member_uid: member.memberUid },
        conditions: { invitation_status: "eq.pending" },
        order: "created_at.desc",
        limit: 1,
      });
      const memberInvitationRaw = ((memberInvitationRows[0]?.raw as Record<string, unknown> | null) || {}) as Record<string, unknown>;
      const recipientAccountExisted = memberInvitationRaw.recipientAccountExisted === true;
      if (recipientAccountExisted) {
        await safePushFamilyNotification({
          uid: member.memberUid,
          kind: "workspace",
          title: "Convite pendente para uma família",
          message: "Você tem um convite aguardando sua confirmação.",
          href: "/dashboard?workspaceInvite=1",
          meta: { invitationId: memberInvitationRows[0]?.id, workspaceId },
        });
      } else {
        await sendPasswordSetupEmail(
          getSupabaseServiceClient(),
          member.email,
          new URL("/first-access?intent=first-access&familyInvite=1", request.nextUrl.origin).toString(),
        );
      }
      await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
      return NextResponse.json<{ ok: true; member: WorkspaceMember; emailSent: boolean }>({
        ok: true,
        member,
        emailSent: !recipientAccountExisted,
      }, { status: 200 });
    }

    const rows = await supabaseSelect("workspace_invitations", {
      filters: {
        id: invitationId,
        workspace_uid: access.workspaceUid,
        workspace_id: access.workspaceId,
      },
      limit: 1,
    });
    const existing = rows[0];
    if (!existing) return NextResponse.json({ ok: false, error: "invitation_not_found" }, { status: 404 });
    const invitation = toWorkspaceInvitation(existing);
    if (invitation.status !== "pending") {
      return NextResponse.json({ ok: false, error: "invitation_not_pending" }, { status: 400 });
    }
    const invitationRaw = ((existing.raw as Record<string, unknown> | null) || {}) as Record<string, unknown>;
    const recipientAccountExisted = invitationRaw.recipientAccountExisted === true;
    if (recipientAccountExisted && existing.invited_member_uid) {
      await safePushFamilyNotification({
        uid: String(existing.invited_member_uid),
        kind: "workspace",
        title: "Convite pendente para uma família",
        message: "Você tem um convite aguardando sua confirmação.",
        href: "/dashboard?workspaceInvite=1",
        meta: { invitationId, workspaceId },
      });
    } else {
      await sendPasswordSetupEmail(
        getSupabaseServiceClient(),
        invitation.email,
        new URL("/first-access?intent=first-access&familyInvite=1", request.nextUrl.origin).toString(),
      );
    }

    const now = new Date().toISOString();
    const raw = invitationRaw;
    const updatedRow = {
      ...existing,
      raw: {
        ...raw,
        resentAt: now,
        lastEmailSentAt: now,
        updatedAt: now,
      },
      updated_at: now,
    };
    await supabaseUpsertRows("workspace_invitations", [updatedRow], { onConflict: "id" });
    const updatedInvitation = toWorkspaceInvitation(updatedRow);
    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
    return NextResponse.json<{ ok: true; invitation: WorkspaceInvitation; emailSent: boolean }>({
      ok: true,
      invitation: updatedInvitation,
      emailSent: !recipientAccountExisted,
    }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = getFamilyErrorStatus(message);
    apiLogger.error({ message: "workspaces_family_put_failed", requestId: meta.requestId, route: meta.route, method: meta.method, meta: { error: message } });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:workspaces-family:patch", max: 60, windowMs: 60_000 });
    if (!rate.allowed) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    const auth = await verifyRequestAuth(request);
    const body = (await request.json()) as {
      workspaceId?: string;
      memberUid?: string;
      role?: unknown;
      permissions?: unknown;
      status?: "active" | "pending" | "disabled";
    };
    const workspaceId = String(body.workspaceId || "").trim();
    const memberUid = String(body.memberUid || "").trim();
    if (!workspaceId || !memberUid) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    const requiredAction: FamilyManageAction = body.role !== undefined || body.status !== undefined ? "manage_members" : "edit_permissions";
    const access = await assertCanManage(auth.uid, workspaceId, requiredAction);
    if (body.permissions !== undefined && !access.owner && !canEditFamilyPermissions(access.manager)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    const existing = await getWorkspaceMember(access.workspaceUid, workspaceId, memberUid);
    if (!existing) return NextResponse.json({ ok: false, error: "member_not_found" }, { status: 404 });
    if (memberUid === access.workspaceUid) {
      return NextResponse.json({ ok: false, error: "cannot_modify_family_manager" }, { status: 400 });
    }
    const role = body.role === undefined ? existing.role : normalizeFamilyRole(body.role);
    const permissions = body.permissions === undefined ? existing.permissions : normalizeFamilyPermissions(body.permissions, role);
    const memberRow = toMemberRow({
      workspaceUid: access.workspaceUid,
      workspaceId,
      memberUid,
      email: existing.email,
      displayName: existing.displayName,
      role,
      permissions,
      status: body.status || existing.status,
      invitedByUid: existing.invitedByUid,
    });
    await supabaseUpsertRows("workspace_members", [memberRow], { onConflict: "id" });
    if (body.status === "disabled") {
      const pendingInvitationRows = await supabaseSelect("workspace_invitations", {
        filters: {
          workspace_uid: access.workspaceUid,
          workspace_id: workspaceId,
          invited_member_uid: memberUid,
          invitation_status: "pending",
        },
        limit: 20,
      });
      const now = new Date().toISOString();
      for (const invitationRow of pendingInvitationRows) {
        const invitationRaw = ((invitationRow.raw as Record<string, unknown> | null) || {}) as Record<string, unknown>;
        await supabaseUpsertRows("workspace_invitations", [{
          ...invitationRow,
          invitation_status: "revoked",
          raw: { ...invitationRaw, status: "revoked", revokedAt: now, updatedAt: now },
          updated_at: now,
        }], { onConflict: "id" });
      }
    }
    const member = toWorkspaceMember(memberRow);
    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
    return NextResponse.json({ ok: true, member }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = getFamilyErrorStatus(message);
    apiLogger.error({ message: "workspaces_family_patch_failed", requestId: meta.requestId, route: meta.route, method: meta.method, meta: { error: message } });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:workspaces-family:delete", max: 10, windowMs: 60_000 });
    if (!rate.allowed) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    const auth = await verifyRequestAuth(request);
    const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
    if (!workspaceId) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });

    const owned = await getOwnedWorkspace(auth.uid, workspaceId);
    if (!owned || owned.workspace_type !== "family") {
      return NextResponse.json({ ok: false, error: "workspace_not_family" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const raw = ((owned.raw as Record<string, unknown> | null) || {}) as Record<string, unknown>;
    const settings = ((owned.settings as Record<string, unknown> | null) || {}) as Record<string, unknown>;
    await supabaseUpsertRows(
      "workspaces",
      [
        {
          ...owned,
          workspace_type: "personal",
          settings: {
            ...settings,
            familyModeEnabled: false,
            familyClosedAt: now,
          },
          raw: {
            ...raw,
            type: "personal",
            settings: {
              ...(((raw.settings as Record<string, unknown> | null) || {}) as Record<string, unknown>),
              familyModeEnabled: false,
              familyClosedAt: now,
            },
            updatedAt: now,
          },
          updated_at: now,
        },
      ],
      { onConflict: "id" },
    );

    await supabasePatchByFilters(
      "workspace_members",
      { workspace_uid: auth.uid, workspace_id: workspaceId },
      {
        member_status: "disabled",
        raw: { familyClosedAt: now, status: "disabled" },
        updated_at: now,
      },
    );
    await supabasePatchByFilters(
      "workspace_invitations",
      { workspace_uid: auth.uid, workspace_id: workspaceId },
      {
        invitation_status: "revoked",
        raw: { familyClosedAt: now, status: "revoked" },
        updated_at: now,
      },
    );

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = getFamilyErrorStatus(message);
    apiLogger.error({ message: "workspaces_family_delete_failed", requestId: meta.requestId, route: meta.route, method: meta.method, meta: { error: message } });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
