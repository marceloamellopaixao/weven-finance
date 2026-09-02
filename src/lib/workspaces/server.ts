import "server-only";

import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
import type {
  FamilyRole,
  WorkspaceMember,
  WorkspaceInvitation,
  WorkspaceInvitationStatus,
  WorkspaceType,
} from "@/types/workspace";
import { normalizeFamilyPermissions, normalizeFamilyRole } from "@/lib/workspaces/family";

type WorkspaceRow = Record<string, unknown>;

function isWorkspaceRowArchived(row: WorkspaceRow | null | undefined) {
  if (!row) return false;
  const settings = (row.settings as Record<string, unknown> | null) || {};
  const raw = (row.raw as Record<string, unknown> | null) || {};
  const rawSettings = (raw.settings as Record<string, unknown> | null) || {};
  return Boolean(settings.archivedAt || rawSettings.archivedAt || raw.status === "archived");
}

function isMissingWorkspaceFamilyTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("workspace_members") || message.includes("workspace_invitations");
}

export function toWorkspaceMember(row: WorkspaceRow): WorkspaceMember {
  const raw = (row.raw as Record<string, unknown> | null) || {};
  const role = normalizeFamilyRole(row.member_role ?? raw.role);
  return {
    id: String(row.id || raw.id || ""),
    workspaceId: String(row.workspace_id || raw.workspaceId || ""),
    workspaceUid: String(row.workspace_uid || raw.workspaceUid || ""),
    memberUid: String(row.member_uid || raw.memberUid || ""),
    email: String(row.email || raw.email || ""),
    displayName: String(row.display_name || raw.displayName || row.email || raw.email || ""),
    role,
    permissions: normalizeFamilyPermissions(row.permissions ?? raw.permissions, role),
    status: row.member_status === "pending" || row.member_status === "disabled" ? row.member_status : "active",
    invitedByUid: typeof row.invited_by_uid === "string" ? row.invited_by_uid : typeof raw.invitedByUid === "string" ? raw.invitedByUid : undefined,
    createdAt: String(row.created_at || raw.createdAt || new Date().toISOString()),
    updatedAt: String(row.updated_at || raw.updatedAt || new Date().toISOString()),
  };
}

export function toWorkspaceInvitation(row: WorkspaceRow): WorkspaceInvitation {
  const raw = (row.raw as Record<string, unknown> | null) || {};
  const role = normalizeFamilyRole(row.member_role ?? raw.role);
  const status = String(row.invitation_status || raw.status || "pending") as WorkspaceInvitationStatus;
  return {
    id: String(row.id || raw.id || ""),
    workspaceId: String(row.workspace_id || raw.workspaceId || ""),
    workspaceUid: String(row.workspace_uid || raw.workspaceUid || ""),
    email: String(row.email || raw.email || ""),
    role,
    permissions: normalizeFamilyPermissions(row.permissions ?? raw.permissions, role),
    status: ["pending", "accepted", "revoked", "expired"].includes(status) ? status : "pending",
    invitedByUid: String(row.invited_by_uid || raw.invitedByUid || ""),
    expiresAt: typeof row.expires_at === "string" ? row.expires_at : typeof raw.expiresAt === "string" ? raw.expiresAt : undefined,
    createdAt: String(row.created_at || raw.createdAt || new Date().toISOString()),
    updatedAt: String(row.updated_at || raw.updatedAt || new Date().toISOString()),
  };
}

export async function getOwnedWorkspace(uid: string, workspaceId: string) {
  const rows = await supabaseSelect("workspaces", {
    filters: { uid, source_id: workspaceId },
    limit: 1,
  });
  return rows[0] || null;
}

export async function getWorkspaceMember(workspaceUid: string, workspaceId: string, memberUid: string) {
  try {
    const rows = await supabaseSelect("workspace_members", {
      filters: { workspace_uid: workspaceUid, workspace_id: workspaceId, member_uid: memberUid },
      limit: 1,
    });
    return rows[0] ? toWorkspaceMember(rows[0]) : null;
  } catch (error) {
    if (isMissingWorkspaceFamilyTable(error)) return null;
    throw error;
  }
}

