import { NextRequest, NextResponse } from "next/server";

import { resolveApiErrorStatus } from "@/lib/api/error";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { verifyRequestAuth } from "@/lib/auth/server";
import { resolveUserUidFromMetadata } from "@/lib/auth/user-uid";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { pushNotification } from "@/lib/notifications/server";
import { getPlanCapabilities } from "@/lib/plans/capabilities";
import { getUserPlanContext } from "@/lib/plans/server";
import { readSecureProfilePayload, writeSecureProfilePayload } from "@/lib/secure-store/profile";
import {
  DEFAULT_BUSINESS_ROLE_PERMISSIONS,
  canEditBusinessMembers,
  canEditBusinessPermissions,
  canInviteBusinessMembers,
  canViewBusinessMembers,
  normalizeBusinessPermissions,
  normalizeBusinessRole,
} from "@/lib/workspaces/business";
import { buildWorkspaceSeatSummary, countOccupiedWorkspaceSeats } from "@/lib/workspaces/seats";
import {
  getOwnedWorkspace,
  getWorkspaceMember,
  toBusinessWorkspaceInvitation,
  toBusinessWorkspaceMember,
} from "@/lib/workspaces/server";
import { supabasePatchByFilters, supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
import { getSupabaseServiceClient, resolveSupabaseAuthUserId } from "@/services/supabase/service-client";
import type {
  BusinessPermission,
  BusinessRole,
  BusinessWorkspaceInvitation,
  BusinessWorkspaceMember,
  WorkspaceSeatSummary,
} from "@/types/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ManageAction = "manage_members" | "invite_members" | "edit_permissions";

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function memberRow(input: {
  workspaceUid: string;
  workspaceId: string;
  memberUid: string;
  email: string;
  displayName: string;
  role: BusinessRole;
  permissions: BusinessPermission[];
  status?: "active" | "pending" | "disabled";
  invitedByUid?: string;
}) {
  const now = new Date().toISOString();
  const id = `${input.workspaceUid}__${input.workspaceId}__${input.memberUid}`;
  const status = input.status || "active";
  const raw = { id, ...input, status, createdAt: now, updatedAt: now };
  return {
    id,
    workspace_uid: input.workspaceUid,
    workspace_id: input.workspaceId,
    member_uid: input.memberUid,
    email: input.email,
    display_name: input.displayName,
    member_role: input.role,
    permissions: input.permissions,
    member_status: status,
    invited_by_uid: input.invitedByUid || null,
    raw,
    created_at: now,
    updated_at: now,
  };
}

function invitationRow(input: {
  workspaceUid: string;
  workspaceId: string;
  email: string;
  role: BusinessRole;
  permissions: BusinessPermission[];
  invitedByUid: string;
  invitedMemberUid: string;
  recipientAccountExisted: boolean;
}) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const raw = { id, ...input, status: "pending", expiresAt, createdAt: now, updatedAt: now };
  return {
    id,
    workspace_uid: input.workspaceUid,
    workspace_id: input.workspaceId,
    email: input.email,
    member_role: input.role,
    permissions: input.permissions,
    invitation_status: "pending",
    invited_by_uid: input.invitedByUid,
    invited_member_uid: input.invitedMemberUid,
    expires_at: expiresAt,
    raw,
    created_at: now,
    updated_at: now,
  };
}

function canManage(member: BusinessWorkspaceMember | null, action: ManageAction) {
  if (action === "invite_members") return canInviteBusinessMembers(member);
  if (action === "edit_permissions") return canEditBusinessPermissions(member);
  return canEditBusinessMembers(member);
}

async function resolveAccess(uid: string, workspaceId: string, action?: ManageAction) {
  const owned = await getOwnedWorkspace(uid, workspaceId);
  if (owned) {
    if (owned.workspace_type !== "business") throw new Error("workspace_not_business");
    return { workspaceUid: uid, workspaceId, owner: true as const, manager: null };
  }
  const rows = await supabaseSelect("workspace_members", {
    filters: { member_uid: uid, workspace_id: workspaceId, member_status: "active" },
    limit: 1,
  });
  const manager = rows[0] ? toBusinessWorkspaceMember(rows[0]) : null;
  const allowed = action ? canManage(manager, action) : canViewBusinessMembers(manager);
  if (!manager || !allowed) throw new Error("forbidden");
  const workspace = await getOwnedWorkspace(manager.workspaceUid, workspaceId);
  if (workspace?.workspace_type !== "business") throw new Error("workspace_not_business");
  return { workspaceUid: manager.workspaceUid, workspaceId, owner: false as const, manager };
}

