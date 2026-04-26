import { NextRequest, NextResponse } from "next/server";
import { resolveApiErrorStatus } from "@/lib/api/error";
import { verifyRequestAuth } from "@/lib/auth/server";
import { buildEffectiveFeatureAccessConfig, hasBillingExemption, normalizeAccessControlConfig, resolveAccessLevel } from "@/lib/access-control/config";
import { hasIrregularGatewayBilling, hasTrustedPaidBilling } from "@/lib/billing/effective";
import {
  AccessPermissionLevel,
  AccessResourceKey,
  DEFAULT_ACCESS_CONTROL_CONFIG,
} from "@/types/system";
import { BillingInfo, UserPaymentStatus, UserPlan } from "@/types/user";
import { supabaseSelect } from "@/services/supabase/admin";

function resolvePlan(value: unknown): UserPlan {
  if (value === "premium" || value === "pro") return value;
  return "free";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyRequestAuth(request);
    const [profileRows, accessControlRows] = await Promise.all([
      supabaseSelect("profiles", {
        select: "plan,role,payment_status,billing,raw",
        filters: { uid: auth.uid },
        limit: 1,
      }),
      supabaseSelect("system_configs", {
        select: "data",
        filters: { key: "access_control" },
        limit: 1,
      }),
    ]);

    const raw = (profileRows[0]?.raw as Record<string, unknown> | null) ?? {};
    const storedPlan = resolvePlan(profileRows[0]?.plan ?? raw.plan);
    const role = String(profileRows[0]?.role || raw.role || "client");
    const paymentStatus = String(profileRows[0]?.payment_status ?? raw.paymentStatus ?? "pending") as UserPaymentStatus;
    const billing = (profileRows[0]?.billing ?? raw.billing ?? {}) as BillingInfo;
    const accessControl = accessControlRows.length > 0
      ? normalizeAccessControlConfig(accessControlRows[0]?.data)
      : DEFAULT_ACCESS_CONTROL_CONFIG;
    const billingExempt = hasBillingExemption(accessControl, { uid: auth.uid, role });
    const plan =
      billingExempt || storedPlan === "free" || hasTrustedPaidBilling(paymentStatus, billing) || !hasIrregularGatewayBilling(billing)
        ? storedPlan
        : "free";
    const effectiveFeatureAccess = buildEffectiveFeatureAccessConfig(accessControl, { uid: auth.uid, plan, role });

    const access: Partial<Record<AccessResourceKey, AccessPermissionLevel>> = {};
    for (const rule of accessControl.rules) {
      access[rule.resource] = resolveAccessLevel(accessControl, { uid: auth.uid, plan, role }, rule.resource);
    }

    return NextResponse.json(
      {
        ok: true,
        access,
        featureAccess: effectiveFeatureAccess,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ ok: false, error: message }, { status: resolveApiErrorStatus(message) });
  }
}
