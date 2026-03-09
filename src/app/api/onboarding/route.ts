import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/auth/server";
import { resolveActingContext } from "@/lib/impersonation/server";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { writeApiMetric } from "@/lib/observability/metrics";
import { apiLogger } from "@/lib/observability/logger";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";

type OnboardingData = {
  dismissed?: boolean;
  steps?: {
    firstTransaction?: boolean;
    firstCard?: boolean;
    firstGoal?: boolean;
    profileMenu?: boolean;
  };
};

function normalizeData(value: unknown): OnboardingData {
  const data = (value as Record<string, unknown> | null) ?? {};
  const steps = (data.steps as Record<string, unknown> | undefined) ?? {};
  return {
    dismissed: Boolean(data.dismissed),
    steps: {
      firstTransaction: Boolean(steps.firstTransaction),
      firstCard: Boolean(steps.firstCard),
      firstGoal: Boolean(steps.firstGoal),
      profileMenu: Boolean(steps.profileMenu),
    },
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  let uid: string | null = null;

  try {
    const rate = await checkRateLimit(request, { key: "api:onboarding:get", max: 120, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    await verifyRequestAuth(request);
    const acting = await resolveActingContext(request);
    uid = acting.actingUid;

    const [settingRow, txRows, cardRows, goalRows] = await Promise.all([
      supabaseSelect("user_settings", {
        select: "id,data",
        filters: { uid, setting_key: "onboarding" },
        limit: 1,
      }),
      supabaseSelect("transactions", { select: "id", filters: { uid }, limit: 1 }),
      supabaseSelect("payment_cards", { select: "id", filters: { uid }, limit: 1 }),
      supabaseSelect("piggy_banks", { select: "id", filters: { uid }, limit: 1 }),
    ]);

    const stored = normalizeData(settingRow[0]?.data);
    const hasFirstTransaction = Boolean(stored.steps?.firstTransaction) || txRows.length > 0;
    const hasFirstCard = Boolean(stored.steps?.firstCard) || cardRows.length > 0;
    const hasFirstGoal = Boolean(stored.steps?.firstGoal) || goalRows.length > 0;
    const hasProfileMenu = Boolean(stored.steps?.profileMenu);
    const progress = [hasFirstTransaction, hasFirstCard, hasFirstGoal, hasProfileMenu].filter(Boolean).length;
    const completed = progress === 4;

    const response = {
      ok: true,
      onboarding: {
        dismissed: Boolean(stored.dismissed),
        completed,
        progress,
        total: 4,
        steps: {
          firstTransaction: hasFirstTransaction,
          firstCard: hasFirstCard,
          firstGoal: hasFirstGoal,
          profileMenu: hasProfileMenu,
        },
      },
    };

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    apiLogger.error({
      message: "onboarding_get_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { uid, error: message },
    });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  let uid: string | null = null;

  try {
    const rate = await checkRateLimit(request, { key: "api:onboarding:put", max: 120, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    await verifyRequestAuth(request);
    const acting = await resolveActingContext(request);
    uid = acting.actingUid;
    const body = (await request.json()) as OnboardingData;

    const rows = await supabaseSelect("user_settings", {
      select: "id,data",
      filters: { uid, setting_key: "onboarding" },
      limit: 1,
    });
    const current = normalizeData(rows[0]?.data);
    const next: OnboardingData = {
      dismissed: typeof body.dismissed === "boolean" ? body.dismissed : current.dismissed,
      steps: {
        firstTransaction: Boolean(body.steps?.firstTransaction || current.steps?.firstTransaction),
        firstCard: Boolean(body.steps?.firstCard || current.steps?.firstCard),
        firstGoal: Boolean(body.steps?.firstGoal || current.steps?.firstGoal),
        profileMenu: Boolean(body.steps?.profileMenu || current.steps?.profileMenu),
      },
    };

    await supabaseUpsertRows(
      "user_settings",
      [
        {
          id: String(rows[0]?.id || `${uid}__onboarding`),
          uid,
          setting_key: "onboarding",
          data: next,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "id" }
    );

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    apiLogger.error({
      message: "onboarding_put_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { uid, error: message },
    });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
