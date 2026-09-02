import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { verifyRequestAuth } from "@/lib/auth/server";
import { supabaseUpsertRows } from "@/services/supabase/admin";

const ALLOWED_EVENTS = new Set([
  "landing_viewed", "pricing_viewed", "billing_interval_selected", "plan_selected",
  "registration_started", "registration_completed", "checkout_started", "checkout_redirected",
  "checkout_completed", "checkout_failed",
]);

function safeProperties(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 20)) {
    if (!/^[a-zA-Z0-9_.-]{1,50}$/.test(key)) continue;
    if (typeof item === "string") result[key] = item.slice(0, 200);
    else if (typeof item === "number" || typeof item === "boolean" || item === null) result[key] = item;
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request, { key: "api:analytics-events:post", max: 120, windowMs: 60_000 });
    if (!rate.allowed) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });

    const body = (await request.json()) as { name?: string; sessionId?: string; path?: string; properties?: unknown };
    if (!body.name || !ALLOWED_EVENTS.has(body.name)) {
      return NextResponse.json({ ok: false, error: "invalid_event" }, { status: 400 });
    }

    let uid: string | null = null;
    try { uid = (await verifyRequestAuth(request)).uid; } catch { /* anonymous funnel event */ }
    const meta = getRequestMeta(request);
    await supabaseUpsertRows("product_events", [{
      id: crypto.randomUUID(),
      uid,
      session_id: String(body.sessionId || "").slice(0, 80) || null,
      event_name: body.name,
      path: String(body.path || meta.route).slice(0, 200),
      properties: safeProperties(body.properties),
      created_at: new Date().toISOString(),
    }], { onConflict: "id" });

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch {
    // Analytics must never block conversion or expose internal errors.
    return NextResponse.json({ ok: true, accepted: false }, { status: 202 });
  }
}
