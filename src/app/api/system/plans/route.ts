import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/services/firebase/admin";
import { DEFAULT_PLANS_CONFIG, PlansConfig } from "@/types/system";

async function getUidFromBearer(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) throw new Error("missing_auth_token");
  const decoded = await adminAuth.verifyIdToken(token);
  return decoded.uid;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snap = await adminDb.collection("system").doc("plans").get();
    const plans = snap.exists ? (snap.data() as PlansConfig) : DEFAULT_PLANS_CONFIG;
    return NextResponse.json({ ok: true, plans }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
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
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
