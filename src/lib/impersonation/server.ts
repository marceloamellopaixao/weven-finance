import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { UserRole } from "@/types/user";
import { verifyRequestAuth } from "@/lib/auth/server";
import { readSecureProfilePayload } from "@/lib/secure-store/profile";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";

export type ImpersonationRequestStatus = "pending" | "approved" | "rejected" | "revoked" | "expired";

export type AuthContext = {
  uid: string;
  rawUid: string;
  role: UserRole;
  displayName: string;
  email: string;
};

export type ActingContext = {
  requesterUid: string;
  requesterRawUid: string;
  requesterRole: UserRole;
  actingUid: string;
  isImpersonating: boolean;
};

export type SupportAccessRequestDoc = {
  requesterUid: string;
  requesterDisplayName: string;
  requesterEmail: string;
  requesterRole: UserRole;
  targetUid: string;
  targetDisplayName: string;
  targetEmail: string;
  targetRole: UserRole;
  status: ImpersonationRequestStatus;
  permissionImpersonate: boolean | null;
  createdAt: string;
  updatedAt: string;
  handledAt?: string | null;
  expiresAt?: string | null;
};

export type ImpersonationActionRequestStatus = "pending" | "approved" | "rejected" | "consumed" | "expired";

export type ImpersonationActionRequestDoc = {
  requesterUid: string;
  requesterDisplayName: string;
  requesterEmail: string;
  requesterRole: UserRole;
  targetUid: string;
  targetDisplayName: string;
  targetEmail: string;
  targetRole: UserRole;
  actionType: string;
  actionLabel: string;
  status: ImpersonationActionRequestStatus;
  permissionImpersonate: boolean | null;
  createdAt: string;
  updatedAt: string;
  handledAt?: string | null;
  expiresAt?: string | null;
  consumedAt?: string | null;
};

function toUserRole(value: unknown): UserRole {
  if (value === "admin" || value === "moderator" || value === "support" || value === "client") {
    return value;
  }
  return "client";
}

export function canManageImpersonation(role: UserRole) {
  return role === "admin" || role === "moderator" || role === "support";
}

function getIsoNow() {
  return new Date().toISOString();
}

function addHours(date: Date, hours: number): Date {
  const copy = new Date(date);
  copy.setHours(copy.getHours() + hours);
  return copy;
}

function randomId() {
  return crypto.randomUUID();
}

async function getUserProfileSummary(uid: string) {
  const rows = await supabaseSelect("profiles", { filters: { uid }, limit: 1 });
  if (rows.length === 0) throw new Error("user_not_found");
  const row = rows[0];
  const raw = readSecureProfilePayload(row.raw);
  return {
    uid,
    displayName: String(row.display_name || raw.displayName || "Usuário"),
    email: String(row.email || raw.email || ""),
    role: toUserRole(row.role || raw.role),
  };
}

export async function getAuthContextFromRequest(request: NextRequest): Promise<AuthContext> {
  const decoded = await verifyRequestAuth(request);
  let rows = await supabaseSelect("profiles", { filters: { uid: decoded.uid }, limit: 1 });
  if (rows.length === 0 && decoded.rawUid && decoded.rawUid !== decoded.uid) {
    rows = await supabaseSelect("profiles", { filters: { uid: decoded.rawUid }, limit: 1 });
  }
  if (rows.length === 0) {
    return {
      uid: decoded.uid,
      rawUid: decoded.rawUid,
      role: "client",
      displayName: String(decoded.name || "Usuário"),
      email: String(decoded.email || ""),
    };
  }
  const row = rows[0];
  const raw = readSecureProfilePayload(row.raw);
  return {
    uid: String(row.uid || decoded.uid),
    rawUid: decoded.rawUid,
    role: toUserRole(row.role || raw.role),
    displayName: String(row.display_name || raw.displayName || decoded.name || "Usuário"),
    email: String(row.email || raw.email || decoded.email || ""),
  };
}

