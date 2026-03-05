import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/services/firebase/admin";
import { UserPaymentStatus, UserPlan, UserRole, UserStatus } from "@/types/user";

type MercadoPagoTopic = "payment" | "merchant_order" | "preapproval";

type WebhookInput = {
  topic: MercadoPagoTopic | null;
  resourceId: string | null;
  action: string | null;
  eventId: string | null;
  signatureHeader: string | null;
  requestIdHeader: string | null;
  rawBody: string;
};

type GatewayDetails = {
  topic: MercadoPagoTopic;
  gatewayStatus: string;
  gatewayStatusDetail?: string;
  paymentId?: string;
  preapprovalId?: string;
  merchantOrderId?: string;
  externalReference?: string;
  payerEmail?: string;
  plan?: UserPlan;
};

type UserMatch = {
  uid: string;
  userData: Record<string, unknown>;
  matchedBy: "external_reference" | "email";
};

const MERCADO_PAGO_API_BASE = "https://api.mercadopago.com";

const PLAN_BY_PREAPPROVAL_ID: Record<string, UserPlan> = {
  [process.env.MERCADOPAGO_PLAN_PRO_ID ?? ""]: "pro",
  [process.env.MERCADOPAGO_PLAN_PREMIUM_ID ?? ""]: "premium",
};

function assertToken() {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    throw new Error("Missing MERCADOPAGO_ACCESS_TOKEN");
  }
}

function parseExternalReference(reference: string | undefined): { uid?: string; plan?: UserPlan } {
  if (!reference) return {};

  const parts = reference.split("|").map((item) => item.trim());
  const out: { uid?: string; plan?: UserPlan } = {};

  for (const part of parts) {
    const [key, value] = part.split(":");
    if (!key || !value) continue;

    if (key === "uid") out.uid = value;
    if (key === "plan" && (value === "free" || value === "pro" || value === "premium")) {
      out.plan = value;
    }
  }

  if (!out.uid && !reference.includes(":")) {
    out.uid = reference;
  }

  return out;
}

function mapPaymentStatus(gatewayStatus: string): UserPaymentStatus {
  const status = gatewayStatus.toLowerCase();
  if (status === "approved" || status === "authorized") return "paid";
  if (status === "pending" || status === "in_process" || status === "in_mediation") return "pending";
  if (status === "cancelled" || status === "cancelled_by_user" || status === "charged_back") return "canceled";
  if (status === "rejected" || status === "refunded") return "not_paid";
  if (status === "paused") return "overdue";
  return "pending";
}

const PAYMENT_BLOCK_REASON_REGEX = /(pagamento|inadimpl|assinatura|cancelamento|cobranca)/i;

