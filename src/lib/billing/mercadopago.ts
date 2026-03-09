import crypto from "node:crypto";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
import { UserPaymentStatus, UserPlan, UserRole, UserStatus } from "@/types/user";
import { pushNotification } from "@/lib/notifications/server";

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
  preapprovalPlanId?: string;
};

type UserMatch = {
  uid: string;
  userData: Record<string, unknown>;
  matchedBy: "external_reference" | "email" | "pending_checkout";
};

type ProfileRow = Record<string, unknown> & {
  uid: string;
};

const MERCADO_PAGO_API_BASE = "https://api.mercadopago.com";

const PLAN_BY_PREAPPROVAL_ID: Record<string, UserPlan> = {
  [process.env.MERCADOPAGO_PLAN_PRO_ID ?? ""]: "pro",
  [process.env.MERCADOPAGO_PLAN_PREMIUM_ID ?? ""]: "premium",
};

async function getProfileRow(uid: string): Promise<ProfileRow | null> {
  const rows = await supabaseSelect("profiles", {
    filters: { uid },
    limit: 1,
  });
  if (rows.length === 0) return null;
  return rows[0] as ProfileRow;
}

function profileToUserData(row: ProfileRow): Record<string, unknown> {
  const raw = (row.raw as Record<string, unknown> | null) ?? {};
  return {
    ...raw,
    uid: row.uid,
    email: row.email ?? raw.email ?? "",
    role: row.role ?? raw.role ?? "client",
    plan: row.plan ?? raw.plan ?? "free",
    status: row.status ?? raw.status ?? "active",
    blockReason: row.block_reason ?? raw.blockReason ?? "",
    paymentStatus: row.payment_status ?? raw.paymentStatus ?? "pending",
    billing: row.billing ?? raw.billing ?? {},
  };
}

