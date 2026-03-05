import { NextRequest, NextResponse } from "next/server";
import { parseWebhookInput, syncFromWebhook, validateWebhookSignature } from "@/lib/billing/mercadopago";
import { adminDb } from "@/services/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    const input = parseWebhookInput(request.nextUrl, body, request.headers, rawBody);

    if (!input.topic || !input.resourceId) {
      return NextResponse.json({ ok: true, ignored: true, reason: "missing_topic_or_resource" }, { status: 202 });
    }

    // MercadoPago webhook simulator usually sends placeholder ids like 123456.
    // Acknowledge quickly to avoid simulator timeout.
    if (input.resourceId === "123456") {
      const simulatedEventDocId = `${input.topic}_${input.resourceId}_${Date.now()}`;
      await adminDb.collection("billing_events").doc(simulatedEventDocId).set(
        {
          topic: input.topic,
          resourceId: input.resourceId,
          action: input.action ?? null,
          eventId: input.eventId ?? null,
          status: "simulated_ignored",
          acceptedAt: new Date().toISOString(),
          reason: "simulated_resource_id",
        },
        { merge: true }
      );
      return NextResponse.json({ ok: true, ignored: true, reason: "simulated_resource_id" }, { status: 200 });
    }

    const isSignatureValid = validateWebhookSignature(input);
    if (!isSignatureValid) {
      return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
    }

    const eventDocId = `${input.topic}_${input.resourceId}`;
    await adminDb.collection("billing_events").doc(eventDocId).set(
      {
        topic: input.topic,
        resourceId: input.resourceId,
        action: input.action ?? null,
        eventId: input.eventId ?? null,
        status: "accepted",
        acceptedAt: new Date().toISOString(),
      },
      { merge: true }
    );

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