async function ensureProfile(input: { uid: string; email: string; displayName: string; needsPasswordSetup: boolean }) {
  const existing = await supabaseSelect("profiles", { filters: { uid: input.uid }, limit: 1 });
  const now = new Date().toISOString();
  if (existing[0]) {
    const row = existing[0];
    const raw = readSecureProfilePayload(row.raw);
    await supabaseUpsertRows("profiles", [{
      uid: input.uid,
      raw: writeSecureProfilePayload({
        ...raw,
        email: row.email || raw.email || input.email,
        displayName: row.display_name || raw.displayName || input.displayName,
        authProviders: Array.from(new Set([...(Array.isArray(raw.authProviders) ? raw.authProviders : []), "email"])),
        needsPasswordSetup: input.needsPasswordSetup || Boolean(raw.needsPasswordSetup),
        updatedAt: now,
      }),
      updated_at: now,
    }], { onConflict: "uid" });
    return;
  }
  await supabaseUpsertRows("profiles", [{
    uid: input.uid,
    email: input.email,
    display_name: input.displayName,
    complete_name: input.displayName,
    phone: "",
    role: "client",
    plan: "free",
    status: "active",
    payment_status: "pending",
    billing: { source: "business_invite", lastSyncAt: now },
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
      billing: { source: "business_invite", lastSyncAt: now },
      transactionCount: 0,
      verifiedEmail: false,
      authProviders: ["email"],
      needsPasswordSetup: input.needsPasswordSetup,
      createdAt: now,
    }),
  }], { onConflict: "uid" });
}

async function resolveOrInviteUser(input: { email: string; displayName: string; redirectTo: string }) {
  const profiles = await supabaseSelect("profiles", { conditions: { email: `ilike.${input.email}` }, limit: 1 });
  if (profiles[0]?.uid) {
    return { uid: String(profiles[0].uid), accountExists: true, profileExists: true, emailSent: false, needsPasswordSetup: false, displayName: String(profiles[0].display_name || input.displayName) };
  }
  const authId = await resolveSupabaseAuthUserId({ email: input.email });
  const client = getSupabaseServiceClient();
  if (authId) {
    const result = await client.auth.admin.getUserById(authId);
    if (result.error || !result.data.user) throw new Error(`supabase_auth_user_lookup_failed:${result.error?.message || "not_found"}`);
    return {
      uid: resolveUserUidFromMetadata(result.data.user.user_metadata, authId),
      accountExists: true,
      profileExists: false,
      emailSent: false,
      needsPasswordSetup: false,
      displayName: String(result.data.user.user_metadata?.displayName || input.displayName),
    };
  }
  const invite = await client.auth.admin.inviteUserByEmail(input.email, { data: { displayName: input.displayName }, redirectTo: input.redirectTo });
  if (invite.error) throw new Error(`supabase_invite_failed:${invite.error.message}`);
  return { uid: invite.data.user?.id || "", accountExists: false, profileExists: false, emailSent: true, needsPasswordSetup: true, displayName: input.displayName };
}

async function seatSummary(workspaceUid: string, workspaceId: string, rows?: Array<Record<string, unknown>>): Promise<WorkspaceSeatSummary> {
  const context = await getUserPlanContext(workspaceUid);
  const capabilities = getPlanCapabilities(context.plan, context.plans, context.featureAccess);
  const memberRows = rows ?? await supabaseSelect("workspace_members", {
    filters: { workspace_uid: workspaceUid, workspace_id: workspaceId },
    conditions: { member_status: "in.(active,pending)" },
    limit: 100,
  });
  const profiles = await supabaseSelect("profiles", { select: "billing,raw", filters: { uid: workspaceUid }, limit: 1 });
  const raw = (profiles[0]?.raw as Record<string, unknown> | null) || {};
  const billing = ((profiles[0]?.billing as Record<string, unknown> | null) || (raw.billing as Record<string, unknown> | null) || {}) as Record<string, unknown>;
  return buildWorkspaceSeatSummary({
    plan: context.plans.business,
    occupied: countOccupiedWorkspaceSeats(workspaceUid, memberRows),
    additionalSeats: billing.additionalSeats,
    fallbackIncluded: capabilities.hasBusinessWorkspace ? 5 : 5,
  });
}

