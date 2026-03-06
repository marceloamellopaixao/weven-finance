import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/services/firebase/admin";
import { UserProfile } from "@/types/user";

async function getAuthContext(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) throw new Error("missing_auth_token");
  const decoded = await adminAuth.verifyIdToken(token);
  return { uid: decoded.uid, email: decoded.email || "" };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const body = (await request.json()) as {
      profile?: Partial<UserProfile>;
    };
    const profile = body.profile || {};

    const userRef = adminDb.collection("users").doc(auth.uid);
    const existing = await userRef.get();

    if (!existing.exists) {
      const newProfile: Partial<UserProfile> = {
        uid: auth.uid,
        email: auth.email,
        displayName: profile.displayName || "Usuário",
        completeName: profile.completeName || profile.displayName || "",
        phone: profile.phone || "",
        role: profile.role || "client",
        plan: profile.plan || "free",
        status: profile.status || "active",
        createdAt: new Date().toISOString(),
        paymentStatus: profile.paymentStatus || "pending",
        billing: profile.billing || {
          source: "system",
          lastSyncAt: new Date().toISOString(),
        },
        transactionCount: profile.transactionCount ?? 0,
        verifiedEmail: profile.verifiedEmail ?? false,
      };
      await userRef.set(newProfile, { merge: true });
      return NextResponse.json({ ok: true, created: true }, { status: 200 });
    }

    if (profile.deletedAt === null) {
      await userRef.set({ deletedAt: null }, { merge: true });
    }

    return NextResponse.json({ ok: true, created: false }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
