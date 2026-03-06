import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/services/firebase/admin";
import {
  buildApprovedRequestPatch,
  buildRejectedRequestPatch,
  canManageImpersonation,
  createSupportAccessLog,
  getAuthContextFromRequest,
  type ImpersonationActionRequestDoc,
  type SupportAccessRequestDoc,
} from "@/lib/impersonation/server";
import { UserRole } from "@/types/user";

function toUserRole(value: unknown): UserRole {
  if (value === "admin" || value === "moderator" || value === "support" || value === "client") {
    return value;
  }
  return "client";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContextFromRequest(request);
    const mode = request.nextUrl.searchParams.get("mode") || "pending";

    if (mode === "pending") {
      const snapshot = await adminDb
        .collection("support_access_requests")
        .where("targetUid", "==", auth.uid)
        .get();

      const requests = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as SupportAccessRequestDoc) }))
        .filter((item) => item.status === "pending")
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

      return NextResponse.json({ ok: true, requests }, { status: 200 });
    }

    if (mode === "mine") {
      if (!canManageImpersonation(auth.role)) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      const targetUid = request.nextUrl.searchParams.get("targetUid")?.trim();
      let query = adminDb.collection("support_access_requests").where("requesterUid", "==", auth.uid);
      if (targetUid) {
        query = query.where("targetUid", "==", targetUid);
      }

      const snapshot = await query.get();
      const requests = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as SupportAccessRequestDoc) }))
        .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));

      return NextResponse.json({ ok: true, requests }, { status: 200 });
    }

    if (mode === "status") {
      if (!canManageImpersonation(auth.role)) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      const targetUid = request.nextUrl.searchParams.get("targetUid")?.trim();
      if (!targetUid) {
        return NextResponse.json({ ok: false, error: "missing_target_uid" }, { status: 400 });
      }

      const snapshot = await adminDb
        .collection("support_access_requests")
        .where("requesterUid", "==", auth.uid)
        .get();

      const latest = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as SupportAccessRequestDoc) }))
        .filter((item) => item.targetUid === targetUid)
        .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))[0];

      const nowIso = new Date().toISOString();
      const approved = !!latest && latest.status === "approved" && latest.permissionImpersonate === true && (!latest.expiresAt || latest.expiresAt > nowIso);

      return NextResponse.json({
        ok: true,
        approved,
        request: latest || null,
      }, { status: 200 });
    }

    if (mode === "pending-actions") {
      const snapshot = await adminDb
        .collection("impersonation_action_requests")
        .where("targetUid", "==", auth.uid)
        .get();

      const requests = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as ImpersonationActionRequestDoc) }))
        .filter((item) => item.status === "pending")
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

      return NextResponse.json({ ok: true, requests }, { status: 200 });
    }

    if (mode === "action-status") {
      if (!canManageImpersonation(auth.role)) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      const actionRequestId = request.nextUrl.searchParams.get("actionRequestId")?.trim();
      if (!actionRequestId) {
        return NextResponse.json({ ok: false, error: "missing_action_request_id" }, { status: 400 });
      }

      const actionSnap = await adminDb.collection("impersonation_action_requests").doc(actionRequestId).get();
      if (!actionSnap.exists) {
        return NextResponse.json({ ok: false, error: "action_request_not_found" }, { status: 404 });
      }
      const action = actionSnap.data() as ImpersonationActionRequestDoc;
      if (action.requesterUid !== auth.uid) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }

      return NextResponse.json({ ok: true, request: { id: actionSnap.id, ...action } }, { status: 200 });
    }

    return NextResponse.json({ ok: false, error: "invalid_mode" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContextFromRequest(request);
    const body = (await request.json()) as
      | { action: "request"; targetUid?: string }
      | { action: "respond"; requestId?: string; approved?: boolean }
      | { action: "respond-action"; actionRequestId?: string; approved?: boolean };

    if (body.action === "request") {
      if (!canManageImpersonation(auth.role)) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      const targetUid = body.targetUid?.trim();
      if (!targetUid) {
        return NextResponse.json({ ok: false, error: "missing_target_uid" }, { status: 400 });
      }
      if (targetUid === auth.uid) {
        return NextResponse.json({ ok: false, error: "cannot_impersonate_self" }, { status: 400 });
      }

      const targetSnap = await adminDb.collection("users").doc(targetUid).get();
      if (!targetSnap.exists) {
        return NextResponse.json({ ok: false, error: "target_not_found" }, { status: 404 });
      }
      const targetData = targetSnap.data() as Record<string, unknown>;

      const existingPendingSnapshot = await adminDb
        .collection("support_access_requests")
        .where("requesterUid", "==", auth.uid)
        .get();

      const existingPending = existingPendingSnapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as SupportAccessRequestDoc) }))
        .find((item) => item.targetUid === targetUid && item.status === "pending");

      if (existingPending) {
        return NextResponse.json({
          ok: true,
          requestId: existingPending.id,
          status: "pending",
          alreadyPending: true,
        }, { status: 200 });
      }

      const nowIso = new Date().toISOString();
      const requestRef = await adminDb.collection("support_access_requests").add({
        requesterUid: auth.uid,
        requesterDisplayName: auth.displayName,
        requesterEmail: auth.email,
        requesterRole: auth.role,
        targetUid,
        targetDisplayName: String(targetData.displayName || "Usuário"),
        targetEmail: String(targetData.email || ""),
        targetRole: toUserRole(targetData.role),
        status: "pending",
        permissionImpersonate: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        handledAt: null,
        expiresAt: null,
      } satisfies SupportAccessRequestDoc);

      return NextResponse.json({ ok: true, requestId: requestRef.id, status: "pending" }, { status: 200 });
    }

    if (body.action === "respond") {
      const requestId = body.requestId?.trim();
      if (!requestId || typeof body.approved !== "boolean") {
        return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
      }

      const requestRef = adminDb.collection("support_access_requests").doc(requestId);
      const requestSnap = await requestRef.get();
      if (!requestSnap.exists) {
        return NextResponse.json({ ok: false, error: "request_not_found" }, { status: 404 });
      }

      const requestData = requestSnap.data() as SupportAccessRequestDoc;
      if (requestData.targetUid !== auth.uid) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      if (requestData.status !== "pending") {
        return NextResponse.json({ ok: false, error: "request_already_handled" }, { status: 409 });
      }

      const patch = body.approved ? buildApprovedRequestPatch() : buildRejectedRequestPatch();
      await requestRef.set(patch, { merge: true });

      await createSupportAccessLog({
        idUser: requestData.targetUid,
        userDisplayName: requestData.targetDisplayName,
        userEmail: requestData.targetEmail,
        userRole: requestData.targetRole,
        idUserImpersonate: requestData.requesterUid,
        userDisplayNameImpersonate: requestData.requesterDisplayName,
        userEmailImpersonate: requestData.requesterEmail,
        userRoleImpersonate: requestData.requesterRole,
        permissionImpersonate: body.approved,
        requestId,
      });

      return NextResponse.json({
        ok: true,
        requestId,
        status: body.approved ? "approved" : "rejected",
      }, { status: 200 });
    }

    if (body.action === "respond-action") {
      const actionRequestId = body.actionRequestId?.trim();
      if (!actionRequestId || typeof body.approved !== "boolean") {
        return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
      }

      const actionRef = adminDb.collection("impersonation_action_requests").doc(actionRequestId);
      const actionSnap = await actionRef.get();
      if (!actionSnap.exists) {
        return NextResponse.json({ ok: false, error: "action_request_not_found" }, { status: 404 });
      }
      const actionData = actionSnap.data() as ImpersonationActionRequestDoc;
      if (actionData.targetUid !== auth.uid) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      if (actionData.status !== "pending") {
        return NextResponse.json({ ok: false, error: "request_already_handled" }, { status: 409 });
      }

      const now = new Date();
      const patch = body.approved
        ? {
            status: "approved",
            permissionImpersonate: true,
            updatedAt: now.toISOString(),
            handledAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
          }
        : {
            status: "rejected",
            permissionImpersonate: false,
            updatedAt: now.toISOString(),
            handledAt: now.toISOString(),
            expiresAt: null,
          };

      await actionRef.set(patch, { merge: true });
      await createSupportAccessLog({
        idUser: actionData.targetUid,
        userDisplayName: actionData.targetDisplayName,
        userEmail: actionData.targetEmail,
        userRole: actionData.targetRole,
        idUserImpersonate: actionData.requesterUid,
        userDisplayNameImpersonate: actionData.requesterDisplayName,
        userEmailImpersonate: actionData.requesterEmail,
        userRoleImpersonate: actionData.requesterRole,
        permissionImpersonate: body.approved,
        requestId: actionRequestId,
      });

      return NextResponse.json({
        ok: true,
        actionRequestId,
        status: body.approved ? "approved" : "rejected",
      }, { status: 200 });
    }

    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
