import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { verifyRequestAuth } from "@/lib/auth/server";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { toWorkspaceInvitation, toWorkspaceMember } from "@/lib/workspaces/server";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
import type { WorkspaceInvitation, WorkspaceMember } from "@/types/workspace";

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
    updatedAt: now,
  };
}

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:workspaces-family-accept:post", max: 20, windowMs: 60_000 });
    if (!rate.allowed) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });

    const auth = await verifyRequestAuth(request);
    const email = normalizeEmail(auth.email);
    const now = new Date().toISOString();

    const invitationRows = await supabaseSelect("workspace_invitations", {
      filters: { invitation_status: "pending" },
      or: `invited_member_uid.eq.${auth.uid}${email ? `,email.eq.${email}` : ""}`,
      limit: 20,
    });

    const acceptedInvitations: WorkspaceInvitation[] = [];
    for (const row of invitationRows) {
      const updatedRow = {
        ...row,
        invited_member_uid: row.invited_member_uid || auth.uid,
        invitation_status: "accepted",
        raw: updateRawStatus(row, "accepted"),
        updated_at: now,
      };
      await supabaseUpsertRows("workspace_invitations", [updatedRow], { onConflict: "id" });
      acceptedInvitations.push(toWorkspaceInvitation(updatedRow));
    }

    const memberRows = await supabaseSelect("workspace_members", {
      filters: { member_uid: auth.uid },
      limit: 50,
    });
    const activatedMembers: WorkspaceMember[] = [];
    for (const row of memberRows) {
      if (row.member_status === "disabled") continue;
      const updatedRow = {
        ...row,
        member_status: "active",
        raw: {
          ...(((row.raw as Record<string, unknown> | null) || {}) as Record<string, unknown>),
          status: "active",
          acceptedAt: now,
          updatedAt: now,
        },
        updated_at: now,
      };
      await supabaseUpsertRows("workspace_members", [updatedRow], { onConflict: "id" });
      activatedMembers.push(toWorkspaceMember(updatedRow));
    }

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
    return NextResponse.json({ ok: true, invitations: acceptedInvitations, members: activatedMembers }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    apiLogger.error({ message: "workspaces_family_accept_failed", requestId: meta.requestId, route: meta.route, method: meta.method, meta: { error: message } });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