function isPaymentRelatedBlockReason(reason: unknown): boolean {
  if (typeof reason !== "string") return false;
  return PAYMENT_BLOCK_REASON_REGEX.test(reason.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
}

function getBlockReasonFromPaymentStatus(status: UserPaymentStatus): string {
  if (status === "overdue" || status === "not_paid") return "Falta de Pagamento";
  if (status === "canceled") return "Cancelamento de Assinatura";
  return "";
}

async function mpRequest(path: string): Promise<Record<string, unknown>> {
  assertToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const response = await fetch(`${MERCADO_PAGO_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`MercadoPago request failed (${response.status}): ${body}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

function parseTopic(value: string | null | undefined): MercadoPagoTopic | null {
  if (!value) return null;
  if (value === "payment" || value === "merchant_order" || value === "preapproval") {
    return value;
  }
  if (value.startsWith("payment")) return "payment";
  if (value.startsWith("merchant_order")) return "merchant_order";
  if (value.startsWith("subscription_") || value.includes("preapproval")) return "preapproval";
  return null;
}

function extractTopicFromAction(action: string | null | undefined): MercadoPagoTopic | null {
  if (!action) return null;
  if (action.startsWith("payment.")) return "payment";
  if (action.startsWith("merchant_order.")) return "merchant_order";
  if (action.startsWith("subscription_") || action.startsWith("preapproval.")) return "preapproval";
  return null;
}

export function parseWebhookInput(url: URL, body: Record<string, unknown>, headers: Headers, rawBody: string): WebhookInput {
  const queryTopic = parseTopic(url.searchParams.get("topic") || url.searchParams.get("type"));
  const bodyTopic = parseTopic(typeof body.type === "string" ? body.type : null);
  const entityTopic = parseTopic(typeof body.entity === "string" ? body.entity : null);
  const action = typeof body.action === "string" ? body.action : url.searchParams.get("action");
  const actionTopic = extractTopicFromAction(action);

  const resourceId =
    (typeof body.data === "object" &&
      body.data !== null &&
      typeof (body.data as { id?: unknown }).id === "string" &&
      (body.data as { id: string }).id) ||
    (typeof body.data === "object" &&
      body.data !== null &&
      typeof (body.data as { id?: unknown }).id === "number" &&
      String((body.data as { id: number }).id)) ||
    url.searchParams.get("data.id");

  const eventId =
    (typeof body.id === "number" ? String(body.id) : null) ||
    (typeof body.id === "string" ? body.id : null);

  return {
    topic: queryTopic || bodyTopic || entityTopic || actionTopic,
    resourceId,
    action,
    eventId,
    signatureHeader: headers.get("x-signature"),
    requestIdHeader: headers.get("x-request-id"),
    rawBody,
  };
}

export function getBillingEventDocId(input: WebhookInput): string {
  if (input.eventId) return `${input.topic}_${input.resourceId}_${input.eventId}`;
  return `${input.topic}_${input.resourceId}`;
}

export function validateWebhookSignature(input: WebhookInput) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return true;

  if (!input.signatureHeader || !input.requestIdHeader || !input.resourceId) {
    return false;
  }

  const parts = Object.fromEntries(
    input.signatureHeader
      .split(",")
      .map((item) => item.trim())
      .map((item) => item.split("=") as [string, string])
  );

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${input.resourceId};request-id:${input.requestIdHeader};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return expected === v1;
}

async function fetchGatewayDetails(topic: MercadoPagoTopic, resourceId: string): Promise<GatewayDetails> {
  if (topic === "payment") {
    const payload = await mpRequest(`/v1/payments/${resourceId}`);
    const externalReference = typeof payload.external_reference === "string" ? payload.external_reference : undefined;
    const metadata = (payload.metadata ?? {}) as Record<string, unknown>;
    const parsedReference = parseExternalReference(externalReference);
    const parsedMetadataPlan =
      metadata.plan === "free" || metadata.plan === "pro" || metadata.plan === "premium"
        ? (metadata.plan as UserPlan)
        : undefined;

    return {
      topic,
      gatewayStatus: String(payload.status ?? "pending"),
      gatewayStatusDetail: typeof payload.status_detail === "string" ? payload.status_detail : undefined,
      paymentId: String(payload.id ?? resourceId),
      externalReference,
      payerEmail:
        typeof payload.payer === "object" &&
        payload.payer !== null &&
        typeof (payload.payer as { email?: unknown }).email === "string"
          ? ((payload.payer as { email: string }).email ?? undefined)
          : undefined,
      plan: parsedReference.plan ?? parsedMetadataPlan,
    };
  }

  if (topic === "preapproval") {
    const payload = await mpRequest(`/preapproval/${resourceId}`);
    const externalReference = typeof payload.external_reference === "string" ? payload.external_reference : undefined;
    const preapprovalPlanId =
      typeof payload.preapproval_plan_id === "string" ? payload.preapproval_plan_id : "";
    const mappedPlan = PLAN_BY_PREAPPROVAL_ID[preapprovalPlanId];
    const parsedReference = parseExternalReference(externalReference);

    return {
      topic,
      gatewayStatus: String(payload.status ?? "pending"),
      gatewayStatusDetail: typeof payload.reason === "string" ? payload.reason : undefined,
      preapprovalId: String(payload.id ?? resourceId),
      externalReference,
      payerEmail: typeof payload.payer_email === "string" ? payload.payer_email : undefined,
      plan: parsedReference.plan ?? mappedPlan,
    };
  }

  const payload = await mpRequest(`/merchant_orders/${resourceId}`);
  const externalReference = typeof payload.external_reference === "string" ? payload.external_reference : undefined;
  const parsedReference = parseExternalReference(externalReference);
  return {
    topic,
    gatewayStatus: String(payload.status ?? "opened"),
    merchantOrderId: String(payload.id ?? resourceId),
    externalReference,
    payerEmail:
      typeof payload.payer === "object" &&
      payload.payer !== null &&
      typeof (payload.payer as { email?: unknown }).email === "string"
        ? ((payload.payer as { email: string }).email ?? undefined)
        : undefined,
    plan: parsedReference.plan,
  };
}

async function findUserByWebhook(details: GatewayDetails): Promise<UserMatch | null> {
  const parsedReference = parseExternalReference(details.externalReference);

  if (parsedReference.uid) {
    const userRef = adminDb.collection("users").doc(parsedReference.uid);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      return {
        uid: userSnap.id,
        userData: userSnap.data() ?? {},
        matchedBy: "external_reference",
      };
    }
  }

  if (details.payerEmail) {
    const userQuery = await adminDb
      .collection("users")
      .where("email", "==", details.payerEmail.toLowerCase())
      .limit(1)
      .get();

    if (!userQuery.empty) {
      const doc = userQuery.docs[0];
      return {
        uid: doc.id,
        userData: doc.data(),
        matchedBy: "email",
      };
    }
  }

  return null;
}

function resolvePlan(details: GatewayDetails, currentPlan: UserPlan): UserPlan {
  if (details.plan) return details.plan;
  return currentPlan;
}

function computeTargetPlan(currentPlan: UserPlan, paymentStatus: UserPaymentStatus, gatewayPlan: UserPlan): UserPlan {
  if (paymentStatus === "paid") return gatewayPlan;
  if (paymentStatus === "canceled" || paymentStatus === "not_paid" || paymentStatus === "overdue") return "free";
  return currentPlan;
}

export async function syncFromWebhook(input: WebhookInput) {
  if (!input.topic || !input.resourceId) {
    throw new Error("Webhook payload missing topic/resource");
  }

  const details = await fetchGatewayDetails(input.topic, input.resourceId);
  const userMatch = await findUserByWebhook(details);

  const eventDocId = getBillingEventDocId(input);
  const baseEvent = {
    topic: input.topic,
    action: input.action ?? null,
    eventId: input.eventId,
    resourceId: input.resourceId,
    receivedAt: FieldValue.serverTimestamp(),
    details,
  };

  if (!userMatch) {
    await adminDb.collection("billing_events").doc(eventDocId).set(
      {
        ...baseEvent,
        status: "ignored_no_user_match",
      },
      { merge: true }
    );

    return {
      ok: true,
      matched: false,
      reason: "user_not_found",
    };
  }

  const currentPlan = (userMatch.userData.plan as UserPlan) || "free";
  const currentRole = (userMatch.userData.role as UserRole) || "client";
  const currentStatus = (userMatch.userData.status as UserStatus) || "active";
  const currentBlockReason = userMatch.userData.blockReason;
  const isBillingExemptRole = currentRole === "admin" || currentRole === "moderator";
  const paymentStatus = mapPaymentStatus(details.gatewayStatus);
  const gatewayPlan = resolvePlan(details, currentPlan);
  const targetPlan = isBillingExemptRole
    ? currentPlan
    : computeTargetPlan(currentPlan, paymentStatus, gatewayPlan);
  const targetPaymentStatus: UserPaymentStatus = isBillingExemptRole ? "free" : paymentStatus;
  const nowIso = new Date().toISOString();
  const statusPatch: Partial<{ status: UserStatus; blockReason: string }> = {};

  if (!isBillingExemptRole && currentStatus !== "deleted") {
    if (targetPaymentStatus === "paid") {
      if (
        (currentStatus === "blocked" || currentStatus === "inactive") &&
        (isPaymentRelatedBlockReason(currentBlockReason) || !currentBlockReason)
      ) {
        statusPatch.status = "active";
        statusPatch.blockReason = "";
      }
    }

    if (targetPaymentStatus === "overdue" || targetPaymentStatus === "not_paid" || targetPaymentStatus === "canceled") {
      if (currentStatus === "active") {
        statusPatch.status = "blocked";
        statusPatch.blockReason = getBlockReasonFromPaymentStatus(targetPaymentStatus);
      }
    }
  }

  await adminDb.collection("users").doc(userMatch.uid).set(
    {
      plan: targetPlan,
      paymentStatus: targetPaymentStatus,
      ...statusPatch,
      billing: {
        source: "mercadopago_webhook",
        provider: "mercadopago",
        gatewayStatus: details.gatewayStatus,
        gatewayStatusDetail: details.gatewayStatusDetail ?? null,
        gatewayPlan,
        externalReference: details.externalReference ?? null,
        paymentId: details.paymentId ?? null,
        preapprovalId: details.preapprovalId ?? null,
        merchantOrderId: details.merchantOrderId ?? null,
        lastEventType: input.topic,
        lastEventAction: input.action ?? null,
        lastEventId: input.eventId ?? null,
        lastEventAt: nowIso,
        lastSyncAt: nowIso,
        lastError: null,
      },
    },
    { merge: true }
  );

  await adminDb.collection("billing_events").doc(eventDocId).set(
    {
      ...baseEvent,
      status: "processed",
      matchedBy: userMatch.matchedBy,
      uid: userMatch.uid,
      targetPlan,
      targetPaymentStatus,
      statusPatch,
    },
    { merge: true }
  );

  return {
    ok: true,
    matched: true,
    uid: userMatch.uid,
    targetPlan,
    targetPaymentStatus,
  };
}

export function buildCheckoutUrl(baseUrl: string, opts: { uid: string; plan: UserPlan; email?: string }) {
  const url = new URL(baseUrl);
  url.searchParams.set("external_reference", `uid:${opts.uid}|plan:${opts.plan}`);
  url.searchParams.set("client_reference_id", opts.uid);
  if (opts.email) {
    url.searchParams.set("payer_email", opts.email);
  }
  return url.toString();
}
