import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/services/firebase/admin";
import { cancelSubscriptionForUser } from "@/lib/billing/mercadopago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: "missing_auth_token" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const userRef = adminDb.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data() ?? {};
    const userEmail = ((userData.email as string | undefined) ?? decoded.email ?? "").trim();
    if (!userEmail) {
      return NextResponse.json({ ok: false, error: "missing_user_email" }, { status: 400 });
    }

    const result = await cancelSubscriptionForUser({
      uid: decoded.uid,
      userEmail,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Cancel subscription API error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown_error" },
      { status: 500 }
    );
  }
}
