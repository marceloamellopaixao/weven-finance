import { NextRequest, NextResponse } from "next/server";

import { resolveApiErrorStatus } from "@/lib/api/error";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { verifyRequestAuth } from "@/lib/auth/server";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import {
  DEFAULT_FAMILY_ROLE_PERMISSIONS,
  canManageFamilyMembers,
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
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
import { getSupabaseServiceClient, resolveSupabaseAuthUserId } from "@/services/supabase/service-client";
import { readSecureProfilePayload, writeSecureProfilePayload } from "@/lib/secure-store/profile";
import type { FamilyRole, WorkspaceInvitation, WorkspaceMember } from "@/types/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InviteMode = "temporary_password" | "auto_password" | "self_setup";

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function generateServerPassword() {
  const random = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(random, (value) => value.toString(16).padStart(2, "0")).join("");
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
  workspaceUid: string;
  workspaceId: string;
  email: string;
  role: FamilyRole;
  permissions: string[];
  invitedByUid: string;
  invitedMemberUid?: string | null;
  status?: "pending" | "accepted" | "revoked" | "expired";
}) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
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

async function assertCanManage(uid: string, workspaceId: string) {
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
  if (!manager || !canManageFamilyMembers(manager)) throw new Error("forbidden");
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
  mode: InviteMode;
  temporaryPassword?: string;
  redirectTo: string;
}) {
  const existingUserId = await resolveSupabaseAuthUserId({ email: input.email });
  const client = getSupabaseServiceClient();
  if (existingUserId) {
    if (input.mode !== "temporary_password") {
      await sendPasswordSetupEmail(client, input.email, input.redirectTo);
    }
    return {
      uid: existingUserId,
      created: false,
      needsPasswordSetup: input.mode !== "temporary_password",
      emailSent: input.mode !== "temporary_password",
    };
  }

  if (input.mode === "self_setup") {
    const invite = await client.auth.admin.inviteUserByEmail(input.email, {
      data: { displayName: input.displayName },
      redirectTo: input.redirectTo,
    });
    if (invite.error) throw new Error(`supabase_invite_failed:${invite.error.message}`);
    return { uid: invite.data.user?.id || "", created: true, needsPasswordSetup: true, emailSent: true };
  }

  const password = input.mode === "temporary_password" ? String(input.temporaryPassword || "") : generateServerPassword();
  if (password.length < 8) throw new Error("invalid_temporary_password");
  const result = await client.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: false,
    user_metadata: { displayName: input.displayName },
  });
  if (result.error) throw new Error(`supabase_user_create_failed:${result.error.message}`);
  if (input.mode === "auto_password") {
    await sendPasswordSetupEmail(client, input.email, input.redirectTo);
  }
  return { uid: result.data.user?.id || "", created: true, needsPasswordSetup: input.mode === "auto_password", emailSent: input.mode === "auto_password" };
}

async function sendPasswordSetupEmail(client: ReturnType<typeof getSupabaseServiceClient>, email: string, redirectTo: string) {
  const result = await client.auth.resetPasswordForEmail(email, { redirectTo });
  if (result.error) throw new Error(`supabase_password_email_failed:${result.error.message}`);
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
    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
    return NextResponse.json({
      ok: true,
      members: memberRows.map(toWorkspaceMember),
      invitations: invitationRows.map(toWorkspaceInvitation),
    }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "forbidden" ? 403 : resolveApiErrorStatus(message);
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
      inviteMode?: InviteMode;
      temporaryPassword?: string;
    };
    const workspaceId = String(body.workspaceId || "").trim();
    const email = normalizeEmail(body.email);
    if (!workspaceId || !email) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    const access = await assertCanManage(auth.uid, workspaceId);
    const role = normalizeFamilyRole(body.role);
    const permissions = normalizeFamilyPermissions(body.permissions || DEFAULT_FAMILY_ROLE_PERMISSIONS[role], role);
    const mode: InviteMode = body.inviteMode === "temporary_password" || body.inviteMode === "auto_password" ? body.inviteMode : "self_setup";
    const displayName = String(body.displayName || email.split("@")[0] || "Familiar").trim();

    const authUser = await resolveOrCreateAuthUser({
      email,
      displayName,
      mode,
      temporaryPassword: body.temporaryPassword,
      redirectTo: new URL("/first-access?intent=first-access&familyInvite=1", request.nextUrl.origin).toString(),
    });
    if (!authUser.uid) throw new Error("supabase_user_create_failed:missing_user_id");

    await ensureProfileForMember({ uid: authUser.uid, email, displayName, needsPasswordSetup: authUser.needsPasswordSetup });
    const memberRow = toMemberRow({
      workspaceUid: access.workspaceUid,
      workspaceId,
      memberUid: authUser.uid,
      email,
      displayName,
      role,
      permissions,
      invitedByUid: auth.uid,
      status: mode === "temporary_password" ? "active" : "pending",
    });
    const invitationRow = toInvitationRow({
      workspaceUid: access.workspaceUid,
      workspaceId,
      email,
      role,
      permissions,
      invitedByUid: auth.uid,
      invitedMemberUid: authUser.uid,
      status: mode === "temporary_password" ? "accepted" : "pending",
    });

    await supabaseUpsertRows("workspace_members", [memberRow], { onConflict: "id" });
    await supabaseUpsertRows("workspace_invitations", [invitationRow], { onConflict: "id" });
    const member = toWorkspaceMember(memberRow);
    const invitation = toWorkspaceInvitation(invitationRow);
    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
    return NextResponse.json<{ ok: true; member: WorkspaceMember; invitation: WorkspaceInvitation; generatedPasswordExposed: false; emailSent: boolean }>({
      ok: true,
      member,
      invitation,
      generatedPasswordExposed: false,
      emailSent: Boolean(authUser.emailSent),
    }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "forbidden" ? 403 : resolveApiErrorStatus(message);
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
    const access = await assertCanManage(auth.uid, workspaceId);
    if (memberUid) {
      if (memberUid === access.workspaceUid) {
        return NextResponse.json({ ok: false, error: "cannot_resend_owner_access" }, { status: 400 });
      }
      const member = await getWorkspaceMember(access.workspaceUid, workspaceId, memberUid);
      if (!member || member.status !== "active") return NextResponse.json({ ok: false, error: "member_not_found" }, { status: 404 });
      await sendPasswordSetupEmail(
        getSupabaseServiceClient(),
        member.email,
        new URL("/first-access?intent=first-access&familyInvite=1", request.nextUrl.origin).toString(),
      );
      await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
      return NextResponse.json<{ ok: true; member: WorkspaceMember; emailSent: boolean }>({
        ok: true,
        member,
        emailSent: true,
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
    await sendPasswordSetupEmail(
      getSupabaseServiceClient(),
      invitation.email,
      new URL("/first-access?intent=first-access&familyInvite=1", request.nextUrl.origin).toString(),
    );

    const now = new Date().toISOString();
    const raw = ((existing.raw as Record<string, unknown> | null) || {}) as Record<string, unknown>;
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
      emailSent: true,
    }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "forbidden" ? 403 : resolveApiErrorStatus(message);
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
    const access = await assertCanManage(auth.uid, workspaceId);
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
    const member = toWorkspaceMember(memberRow);
    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
    return NextResponse.json({ ok: true, member }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "forbidden" ? 403 : resolveApiErrorStatus(message);
    apiLogger.error({ message: "workspaces_family_patch_failed", requestId: meta.requestId, route: meta.route, method: meta.method, meta: { error: message } });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