async function updateUserProfile(uid: string, patch: Record<string, unknown>) {
  const existing = await getProfileRow(uid);
  const raw = ((existing?.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  const nextRaw = { ...raw };

  if (patch.plan !== undefined) nextRaw.plan = patch.plan;
  if (patch.paymentStatus !== undefined) nextRaw.paymentStatus = patch.paymentStatus;
  if (patch.status !== undefined) nextRaw.status = patch.status;
  if (patch.blockReason !== undefined) nextRaw.blockReason = patch.blockReason;
  if (patch.billing !== undefined) nextRaw.billing = patch.billing;

  await supabaseUpsertRows(
    "profiles",
    [
      {
        uid,
        ...(patch.plan !== undefined ? { plan: patch.plan } : {}),
        ...(patch.paymentStatus !== undefined ? { payment_status: patch.paymentStatus } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.blockReason !== undefined ? { block_reason: patch.blockReason } : {}),
        ...(patch.billing !== undefined ? { billing: patch.billing } : {}),
        raw: nextRaw,
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "uid" }
  );
}

async function writeBillingEvent(eventId: string, payload: Record<string, unknown>) {
  await supabaseUpsertRows(
    "billing_events",
    [
      {
        id: eventId,
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

async function mpPut(path: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  assertToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const response = await fetch(`${MERCADO_PAGO_API_BASE}${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`MercadoPago PUT failed (${response.status}): ${body}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

function parseTopic(value: string | null | undefined): MercadoPagoTopic | null {
  if (!value) return null;
  if (value.includes("authorized_payment")) return "payment";
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
  if (action.includes("authorized_payment")) return "payment";
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
    const preapprovalId =
      typeof payload.preapproval_id === "string"
        ? payload.preapproval_id
        : typeof payload.preapproval_id === "number"
          ? String(payload.preapproval_id)
          : undefined;
    let paymentPlan = parsedReference.plan ?? parsedMetadataPlan;
    let paymentPayerEmail =
      typeof payload.payer === "object" &&
      payload.payer !== null &&
      typeof (payload.payer as { email?: unknown }).email === "string"
        ? ((payload.payer as { email: string }).email ?? undefined)
        : undefined;
    let paymentExternalReference = externalReference;
    let gatewayStatusDetail = typeof payload.status_detail === "string" ? payload.status_detail : undefined;

    if (preapprovalId && (!paymentPlan || !paymentPayerEmail || !paymentExternalReference)) {
      try {
        const preapprovalPayload = await mpRequest(`/preapproval/${preapprovalId}`);
        const preapprovalPlanId =
          typeof preapprovalPayload.preapproval_plan_id === "string" ? preapprovalPayload.preapproval_plan_id : "";
        const mappedPlan = PLAN_BY_PREAPPROVAL_ID[preapprovalPlanId];
        const preapprovalExternalReference =
          typeof preapprovalPayload.external_reference === "string" ? preapprovalPayload.external_reference : undefined;
        const parsedPreapprovalReference = parseExternalReference(preapprovalExternalReference);

        paymentPlan = paymentPlan ?? parsedPreapprovalReference.plan ?? mappedPlan;
        paymentPayerEmail =
          paymentPayerEmail ??
          (typeof preapprovalPayload.payer_email === "string" ? preapprovalPayload.payer_email : undefined);
        paymentExternalReference = paymentExternalReference ?? preapprovalExternalReference;
        gatewayStatusDetail =
          gatewayStatusDetail ??
          (typeof preapprovalPayload.reason === "string" ? preapprovalPayload.reason : undefined);
      } catch {
        // Best effort: keep processing with payment payload only.
      }
    }

    return {
      topic,
      gatewayStatus: String(payload.status ?? "pending"),
      gatewayStatusDetail,
      paymentId: String(payload.id ?? resourceId),
      preapprovalId,
      externalReference: paymentExternalReference,
      payerEmail: paymentPayerEmail,
      plan: paymentPlan,
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
    const userRow = await getProfileRow(parsedReference.uid);
    if (userRow) {
      return {
        uid: userRow.uid,
        userData: profileToUserData(userRow),
        matchedBy: "external_reference",
      };
    }
  }

  if (details.payerEmail) {
    const userQuery = await supabaseSelect("profiles", {
      filters: { email: details.payerEmail.toLowerCase() },
      limit: 1,
    });

    if (userQuery.length > 0) {
      const doc = userQuery[0] as ProfileRow;
      return {
        uid: doc.uid,
        userData: profileToUserData(doc),
        matchedBy: "email",
      };
    }
  }

  const pendingPlan = details.plan === "pro" || details.plan === "premium" ? details.plan : null;
  if (pendingPlan) {
    const now = Date.now();
    const windowMs = 6 * 60 * 60 * 1000; // 6 hours
    const pendingUsers = await supabaseSelect("profiles", {
      limit: 200,
    });

    const candidates: Array<{ uid: string; userData: Record<string, unknown>; distanceMs: number }> = [];

    for (const row of pendingUsers as ProfileRow[]) {
      const data = profileToUserData(row);
      const billing = (data.billing as Record<string, unknown> | null) ?? {};
      if (billing.pendingPlan !== pendingPlan) continue;
      const pendingCheckoutAt =
        typeof billing.pendingCheckoutAt === "string"
          ? billing.pendingCheckoutAt
          : null;
      if (!pendingCheckoutAt) continue;

      const pendingAtMs = new Date(pendingCheckoutAt).getTime();
      if (!pendingAtMs) continue;

      const distanceMs = Math.abs(now - pendingAtMs);
      if (distanceMs > windowMs) continue;

      candidates.push({ uid: row.uid, userData: data, distanceMs });
    }

    if (candidates.length === 1) {
      return {
        uid: candidates[0].uid,
        userData: candidates[0].userData,
        matchedBy: "pending_checkout",
      };
    }

    if (candidates.length > 1) {
      candidates.sort((a, b) => a.distanceMs - b.distanceMs);
      const closest = candidates[0];
      const second = candidates[1];
      if (second.distanceMs - closest.distanceMs > 15 * 60 * 1000) {
        return {
          uid: closest.uid,
          userData: closest.userData,
          matchedBy: "pending_checkout",
        };
      }
    }
  }

  return null;
}

function resolvePlan(details: GatewayDetails, currentPlan: UserPlan, pendingPlan?: UserPlan): UserPlan {
  if (details.plan) return details.plan;
  if (pendingPlan && pendingPlan !== "free") return pendingPlan;
  return currentPlan;
}

function computeTargetPlan(currentPlan: UserPlan, paymentStatus: UserPaymentStatus, gatewayPlan: UserPlan): UserPlan {
  if (paymentStatus === "paid") return gatewayPlan;
  if (paymentStatus === "canceled" || paymentStatus === "not_paid" || paymentStatus === "overdue") return "free";
  return currentPlan;
}

async function pushBillingStatusNotification(params: {
  uid: string;
  paymentStatus: UserPaymentStatus;
  targetPlan: UserPlan;
  source: "webhook" | "confirm";
}) {
  if (params.paymentStatus === "paid") {
    await pushNotification({
      uid: params.uid,
      kind: "billing",
      title: "Pagamento confirmado",
      message: `Seu plano ${params.targetPlan.toUpperCase()} esta ativo.`,
      href: "/settings?tab=billing",
      meta: { source: params.source, paymentStatus: params.paymentStatus, plan: params.targetPlan },
    });
    return;
  }

  if (params.paymentStatus === "pending" || params.paymentStatus === "overdue") {
    await pushNotification({
      uid: params.uid,
      kind: "billing",
      title: "Pagamento pendente",
      message: "Detectamos pendencia na assinatura. Regularize para manter seus recursos.",
      href: "/settings?tab=billing",
      meta: { source: params.source, paymentStatus: params.paymentStatus, plan: params.targetPlan },
    });
    return;
  }

  if (params.paymentStatus === "canceled" || params.paymentStatus === "not_paid") {
    await pushNotification({
      uid: params.uid,
      kind: "billing",
      title: "Assinatura em situacao irregular",
      message: "Seu plano foi ajustado para Free. Voce pode reativar quando quiser.",
      href: "/settings?tab=billing",
      meta: { source: params.source, paymentStatus: params.paymentStatus, plan: params.targetPlan },
    });
  }
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
    receivedAt: new Date().toISOString(),
    details,
  };

  if (!userMatch) {
    await writeBillingEvent(eventDocId, {
      ...baseEvent,
      status: "ignored_no_user_match",
    });

    return {
      ok: true,
      matched: false,
      reason: "user_not_found",
    };
  }

  const currentPlan = (userMatch.userData.plan as UserPlan) || "free";
  const pendingPlan =
    typeof userMatch.userData.billing === "object" &&
    userMatch.userData.billing !== null &&
    ((userMatch.userData.billing as { pendingPlan?: unknown }).pendingPlan === "pro" ||
      (userMatch.userData.billing as { pendingPlan?: unknown }).pendingPlan === "premium")
      ? ((userMatch.userData.billing as { pendingPlan: UserPlan }).pendingPlan as UserPlan)
      : undefined;
  const currentRole = (userMatch.userData.role as UserRole) || "client";
  const currentStatus = (userMatch.userData.status as UserStatus) || "active";
  const currentBlockReason = userMatch.userData.blockReason;
  const isBillingExemptRole = currentRole === "admin" || currentRole === "moderator";
  const paymentStatus = mapPaymentStatus(details.gatewayStatus);
  const gatewayPlan = resolvePlan(details, currentPlan, pendingPlan);
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

  await updateUserProfile(userMatch.uid, {
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
  });

  await writeBillingEvent(eventDocId, {
    ...baseEvent,
    status: "processed",
    matchedBy: userMatch.matchedBy,
    uid: userMatch.uid,
    targetPlan,
    targetPaymentStatus,
    statusPatch,
  });

  await pushBillingStatusNotification({
    uid: userMatch.uid,
    paymentStatus: targetPaymentStatus,
    targetPlan,
    source: "webhook",
  });

  return {
    ok: true,
    matched: true,
    uid: userMatch.uid,
    targetPlan,
    targetPaymentStatus,
  };
}

export function buildCheckoutUrl(baseUrl: string, opts: { uid: string; plan: UserPlan; returnUrl?: string }) {
  const url = new URL(baseUrl);
  // Mercado Pago subscription checkout (`/subscriptions/checkout`) may fail with
  // generic SUB03 errors when custom query params (like external_reference) are appended.
  // Keep the URL clean for this flow.
  if (!url.pathname.includes("/subscriptions/checkout")) {
    url.searchParams.set("external_reference", `uid:${opts.uid}|plan:${opts.plan}`);
  } else if (opts.returnUrl) {
    url.searchParams.set("back_url", opts.returnUrl);
  }
  return url.toString();
}

function normalizeGatewayDetailsFromPreapproval(payload: Record<string, unknown>, preapprovalId: string): GatewayDetails {
  const externalReference = typeof payload.external_reference === "string" ? payload.external_reference : undefined;
  const preapprovalPlanId =
    typeof payload.preapproval_plan_id === "string" ? payload.preapproval_plan_id : "";
  const mappedPlan = PLAN_BY_PREAPPROVAL_ID[preapprovalPlanId];
  const parsedReference = parseExternalReference(externalReference);

  return {
    topic: "preapproval",
    gatewayStatus: String(payload.status ?? "pending"),
    gatewayStatusDetail: typeof payload.reason === "string" ? payload.reason : undefined,
    preapprovalId,
    preapprovalPlanId,
    externalReference,
    payerEmail: typeof payload.payer_email === "string" ? payload.payer_email : undefined,
    plan: parsedReference.plan ?? mappedPlan,
  };
}

export async function confirmPreapprovalForUser(params: {
  uid: string;
  preapprovalId: string;
  expectedPlan?: UserPlan;
  userEmail?: string;
}) {
  const payload = await mpRequest(`/preapproval/${params.preapprovalId}`);
  const details = normalizeGatewayDetailsFromPreapproval(payload, params.preapprovalId);

  if (params.userEmail && details.payerEmail && params.userEmail.toLowerCase() !== details.payerEmail.toLowerCase()) {
    throw new Error("payer_email_mismatch");
  }

  if (params.expectedPlan && details.plan && params.expectedPlan !== details.plan) {
    throw new Error("plan_mismatch");
  }

  const userRow = await getProfileRow(params.uid);
  if (!userRow) {
    throw new Error("user_not_found");
  }

  const userData = profileToUserData(userRow);
  const currentPlan = (userData.plan as UserPlan) || "free";
  const currentRole = (userData.role as UserRole) || "client";
  const currentStatus = (userData.status as UserStatus) || "active";
  const currentBlockReason = userData.blockReason;
  const isBillingExemptRole = currentRole === "admin" || currentRole === "moderator";
  const paymentStatus = mapPaymentStatus(details.gatewayStatus);
  const gatewayPlan = resolvePlan(details, currentPlan);
  const targetPlan = isBillingExemptRole ? currentPlan : computeTargetPlan(currentPlan, paymentStatus, gatewayPlan);
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

  await updateUserProfile(params.uid, {
    plan: targetPlan,
    paymentStatus: targetPaymentStatus,
    ...statusPatch,
    billing: {
      source: "mercadopago_confirm",
      provider: "mercadopago",
      gatewayStatus: details.gatewayStatus,
      gatewayStatusDetail: details.gatewayStatusDetail ?? null,
      gatewayPlan,
      externalReference: details.externalReference ?? null,
      preapprovalId: details.preapprovalId ?? null,
      lastEventType: "preapproval_confirm",
      lastEventAction: "manual_confirm",
      lastEventId: details.preapprovalId ?? null,
      lastEventAt: nowIso,
      lastSyncAt: nowIso,
      lastError: null,
      pendingPreapprovalId: null,
      pendingPlan: null,
      pendingCheckoutAt: null,
    },
  });

  await writeBillingEvent(`confirm_preapproval_${params.preapprovalId}_${params.uid}`, {
    topic: "preapproval_confirm",
    action: "manual_confirm",
    resourceId: params.preapprovalId,
    uid: params.uid,
    status: "processed",
    targetPlan,
    targetPaymentStatus,
    details,
    processedAt: new Date().toISOString(),
  });

  await pushBillingStatusNotification({
    uid: params.uid,
    paymentStatus: targetPaymentStatus,
    targetPlan,
    source: "confirm",
  });

  return {
    ok: true,
    uid: params.uid,
    targetPlan,
    targetPaymentStatus,
    gatewayStatus: details.gatewayStatus,
  };
}

export async function confirmLatestPreapprovalForUser(params: {
  uid: string;
  userEmail: string;
  expectedPlan?: Exclude<UserPlan, "free">;
  checkoutStartedAt?: string;
}) {
  const searchPayload = await mpRequest(`/preapproval/search?payer_email=${encodeURIComponent(params.userEmail)}&limit=30&offset=0`);
  const results = Array.isArray(searchPayload.results) ? (searchPayload.results as Record<string, unknown>[]) : [];

  const expectedPlanId =
    params.expectedPlan === "pro"
      ? process.env.MERCADOPAGO_PLAN_PRO_ID
      : params.expectedPlan === "premium"
        ? process.env.MERCADOPAGO_PLAN_PREMIUM_ID
        : undefined;
  const minStartedAt = params.checkoutStartedAt ? new Date(params.checkoutStartedAt).getTime() - 10 * 60 * 1000 : null;

  const baseCandidates = results.filter((item) => {
    const payerEmail = typeof item.payer_email === "string" ? item.payer_email.toLowerCase() : "";
    if (payerEmail !== params.userEmail.toLowerCase()) return false;

    if (expectedPlanId && item.preapproval_plan_id !== expectedPlanId) return false;
    return true;
  });

  const candidates = baseCandidates.filter((item) => {
    if (minStartedAt) {
      const createdAt = typeof item.date_created === "string" ? new Date(item.date_created).getTime() : 0;
      if (!createdAt || createdAt < minStartedAt) return false;
    }
    return true;
  });
  const candidatesToSort = candidates.length > 0 ? candidates : baseCandidates;

  const selected = candidatesToSort.sort((a, b) => {
    const aStatus = mapPaymentStatus(typeof a.status === "string" ? a.status : "pending");
    const bStatus = mapPaymentStatus(typeof b.status === "string" ? b.status : "pending");
    const aPaidWeight = aStatus === "paid" ? 1 : 0;
    const bPaidWeight = bStatus === "paid" ? 1 : 0;
    if (aPaidWeight !== bPaidWeight) return bPaidWeight - aPaidWeight;

    const aTime = typeof a.date_created === "string" ? new Date(a.date_created).getTime() : 0;
    const bTime = typeof b.date_created === "string" ? new Date(b.date_created).getTime() : 0;
    return bTime - aTime;
  })[0];

  const selectedId = typeof selected?.id === "string" ? selected.id : null;
  let resolvedPreapprovalId = selectedId;
  if (!resolvedPreapprovalId && expectedPlanId && params.checkoutStartedAt) {
    const planSearchPayload = await mpRequest(
      `/preapproval/search?preapproval_plan_id=${encodeURIComponent(expectedPlanId)}&limit=30&offset=0`
    );
    const planResults = Array.isArray(planSearchPayload.results)
      ? (planSearchPayload.results as Record<string, unknown>[])
      : [];
    const checkoutStartedAtMs = new Date(params.checkoutStartedAt).getTime();
    const fallbackWindowStart = checkoutStartedAtMs - 10 * 60 * 1000;
    const fallbackWindowEnd = checkoutStartedAtMs + 6 * 60 * 60 * 1000;

    const fallbackCandidates = planResults.filter((item) => {
      const createdAt = typeof item.date_created === "string" ? new Date(item.date_created).getTime() : 0;
      if (!createdAt) return false;
      if (createdAt < fallbackWindowStart || createdAt > fallbackWindowEnd) return false;
      const status = mapPaymentStatus(typeof item.status === "string" ? item.status : "pending");
      return status === "paid";
    });

    if (fallbackCandidates.length === 1 && typeof fallbackCandidates[0].id === "string") {
      resolvedPreapprovalId = fallbackCandidates[0].id as string;
    } else if (fallbackCandidates.length > 1) {
      throw new Error("preapproval_ambiguous_match");
    }
  }

  if (!resolvedPreapprovalId) {
    throw new Error("preapproval_not_found_for_user");
  }

  return confirmPreapprovalForUser({
    uid: params.uid,
    preapprovalId: resolvedPreapprovalId,
    expectedPlan: params.expectedPlan,
    userEmail: params.userEmail,
  });
}

export async function cancelSubscriptionForUser(params: {
  uid: string;
  userEmail: string;
}) {
  const userRow = await getProfileRow(params.uid);
  if (!userRow) {
    throw new Error("user_not_found");
  }

  const userData = profileToUserData(userRow);
  const currentRole = (userData.role as UserRole) || "client";
  const currentStatus = (userData.status as UserStatus) || "active";
  const currentPlan = (userData.plan as UserPlan) || "free";
  const isBillingExemptRole = currentRole === "admin" || currentRole === "moderator";
  if (isBillingExemptRole) {
    throw new Error("role_billing_exempt");
  }

  let preapprovalId =
    typeof userData.billing === "object" &&
    userData.billing !== null &&
    typeof (userData.billing as { preapprovalId?: unknown }).preapprovalId === "string"
      ? (userData.billing as { preapprovalId: string }).preapprovalId
      : "";

  if (!preapprovalId) {
    const expectedPlanId =
      currentPlan === "pro"
        ? process.env.MERCADOPAGO_PLAN_PRO_ID
        : currentPlan === "premium"
          ? process.env.MERCADOPAGO_PLAN_PREMIUM_ID
          : undefined;
    const searchPayload = await mpRequest(`/preapproval/search?payer_email=${encodeURIComponent(params.userEmail)}&limit=30&offset=0`);
    const results = Array.isArray(searchPayload.results) ? (searchPayload.results as Record<string, unknown>[]) : [];

    const activeCandidates = results.filter((item) => {
      const status = typeof item.status === "string" ? item.status.toLowerCase() : "";
      const isActiveStatus = status === "authorized" || status === "pending" || status === "paused";
      if (!isActiveStatus) return false;
      if (expectedPlanId && item.preapproval_plan_id !== expectedPlanId) return false;
      return true;
    });

    const selected = activeCandidates.sort((a, b) => {
      const aTime = typeof a.date_created === "string" ? new Date(a.date_created).getTime() : 0;
      const bTime = typeof b.date_created === "string" ? new Date(b.date_created).getTime() : 0;
      return bTime - aTime;
    })[0];

    preapprovalId = typeof selected?.id === "string" ? selected.id : "";
  }

  if (!preapprovalId) {
    throw new Error("subscription_not_found");
  }

  const payload = await mpPut(`/preapproval/${preapprovalId}`, { status: "cancelled" });
  const details = normalizeGatewayDetailsFromPreapproval(payload, preapprovalId);
  const nowIso = new Date().toISOString();

  await updateUserProfile(params.uid, {
    plan: "free" as UserPlan,
    paymentStatus: "canceled" as UserPaymentStatus,
    status: currentStatus === "deleted" ? "deleted" : "active",
    blockReason: "",
    billing: {
      source: "mercadopago_cancel",
      provider: "mercadopago",
      gatewayStatus: details.gatewayStatus,
      gatewayStatusDetail: details.gatewayStatusDetail ?? null,
      gatewayPlan: "free",
      preapprovalId,
      lastEventType: "preapproval_cancel",
      lastEventAction: "manual_cancel",
      lastEventId: preapprovalId,
      lastEventAt: nowIso,
      lastSyncAt: nowIso,
      lastError: null,
      pendingPreapprovalId: null,
      pendingPlan: null,
      pendingCheckoutAt: null,
    },
  });

  await writeBillingEvent(`cancel_preapproval_${preapprovalId}_${params.uid}`, {
    topic: "preapproval_cancel",
    action: "manual_cancel",
    resourceId: preapprovalId,
    uid: params.uid,
    status: "processed",
    targetPlan: "free",
    targetPaymentStatus: "canceled",
    details,
    processedAt: new Date().toISOString(),
  });

  return {
    ok: true,
    uid: params.uid,
    preapprovalId,
    targetPlan: "free" as UserPlan,
    targetPaymentStatus: "canceled" as UserPaymentStatus,
  };
}