export async function resolveActingContext(request: NextRequest): Promise<ActingContext> {
  const auth = await getAuthContextFromRequest(request);
  const targetUid = request.headers.get("x-impersonate-uid")?.trim();

  if (!targetUid || targetUid === auth.uid) {
    return {
      requesterUid: auth.uid,
      requesterRawUid: auth.rawUid,
      requesterRole: auth.role,
      actingUid: auth.uid,
      isImpersonating: false,
    };
  }

  if (!canManageImpersonation(auth.role)) {
    throw new Error("impersonation_forbidden_role");
  }

  const requestRowsByUid = await supabaseSelect("support_access_requests", {
    filters: { requester_uid: auth.uid },
  });
  const requestRowsByRawUid =
    auth.rawUid && auth.rawUid !== auth.uid
      ? await supabaseSelect("support_access_requests", {
          filters: { requester_uid: auth.rawUid },
        })
      : [];
  const requestRows = [...requestRowsByUid, ...requestRowsByRawUid];
  if (requestRows.length === 0) {
    throw new Error("impersonation_not_allowed");
  }

  const nowIso = getIsoNow();
  const validDoc = requestRows
    .map((row) => (row.raw as SupportAccessRequestDoc | null) ?? null)
    .filter((item): item is SupportAccessRequestDoc => Boolean(item))
    .filter(
      (item) =>
        item.targetUid === targetUid &&
        item.status === "approved" &&
        item.permissionImpersonate === true
    )
    .sort((a, b) =>
      String(b.handledAt || b.updatedAt || b.createdAt).localeCompare(
        String(a.handledAt || a.updatedAt || a.createdAt)
      )
    )
    .find((item) => !item.expiresAt || item.expiresAt > nowIso);

  if (!validDoc) throw new Error("impersonation_expired");

  return {
    requesterUid: auth.uid,
    requesterRawUid: auth.rawUid,
    requesterRole: auth.role,
    actingUid: targetUid,
    isImpersonating: true,
  };
}

export async function createSupportAccessLog(input: {
  idUser: string;
  userDisplayName: string;
  userEmail: string;
  userRole: UserRole;
  idUserImpersonate: string;
  userDisplayNameImpersonate: string;
  userEmailImpersonate: string;
  userRoleImpersonate: UserRole;
  permissionImpersonate: boolean;
  requestId: string;
}) {
  const createdAt = getIsoNow();
  const raw = {
    idUser: input.idUser,
    idUserImpersonate: input.idUserImpersonate,
    userDisplayName: input.userDisplayName,
    userEmail: input.userEmail,
    userRole: input.userRole,
    userDisplayNameImpersonate: input.userDisplayNameImpersonate,
    userEmailImpersonate: input.userEmailImpersonate,
    userRoleImpersonate: input.userRoleImpersonate,
    permissionImpersonate: input.permissionImpersonate,
    requestId: input.requestId,
    createdAt,
  };
  await supabaseUpsertRows("log_acesso_suporte", [
    {
      id: randomId(),
      id_user: input.idUser,
      id_user_impersonate: input.idUserImpersonate,
      permission_impersonate: input.permissionImpersonate,
      raw,
      created_at: createdAt,
    },
  ]);
}

export function buildApprovedRequestPatch() {
  const now = new Date();
  return {
    status: "approved" as const,
    permissionImpersonate: true,
    updatedAt: now.toISOString(),
    handledAt: now.toISOString(),
    expiresAt: addHours(now, 2).toISOString(),
  };
}

export function buildRejectedRequestPatch() {
  const nowIso = getIsoNow();
  return {
    status: "rejected" as const,
    permissionImpersonate: false,
    updatedAt: nowIso,
    handledAt: nowIso,
    expiresAt: null,
  };
}

