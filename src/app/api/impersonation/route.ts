import { NextRequest, NextResponse } from "next/server";
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
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";

function toUserRole(value: unknown): UserRole {
  if (value === "admin" || value === "moderator" || value === "support" || value === "client") {
    return value;
  }
  return "client";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapAccessRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => ({
    id: String(row.id || ""),
    ...(((row.raw as SupportAccessRequestDoc | null) ?? {}) as SupportAccessRequestDoc),
  }));
}

function mapActionRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => ({
    id: String(row.id || ""),
    ...(((row.raw as ImpersonationActionRequestDoc | null) ?? {}) as ImpersonationActionRequestDoc),
  }));
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContextFromRequest(request);
    const mode = request.nextUrl.searchParams.get("mode") || "pending";

    if (mode === "pending") {
      const rows = await supabaseSelect("support_access_requests", {
        filters: { target_uid: auth.uid },
      });
      const requests = mapAccessRows(rows)
        .filter((item) => item.status === "pending")
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

      return NextResponse.json({ ok: true, requests }, { status: 200 });
    }

    if (mode === "mine") {
      if (!canManageImpersonation(auth.role)) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      const targetUid = request.nextUrl.searchParams.get("targetUid")?.trim();
      const rows = await supabaseSelect("support_access_requests", {
        filters: { requester_uid: auth.uid },
      });

      const requests = mapAccessRows(rows)
        .filter((item) => (targetUid ? item.targetUid === targetUid : true))
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

      const rows = await supabaseSelect("support_access_requests", {
        filters: { requester_uid: auth.uid },
      });

      const latest = mapAccessRows(rows)
        .filter((item) => item.targetUid === targetUid)
        .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))[0];

      const nowIso = new Date().toISOString();
      const approved =
        !!latest &&
        latest.status === "approved" &&
        latest.permissionImpersonate === true &&
        (!latest.expiresAt || latest.expiresAt > nowIso);

      return NextResponse.json(
        {
          ok: true,
          approved,
          request: latest || null,
        },
        { status: 200 }
      );
    }

    if (mode === "pending-actions") {
      const rows = await supabaseSelect("impersonation_action_requests", {
        filters: { target_uid: auth.uid },
      });

      const requests = mapActionRows(rows)
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

      const rows = await supabaseSelect("impersonation_action_requests", {
        filters: { id: actionRequestId },
        limit: 1,
      });
      if (rows.length === 0) {
        return NextResponse.json({ ok: false, error: "action_request_not_found" }, { status: 404 });
      }

      const action = ((rows[0].raw as ImpersonationActionRequestDoc | null) ?? null);
      if (!action) {
        return NextResponse.json({ ok: false, error: "action_request_not_found" }, { status: 404 });
      }
      if (action.requesterUid !== auth.uid) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }

      return NextResponse.json({ ok: true, request: { id: String(rows[0]?.id || actionRequestId), ...action } }, { status: 200 });
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

      const targetRows = await supabaseSelect("profiles", {
        filters: { uid: targetUid },
        limit: 1,
      });
      if (targetRows.length === 0) {
        return NextResponse.json({ ok: false, error: "target_not_found" }, { status: 404 });
      }
      const targetRaw = (targetRows[0].raw as Record<string, unknown> | null) ?? {};

      const existingRows = await supabaseSelect("support_access_requests", {
        filters: { requester_uid: auth.uid },
      });

      const existingPending = mapAccessRows(existingRows).find(
        (item) => item.targetUid === targetUid && item.status === "pending"
      );

      if (existingPending) {
        return NextResponse.json(
          {
            ok: true,
            requestId: existingPending.id,
            status: "pending",
            alreadyPending: true,
          },
          { status: 200 }
        );
      }

      const nowIso = new Date().toISOString();
      const requestId = crypto.randomUUID();
      const raw: SupportAccessRequestDoc = {
        requesterUid: auth.uid,
        requesterDisplayName: auth.displayName,
        requesterEmail: auth.email,
        requesterRole: auth.role,
        targetUid,
        targetDisplayName: String(targetRows[0].display_name || targetRaw.displayName || "Usuario"),
        targetEmail: String(targetRows[0].email || targetRaw.email || ""),
        targetRole: toUserRole(targetRows[0].role || targetRaw.role),
        status: "pending",
        permissionImpersonate: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        handledAt: null,
        expiresAt: null,
      };

      await supabaseUpsertRows("support_access_requests", [
        {
          id: requestId,
          requester_uid: auth.uid,
          target_uid: targetUid,
          request_status: "pending",
          permission_impersonate: null,
          raw,
          created_at: nowIso,
          updated_at: nowIso,
        },
      ]);

      return NextResponse.json({ ok: true, requestId, status: "pending" }, { status: 200 });
    }

    if (body.action === "respond") {
      const requestId = body.requestId?.trim();
      if (!requestId || typeof body.approved !== "boolean") {
        return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
      }

      const rows = await supabaseSelect("support_access_requests", {
        filters: { id: requestId },
        limit: 1,
      });
      if (rows.length === 0) {
        return NextResponse.json({ ok: false, error: "request_not_found" }, { status: 404 });
      }

      const requestData = ((rows[0].raw as SupportAccessRequestDoc | null) ?? null);
      if (!requestData) {
        return NextResponse.json({ ok: false, error: "request_not_found" }, { status: 404 });
      }
      if (requestData.targetUid !== auth.uid) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      if (requestData.status !== "pending") {
        return NextResponse.json({ ok: false, error: "request_already_handled" }, { status: 409 });
      }

      const patch = body.approved ? buildApprovedRequestPatch() : buildRejectedRequestPatch();
      const raw = { ...requestData, ...patch };

      await supabaseUpsertRows(
        "support_access_requests",
        [
          {
            id: requestId,
            requester_uid: requestData.requesterUid,
            target_uid: requestData.targetUid,
            request_status: raw.status,
            permission_impersonate: raw.permissionImpersonate,
            raw,
            updated_at: raw.updatedAt,
          },
        ],
        { onConflict: "id" }
      );

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

      return NextResponse.json(
        {
          ok: true,
          requestId,
          status: body.approved ? "approved" : "rejected",
        },
        { status: 200 }
      );
    }

    if (body.action === "respond-action") {
      const actionRequestId = body.actionRequestId?.trim();
      if (!actionRequestId || typeof body.approved !== "boolean") {
        return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
      }

      const rows = await supabaseSelect("impersonation_action_requests", {
        filters: { id: actionRequestId },
        limit: 1,
      });
      if (rows.length === 0) {
        return NextResponse.json({ ok: false, error: "action_request_not_found" }, { status: 404 });
      }

      const actionData = ((rows[0].raw as ImpersonationActionRequestDoc | null) ?? null);
      if (!actionData) {
        return NextResponse.json({ ok: false, error: "action_request_not_found" }, { status: 404 });
      }
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

      const raw = { ...actionData, ...patch };
      await supabaseUpsertRows(
        "impersonation_action_requests",
        [
          {
            id: actionRequestId,
            requester_uid: actionData.requesterUid,
            target_uid: actionData.targetUid,
            action_type: actionData.actionType,
            action_status: raw.status,
            raw,
            updated_at: raw.updatedAt,
          },
        ],
        { onConflict: "id" }
      );
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

      return NextResponse.json(
        {
          ok: true,
          actionRequestId,
          status: body.approved ? "approved" : "rejected",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

