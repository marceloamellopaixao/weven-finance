import { NextRequest, NextResponse } from "next/server";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import {
  enforceCreditCardPolicy,
  saveCreditCardSettings,
} from "@/lib/credit-card/limit";
import { CreditCardSettings } from "@/types/creditCard";
import { resolveApiErrorStatus } from "@/lib/api/error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { actingUid } = await resolveActingContext(request);
    const { settings, summary } = await enforceCreditCardPolicy(actingUid);
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

    const body = (await request.json()) as Partial<CreditCardSettings>;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const settings = await saveCreditCardSettings(acting.actingUid, body);
    const { summary } = await enforceCreditCardPolicy(acting.actingUid);
    return NextResponse.json({ ok: true, settings, summary }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
