import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/services/firebase/admin";
import { UserRole } from "@/types/user";

export type ImpersonationRequestStatus = "pending" | "approved" | "rejected" | "revoked" | "expired";

export type AuthContext = {
  uid: string;
  role: UserRole;
  displayName: string;
  email: string;
};

export type ActingContext = {
  requesterUid: string;
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

async function getUserProfileSummary(uid: string) {
  const snap = await adminDb.collection("users").doc(uid).get();
  if (!snap.exists) throw new Error("user_not_found");
  const data = snap.data() as Record<string, unknown>;
  return {
    uid,
    displayName: String(data.displayName || "Usuario"),
    email: String(data.email || ""),
    role: toUserRole(data.role),
  };
}

function addHours(date: Date, hours: number): Date {
  const copy = new Date(date);
  copy.setHours(copy.getHours() + hours);
  return copy;
}

export async function getAuthContextFromRequest(request: NextRequest): Promise<AuthContext> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) throw new Error("missing_auth_token");

  const decoded = await adminAuth.verifyIdToken(token);
  const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
  if (!userSnap.exists) throw new Error("user_not_found");

  const data = userSnap.data() as Record<string, unknown>;
  return {
    uid: decoded.uid,
    role: toUserRole(data.role),
    displayName: String(data.displayName || decoded.name || "Usuario"),
    email: String(data.email || decoded.email || ""),
  };
}

export async function resolveActingContext(request: NextRequest): Promise<ActingContext> {
  const auth = await getAuthContextFromRequest(request);
  const targetUid = request.headers.get("x-impersonate-uid")?.trim();

  if (!targetUid || targetUid === auth.uid) {
    return {
      requesterUid: auth.uid,
      requesterRole: auth.role,
      actingUid: auth.uid,
      isImpersonating: false,
    };
  }

  if (!canManageImpersonation(auth.role)) {
    throw new Error("impersonation_forbidden_role");
  }

  const requestSnapshot = await adminDb
    .collection("support_access_requests")
    .where("requesterUid", "==", auth.uid)
    .get();

  if (requestSnapshot.empty) {
    throw new Error("impersonation_not_allowed");
  }

  const nowIso = getIsoNow();
  const validDoc = requestSnapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as SupportAccessRequestDoc) }))
    .filter((item) =>
      item.targetUid === targetUid &&
      item.status === "approved" &&
      item.permissionImpersonate === true
    )
    .sort((a, b) => String(b.handledAt || b.updatedAt || b.createdAt).localeCompare(String(a.handledAt || a.updatedAt || a.createdAt)))
    .find((item) => !item.expiresAt || item.expiresAt > nowIso);

  if (!validDoc) {
    throw new Error("impersonation_expired");
  }

  return {
    requesterUid: auth.uid,
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
  await adminDb.collection("log_acesso_suporte").add({
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
  });
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
  requesterRole: UserRole;
  targetUid: string;
  actionType: string;
  actionLabel: string;
}) {
  const existingSnapshot = await adminDb
    .collection("impersonation_action_requests")
    .where("requesterUid", "==", input.requesterUid)
    .get();

  const existing = existingSnapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as ImpersonationActionRequestDoc) }))
    .find((item) =>
      item.targetUid === input.targetUid &&
      item.actionType === input.actionType &&
      item.status === "pending"
    );

  if (existing) {
    return existing.id;
  }

  const [requester, target] = await Promise.all([
    getUserProfileSummary(input.requesterUid),
    getUserProfileSummary(input.targetUid),
  ]);

  const nowIso = getIsoNow();
  const requestRef = await adminDb.collection("impersonation_action_requests").add({
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
  } satisfies ImpersonationActionRequestDoc);

  return requestRef.id;
}

async function consumeApprovedActionRequest(input: {
  actionRequestId: string;
  requesterUid: string;
  targetUid: string;
  actionType: string;
}) {
  const ref = adminDb.collection("impersonation_action_requests").doc(input.actionRequestId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("impersonation_action_not_found");

  const data = snap.data() as ImpersonationActionRequestDoc;
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

  await ref.set(
    {
      status: "consumed",
      updatedAt: nowIso,
      consumedAt: nowIso,
    },
    { merge: true }
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
