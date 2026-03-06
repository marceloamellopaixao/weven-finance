import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/services/firebase/admin";

async function getUidFromBearer(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) throw new Error("missing_auth_token");
  const decoded = await adminAuth.verifyIdToken(token);
  return decoded.uid;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const uid = await getUidFromBearer(request);
    await adminDb.collection("users").doc(uid).set(
      {
        verifiedEmail: true,
        status: "active",
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