async function expireInvitations(workspaceUid: string, workspaceId: string) {
  const rows = await supabaseSelect("workspace_invitations", {
    filters: { workspace_uid: workspaceUid, workspace_id: workspaceId, invitation_status: "pending" },
    conditions: { expires_at: `lt.${new Date().toISOString()}` },
    limit: 100,
  });
  const now = new Date().toISOString();
  for (const row of rows) {
    await supabasePatchByFilters("workspace_invitations", { id: String(row.id) }, { invitation_status: "expired", updated_at: now });
    if (row.invited_member_uid) {
      await supabasePatchByFilters("workspace_members", { workspace_uid: workspaceUid, workspace_id: workspaceId, member_uid: String(row.invited_member_uid), member_status: "pending" }, { member_status: "disabled", updated_at: now });
    }
  }
}

async function assertInviteAllowed(workspaceUid: string, workspaceId: string, email: string) {
  await expireInvitations(workspaceUid, workspaceId);
  const context = await getUserPlanContext(workspaceUid);
  const capabilities = getPlanCapabilities(context.plan, context.plans, context.featureAccess);
  if (!context.isBillingExempt && !capabilities.hasBusinessWorkspace) throw new Error("business_plan_required");
  const rows = await supabaseSelect("workspace_members", {
    filters: { workspace_uid: workspaceUid, workspace_id: workspaceId },
    conditions: { member_status: "in.(active,pending)" },
    limit: 100,
  });
  if (rows.some((row) => normalizeEmail(row.email) === email)) throw new Error("business_member_already_invited");
  const seats = await seatSummary(workspaceUid, workspaceId, rows);
  if (!context.isBillingExempt && seats.available <= 0) throw new Error("business_seat_limit_reached");
}

function errorStatus(message: string) {
  if (["business_member_already_invited", "business_seat_capacity_changed"].includes(message)) return 409;
  if (["business_plan_required", "business_seat_limit_reached", "forbidden"].includes(message)) return 403;
  if (message === "cannot_invite_yourself") return 400;
  return resolveApiErrorStatus(message);
}