async function createOrReusePendingActionRequest(input: {
  requesterUid: string;
  requesterRawUid?: string;
  requesterRole: UserRole;
  targetUid: string;
  actionType: string;
  actionLabel: string;
}) {
  const rowsByUid = await supabaseSelect("impersonation_action_requests", {
    filters: { requester_uid: input.requesterUid },
  });
  const rowsByRawUid =
    input.requesterRawUid && input.requesterRawUid !== input.requesterUid
      ? await supabaseSelect("impersonation_action_requests", {
          filters: { requester_uid: input.requesterRawUid },
        })
      : [];
  const rows = [...rowsByUid, ...rowsByRawUid];

  const existing = rows
    .map((row) => ({ id: String(row.id || ""), doc: (row.raw as ImpersonationActionRequestDoc | null) ?? null }))
    .find(
      (item) =>
        item.doc &&
        item.doc.targetUid === input.targetUid &&
        item.doc.actionType === input.actionType &&
        item.doc.status === "pending"
    );

  if (existing) return existing.id;

  const [requester, target] = await Promise.all([
    getUserProfileSummary(input.requesterUid),
    getUserProfileSummary(input.targetUid),
  ]);

  const nowIso = getIsoNow();
  const id = randomId();
  const raw: ImpersonationActionRequestDoc = {
    requesterUid: requester.uid,
    requesterDisplayName: requester.displayName,
    requesterEmail: requester.email,
    requesterRole: input.requesterRole,
    targetUid: target.uid,
    targetDisplayName: target.displayName,
    targetEmail: target.email,
    targetRole: target.role,
    actionType: input.actionType,
    actionLabel: input.actionLabel,
    status: "pending",
    permissionImpersonate: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    handledAt: null,
    expiresAt: null,
    consumedAt: null,
  };

  await supabaseUpsertRows("impersonation_action_requests", [
    {
      id,
      requester_uid: requester.uid,
      target_uid: target.uid,
      action_type: input.actionType,
      action_status: "pending",
      raw,
      created_at: nowIso,
    },
  ]);
  return id;
}

async function consumeApprovedActionRequest(input: {
  actionRequestId: string;
  requesterUid: string;
  targetUid: string;
  actionType: string;
}) {
  const rows = await supabaseSelect("impersonation_action_requests", {
    filters: { id: input.actionRequestId },
    limit: 1,
  });
  if (rows.length === 0) throw new Error("impersonation_action_not_found");

  const data = ((rows[0].raw as ImpersonationActionRequestDoc | null) ?? null);
  if (!data) throw new Error("impersonation_action_not_found");
  const nowIso = getIsoNow();
  const notExpired = !data.expiresAt || data.expiresAt > nowIso;
  const valid =
    data.requesterUid === input.requesterUid &&
    data.targetUid === input.targetUid &&
    data.actionType === input.actionType &&
    data.status === "approved" &&
    data.permissionImpersonate === true &&
    !data.consumedAt &&
    notExpired;
  if (!valid) throw new Error("impersonation_action_not_approved");

  const nextRaw = { ...data, status: "consumed" as const, updatedAt: nowIso, consumedAt: nowIso };
  await supabaseUpsertRows(
    "impersonation_action_requests",
    [
      {
        id: input.actionRequestId,
        action_status: "consumed",
        raw: nextRaw,
      },
    ],
    { onConflict: "id" }
  );
}

export async function ensureImpersonationWriteApproval(input: {
  request: NextRequest;
  acting: ActingContext;
  actionType: string;
  actionLabel: string;
}) {
  if (!input.acting.isImpersonating) {
    return { allowed: true as const };
  }

  const actionRequestId = input.request.headers.get("x-impersonation-action-id")?.trim();
  if (!actionRequestId) {
    const createdId = await createOrReusePendingActionRequest({
      requesterUid: input.acting.requesterUid,
      requesterRawUid: input.acting.requesterRawUid,
      requesterRole: input.acting.requesterRole,
      targetUid: input.acting.actingUid,
      actionType: input.actionType,
      actionLabel: input.actionLabel,
    });
    return { allowed: false as const, actionRequestId: createdId };
  }

  await consumeApprovedActionRequest({
    actionRequestId,
    requesterUid: input.acting.requesterUid,
    targetUid: input.acting.actingUid,
    actionType: input.actionType,
  });

  return { allowed: true as const };
}

