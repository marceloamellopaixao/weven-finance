import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/services/firebase/admin";
import { DEFAULT_PLANS_CONFIG, PlansConfig } from "@/types/system";
import { resolveApiErrorStatus } from "@/lib/api/error";

async function getUidFromBearer(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) throw new Error("missing_auth_token");
  const decoded = await adminAuth.verifyIdToken(token);
  return decoded.uid;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLANS_CACHE_TTL_MS = 60000;
let plansCache: { at: number; value: PlansConfig } | null = null;

export async function GET() {
  try {
    if (plansCache && Date.now() - plansCache.at < PLANS_CACHE_TTL_MS) {
      return NextResponse.json(
        { ok: true, plans: plansCache.value },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
          },
        }
      );
    }

    const snap = await adminDb.collection("system").doc("plans").get();
    const plans = snap.exists ? (snap.data() as PlansConfig) : DEFAULT_PLANS_CONFIG;
    plansCache = { at: Date.now(), value: plans };

    return NextResponse.json(
      { ok: true, plans },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ ok: false, error: message }, { status: resolveApiErrorStatus(message) });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const uid = await getUidFromBearer(request);
    const userSnap = await adminDb.collection("users").doc(uid).get();
    const role = userSnap.exists ? String((userSnap.data() as { role?: string }).role || "client") : "client";
    if (role !== "admin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { plans?: PlansConfig };
    if (!body.plans || typeof body.plans !== "object") {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    await adminDb.collection("system").doc("plans").set(body.plans, { merge: true });
    plansCache = { at: Date.now(), value: body.plans };
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