async function respondError(request: NextRequest, startedAt: number, error: unknown) {
  const meta = getRequestMeta(request);
  const message = error instanceof Error ? error.message : "unknown_error";
  const status = errorStatus(message);
  apiLogger.error({ message: "workspaces_business_request_failed", requestId: meta.requestId, route: meta.route, method: meta.method, meta: { error: message } });
  await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:workspaces-business:get", max: 120, windowMs: 60_000 });
    if (!rate.allowed) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    const auth = await verifyRequestAuth(request);
    const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
    if (!workspaceId) return NextResponse.json({ ok: false, error: "missing_workspace_id" }, { status: 400 });
    const access = await resolveAccess(auth.uid, workspaceId);
    await expireInvitations(access.workspaceUid, workspaceId);
    const [members, invitations] = await Promise.all([
      supabaseSelect("workspace_members", { filters: { workspace_uid: access.workspaceUid, workspace_id: workspaceId }, conditions: { member_status: "in.(active,pending)" }, order: "created_at.asc", limit: 100 }),
      supabaseSelect("workspace_invitations", { filters: { workspace_uid: access.workspaceUid, workspace_id: workspaceId }, order: "created_at.desc", limit: 50 }),
    ]);
    return NextResponse.json({ ok: true, members: members.map(toBusinessWorkspaceMember), invitations: invitations.map(toBusinessWorkspaceInvitation), seats: await seatSummary(access.workspaceUid, workspaceId, members) });
  } catch (error) {
    return respondError(request, startedAt, error);
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:workspaces-business:post", max: 30, windowMs: 60_000 });
    if (!rate.allowed) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    const auth = await verifyRequestAuth(request);
    const body = await request.json() as { workspaceId?: string; email?: string; displayName?: string; role?: unknown; permissions?: unknown };
    const workspaceId = String(body.workspaceId || "").trim();
    const email = normalizeEmail(body.email);
    if (!workspaceId || !email) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    if (email === normalizeEmail(auth.email)) throw new Error("cannot_invite_yourself");
    const access = await resolveAccess(auth.uid, workspaceId, "invite_members");
    await assertInviteAllowed(access.workspaceUid, workspaceId, email);
    const role = normalizeBusinessRole(body.role);
    if (role === "business_owner") throw new Error("cannot_assign_business_owner");
    const permissions = normalizeBusinessPermissions(body.permissions || DEFAULT_BUSINESS_ROLE_PERMISSIONS[role], role);
    const displayName = String(body.displayName || email.split("@")[0] || "Funcionário").trim();
    const authUser = await resolveOrInviteUser({ email, displayName, redirectTo: new URL("/first-access?intent=first-access&businessInvite=1", request.nextUrl.origin).toString() });
    if (!authUser.uid) throw new Error("supabase_user_create_failed:missing_user_id");
    if (!authUser.profileExists) await ensureProfile({ uid: authUser.uid, email, displayName, needsPasswordSetup: authUser.needsPasswordSetup });
    const row = memberRow({ workspaceUid: access.workspaceUid, workspaceId, memberUid: authUser.uid, email, displayName: authUser.displayName || displayName, role, permissions, invitedByUid: auth.uid, status: "pending" });
    const invite = invitationRow({ workspaceUid: access.workspaceUid, workspaceId, email, role, permissions, invitedByUid: auth.uid, invitedMemberUid: authUser.uid, recipientAccountExisted: authUser.accountExists });
    await supabaseUpsertRows("workspace_members", [row], { onConflict: "id" });
    await supabaseUpsertRows("workspace_invitations", [invite], { onConflict: "id" });
    const seats = await seatSummary(access.workspaceUid, workspaceId);
    const context = await getUserPlanContext(access.workspaceUid);
    if (!context.isBillingExempt && seats.occupied > seats.capacity) {
      const now = new Date().toISOString();
      await supabasePatchByFilters("workspace_members", { id: row.id }, { member_status: "disabled", updated_at: now });
      await supabasePatchByFilters("workspace_invitations", { id: invite.id }, { invitation_status: "revoked", updated_at: now });
      throw new Error("business_seat_capacity_changed");
    }
    const member = toBusinessWorkspaceMember(row);
    const invitation = toBusinessWorkspaceInvitation(invite);
    if (authUser.accountExists) {
      await pushNotification({ uid: authUser.uid, kind: "workspace", title: "Convite para uma equipe", message: `${auth.name || "Um responsável"} convidou você para um perfil Business/PJ.`, href: "/dashboard?workspaceInvite=1", meta: { invitationId: invitation.id, workspaceId, workspaceUid: access.workspaceUid } }).catch(() => undefined);
    }
    return NextResponse.json({ ok: true, member, invitation, generatedPasswordExposed: false, emailSent: authUser.emailSent, recipientType: authUser.accountExists ? "existing_account" : "new_account", seats });
  } catch (error) {
    return respondError(request, startedAt, error);
  }
}

export async function PUT(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:workspaces-business:put", max: 30, windowMs: 60_000 });
    if (!rate.allowed) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    const auth = await verifyRequestAuth(request);
    const body = await request.json() as { workspaceId?: string; invitationId?: string };
    const workspaceId = String(body.workspaceId || "").trim();
    const invitationId = String(body.invitationId || "").trim();
    if (!workspaceId || !invitationId) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    const access = await resolveAccess(auth.uid, workspaceId, "invite_members");
    const rows = await supabaseSelect("workspace_invitations", { filters: { id: invitationId, workspace_uid: access.workspaceUid, workspace_id: workspaceId }, limit: 1 });
    if (!rows[0]) return NextResponse.json({ ok: false, error: "invitation_not_found" }, { status: 404 });
    const invitation = toBusinessWorkspaceInvitation(rows[0]);
    if (invitation.status !== "pending") return NextResponse.json({ ok: false, error: "invitation_not_pending" }, { status: 409 });
    const raw = (rows[0].raw as Record<string, unknown> | null) || {};
    const existed = raw.recipientAccountExisted === true;
    if (existed && invitation.invitedMemberUid) {
      await pushNotification({ uid: invitation.invitedMemberUid, kind: "workspace", title: "Convite pendente para uma equipe", message: "Você tem um convite Business/PJ aguardando sua confirmação.", href: "/dashboard?workspaceInvite=1", meta: { invitationId, workspaceId } }).catch(() => undefined);
    } else {
      const result = await getSupabaseServiceClient().auth.resetPasswordForEmail(invitation.email, { redirectTo: new URL("/first-access?intent=first-access&businessInvite=1", request.nextUrl.origin).toString() });
      if (result.error) throw new Error(`supabase_password_email_failed:${result.error.message}`);
    }
    const now = new Date().toISOString();
    const updated = { ...rows[0], raw: { ...raw, resentAt: now, updatedAt: now }, updated_at: now };
    await supabaseUpsertRows("workspace_invitations", [updated], { onConflict: "id" });
    return NextResponse.json({ ok: true, invitation: toBusinessWorkspaceInvitation(updated), emailSent: !existed });
  } catch (error) {
    return respondError(request, startedAt, error);
  }
}

