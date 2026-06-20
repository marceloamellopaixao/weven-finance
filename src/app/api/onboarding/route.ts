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
  tourCompleted?: boolean;
  steps?: {
    firstTransaction?: boolean;
    firstCard?: boolean;
    firstGoal?: boolean;
    profileMenu?: boolean;
  };
};

function normalizeData(value: unknown): OnboardingData {
  const data = (value as Record<string, unknown> | null) ?? {};
  return {
    dismissed: Boolean(data.dismissed),
    tourCompleted: Boolean(data.tourCompleted),
    steps: {
      firstTransaction: true,
      firstCard: true,
      firstGoal: true,
      profileMenu: true,
    },
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ONBOARDING_SETTING_KEY = "onboarding";

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
    const settingRows = await supabaseSelect("user_settings", {
      select: "id,setting_key,data",
      filters: { uid, setting_key: ONBOARDING_SETTING_KEY },
      limit: 1,
    });

    const activeSettingRow = settingRows[0];
    const stored = normalizeData(activeSettingRow?.data);

    const response = {
      ok: true,
      onboarding: {
        dismissed: Boolean(stored.dismissed),
        completed: Boolean(stored.tourCompleted),
        progress: stored.tourCompleted ? 1 : 0,
        total: 1,
        tourCompleted: Boolean(stored.tourCompleted),
        steps: {
          firstTransaction: true,
          firstCard: true,
          firstGoal: true,
          profileMenu: true,
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
    const body = (await request.json()) as OnboardingData;
    uid = acting.actingUid;

    const rows = await supabaseSelect("user_settings", {
      select: "id,setting_key,data",
      filters: { uid, setting_key: ONBOARDING_SETTING_KEY },
      limit: 1,
    });
    const activeRow = rows[0];
    const current = normalizeData(activeRow?.data);
    const next: OnboardingData = {
      dismissed: typeof body.dismissed === "boolean" ? body.dismissed : current.dismissed,
      tourCompleted: typeof body.tourCompleted === "boolean" ? body.tourCompleted : current.tourCompleted,
      steps: {
        firstTransaction: true,
        firstCard: true,
        firstGoal: true,
        profileMenu: true,
      },
    };

    await supabaseUpsertRows(
      "user_settings",
      [
        {
          id: String(activeRow?.id || `${uid}__${ONBOARDING_SETTING_KEY}`),
          uid,
          setting_key: ONBOARDING_SETTING_KEY,
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
