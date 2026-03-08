import { NextRequest, NextResponse } from "next/server";
import { getBillingEventDocId, parseWebhookInput, syncFromWebhook, validateWebhookSignature } from "@/lib/billing/mercadopago";
import { supabaseUpsertRows } from "@/services/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function saveEvent(id: string, payload: Record<string, unknown>) {
  await supabaseUpsertRows(
    "billing_events",
    [
      {
        id,
        uid: typeof payload.uid === "string" ? payload.uid : null,
        event_type: typeof payload.topic === "string" ? payload.topic : null,
        action: typeof payload.action === "string" ? payload.action : null,
        provider: "mercadopago",
        raw: payload,
        created_at: new Date().toISOString(),
      },
    ],
    { onConflict: "id" }
  );
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    const input = parseWebhookInput(request.nextUrl, body, request.headers, rawBody);

    if (!input.topic || !input.resourceId) {
      return NextResponse.json({ ok: true, ignored: true, reason: "missing_topic_or_resource" }, { status: 202 });
    }

    if (input.resourceId === "123456") {
      const simulatedEventDocId = `${input.topic}_${input.resourceId}_${Date.now()}`;
      await saveEvent(simulatedEventDocId, {
        topic: input.topic,
        resourceId: input.resourceId,
        action: input.action ?? null,
        eventId: input.eventId ?? null,
        status: "simulated_ignored",
        acceptedAt: new Date().toISOString(),
        reason: "simulated_resource_id",
      });
      return NextResponse.json({ ok: true, ignored: true, reason: "simulated_resource_id" }, { status: 200 });
    }

    const isSignatureValid = validateWebhookSignature(input);
    if (!isSignatureValid) {
      return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
    }

    const eventDocId = getBillingEventDocId(input);
    await saveEvent(eventDocId, {
      topic: input.topic,
      resourceId: input.resourceId,
      action: input.action ?? null,
      eventId: input.eventId ?? null,
      status: "accepted",
      acceptedAt: new Date().toISOString(),
    });

    const result = await syncFromWebhook(input);
    return NextResponse.json({ ok: true, accepted: true, result }, { status: 200 });
  } catch (error) {
    console.error("MercadoPago webhook error:", error);
    return NextResponse.json(
      {
        ok: true,
        accepted: false,
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 200 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "mercadopago_webhook" }, { status: 200 });
}