export async function PATCH(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:workspaces-business:patch", max: 60, windowMs: 60_000 });
    if (!rate.allowed) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    const auth = await verifyRequestAuth(request);
    const body = await request.json() as { workspaceId?: string; memberUid?: string; role?: unknown; permissions?: unknown; status?: "active" | "pending" | "disabled" };
    const workspaceId = String(body.workspaceId || "").trim();
    const memberUid = String(body.memberUid || "").trim();
    if (!workspaceId || !memberUid) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    const action: ManageAction = body.role !== undefined || body.status !== undefined ? "manage_members" : "edit_permissions";
    const access = await resolveAccess(auth.uid, workspaceId, action);
    if (body.permissions !== undefined && !access.owner && !canEditBusinessPermissions(access.manager)) throw new Error("forbidden");
    if (memberUid === access.workspaceUid) throw new Error("cannot_modify_business_owner");
    const existing = await getWorkspaceMember(access.workspaceUid, workspaceId, memberUid);
    if (!existing || !String(existing.role).startsWith("business_") && !["collaborator", "accountant_viewer"].includes(String(existing.role))) return NextResponse.json({ ok: false, error: "member_not_found" }, { status: 404 });
    const current = existing as BusinessWorkspaceMember;
    const role = body.role === undefined ? current.role : normalizeBusinessRole(body.role);
    if (role === "business_owner") throw new Error("cannot_assign_business_owner");
    const permissions = body.permissions === undefined ? current.permissions : normalizeBusinessPermissions(body.permissions, role);
    const row = memberRow({ workspaceUid: access.workspaceUid, workspaceId, memberUid, email: current.email, displayName: current.displayName, role, permissions, status: body.status || current.status, invitedByUid: current.invitedByUid });
    await supabaseUpsertRows("workspace_members", [row], { onConflict: "id" });
    if (body.status === "disabled") {
      await supabasePatchByFilters("workspace_invitations", { workspace_uid: access.workspaceUid, workspace_id: workspaceId, invited_member_uid: memberUid, invitation_status: "pending" }, { invitation_status: "revoked", updated_at: new Date().toISOString() });
    }
    return NextResponse.json({ ok: true, member: toBusinessWorkspaceMember(row), ...(body.status === "disabled" ? { seats: await seatSummary(access.workspaceUid, workspaceId) } : {}) });
  } catch (error) {
    return respondError(request, startedAt, error);
  }
}

export async function DELETE(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:workspaces-business:delete", max: 20, windowMs: 60_000 });
    if (!rate.allowed) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    const auth = await verifyRequestAuth(request);
    const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
    const invitationId = request.nextUrl.searchParams.get("invitationId")?.trim();
    if (!workspaceId || !invitationId) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    const access = await resolveAccess(auth.uid, workspaceId, "invite_members");
    const rows = await supabaseSelect("workspace_invitations", { filters: { id: invitationId, workspace_uid: access.workspaceUid, workspace_id: workspaceId }, limit: 1 });
    if (!rows[0]) return NextResponse.json({ ok: false, error: "invitation_not_found" }, { status: 404 });
    const invitation = toBusinessWorkspaceInvitation(rows[0]);
    if (invitation.status !== "pending") return NextResponse.json({ ok: false, error: "invitation_not_pending" }, { status: 409 });
    const now = new Date().toISOString();
    await supabasePatchByFilters("workspace_invitations", { id: invitationId }, { invitation_status: "revoked", raw: { ...((rows[0].raw as object | null) || {}), status: "revoked", revokedAt: now, revokedByUid: auth.uid }, updated_at: now });
    if (invitation.invitedMemberUid) await supabasePatchByFilters("workspace_members", { workspace_uid: access.workspaceUid, workspace_id: workspaceId, member_uid: invitation.invitedMemberUid, member_status: "pending" }, { member_status: "disabled", updated_at: now });
    return NextResponse.json({ ok: true, invitation: { ...invitation, status: "revoked", updatedAt: now } satisfies BusinessWorkspaceInvitation, seats: await seatSummary(access.workspaceUid, workspaceId) });
  } catch (error) {
    return respondError(request, startedAt, error);
  }
}
