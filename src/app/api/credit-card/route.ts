import { NextRequest, NextResponse } from "next/server";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import {
  enforceCreditCardPolicy,
  saveCreditCardSettings,
} from "@/lib/credit-card/limit";
import { CreditCardSettings } from "@/types/creditCard";
import { resolveApiErrorStatus } from "@/lib/api/error";
import { resolveActiveWorkspaceContext } from "@/lib/workspaces/server";
import { canManageFamilyCardSettings } from "@/lib/workspaces/family";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { actingUid } = await resolveActingContext(request);
    const workspaceContext = await resolveActiveWorkspaceContext(actingUid, request.nextUrl.searchParams.get("workspaceId"));
    const { settings, summary } = await enforceCreditCardPolicy(workspaceContext.ownerUid, workspaceContext.workspaceId, workspaceContext.includeLegacyRows);
    return NextResponse.json({ ok: true, settings, summary }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const acting = await resolveActingContext(request);
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "credit-card:update-settings",
      actionLabel: "Atualizar configurações de cartão de crédito",
    });
    if (!approval.allowed) {
      return NextResponse.json(
        { ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId },
        { status: 409 }
      );
    }

    const body = (await request.json()) as Partial<CreditCardSettings> & { workspaceId?: string };
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const workspaceContext = await resolveActiveWorkspaceContext(acting.actingUid, body.workspaceId);
    if (!canManageFamilyCardSettings(workspaceContext.member)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    const settings = await saveCreditCardSettings(workspaceContext.ownerUid, body, workspaceContext.workspaceId, workspaceContext.includeLegacyRows);
    const { summary } = await enforceCreditCardPolicy(workspaceContext.ownerUid, workspaceContext.workspaceId, workspaceContext.includeLegacyRows);
    return NextResponse.json({ ok: true, settings, summary }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