export async function getActiveMemberships(memberUid: string) {
  try {
    const rows = await supabaseSelect("workspace_members", {
      filters: { member_uid: memberUid, member_status: "active" },
      order: "created_at.asc",
    });
    return rows.map(toWorkspaceMember);
  } catch (error) {
    if (isMissingWorkspaceFamilyTable(error)) return [];
    throw error;
  }
}

export async function ensureFamilyManagerMembership(input: {
  workspaceUid: string;
  workspaceId: string;
  email: string;
  displayName: string;
}) {
  const now = new Date().toISOString();
  const existing = await getWorkspaceMember(input.workspaceUid, input.workspaceId, input.workspaceUid);
  if (existing) return existing;
  const id = `${input.workspaceUid}__${input.workspaceId}__${input.workspaceUid}`;
  const role: FamilyRole = "family_manager";
  const permissions = normalizeFamilyPermissions(undefined, role);
  const raw = {
    id,
    workspaceUid: input.workspaceUid,
    workspaceId: input.workspaceId,
    memberUid: input.workspaceUid,
    email: input.email,
    displayName: input.displayName,
    role,
    permissions,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  try {
    await supabaseUpsertRows(
      "workspace_members",
      [
        {
          id,
          workspace_uid: input.workspaceUid,
          workspace_id: input.workspaceId,
          member_uid: input.workspaceUid,
          email: input.email,
          display_name: input.displayName,
          member_role: role,
          permissions,
          member_status: "active",
          raw,
          created_at: now,
          updated_at: now,
        },
      ],
      { onConflict: "id" },
    );
  } catch (error) {
    if (!isMissingWorkspaceFamilyTable(error)) throw error;
  }
  return toWorkspaceMember(raw);
}

export async function resolveActiveWorkspaceContext(uid: string, workspaceId?: string | null): Promise<{
  ownerUid: string;
  workspaceId: string | null;
  workspaceType: WorkspaceType;
  member: WorkspaceMember | null;
  includeLegacyRows: boolean;
}> {
  const ownedRows = await supabaseSelect("workspaces", {
    filters: workspaceId ? { uid, source_id: workspaceId } : { uid, is_default: true },
    order: "is_default.desc,created_at.asc",
    limit: 1,
  });
  const owned = ownedRows[0];
  if (owned) {
    if (isWorkspaceRowArchived(owned)) {
      throw new Error("workspace_archived");
    }
    return {
      ownerUid: uid,
      workspaceId: String(owned.source_id || workspaceId || ""),
      workspaceType: String(owned.workspace_type || "personal") as WorkspaceType,
      member: null,
      includeLegacyRows: Boolean(owned.is_default) || !workspaceId,
    };
  }

  let memberships: Record<string, unknown>[] = [];
  try {
    memberships = workspaceId
      ? await supabaseSelect("workspace_members", {
          filters: { member_uid: uid, workspace_id: workspaceId, member_status: "active" },
          limit: 1,
        })
      : await supabaseSelect("workspace_members", {
          filters: { member_uid: uid, member_status: "active" },
          order: "created_at.asc",
          limit: 1,
        });
  } catch (error) {
    if (!isMissingWorkspaceFamilyTable(error)) throw error;
  }
  const membership = memberships[0] ? toWorkspaceMember(memberships[0]) : null;
  if (!membership) {
    return { ownerUid: uid, workspaceId: workspaceId || null, workspaceType: "personal", member: null, includeLegacyRows: !workspaceId };
  }

  const workspaceRows = await supabaseSelect("workspaces", {
    filters: { uid: membership.workspaceUid, source_id: membership.workspaceId },
    limit: 1,
  });
  if (isWorkspaceRowArchived(workspaceRows[0])) {
    throw new Error("workspace_archived");
  }
  return {
    ownerUid: membership.workspaceUid,
    workspaceId: membership.workspaceId,
    workspaceType: String(workspaceRows[0]?.workspace_type || "family") as WorkspaceType,
    member: membership,
    includeLegacyRows: false,
  };
}
