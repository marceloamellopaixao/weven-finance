import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/services/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function archiveUserTransactions(uid: string) {
  const transactionsRef = adminDb.collection("users").doc(uid).collection("transactions");
  const snapshot = await transactionsRef.get();
  if (snapshot.empty) return;

  let batch = adminDb.batch();
  let opCount = 0;

  for (const doc of snapshot.docs) {
    batch.set(doc.ref, { isArchived: true }, { merge: true });
    opCount += 1;

    if (opCount >= 400) {
      await batch.commit();
      batch = adminDb.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: "missing_auth_token" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    await archiveUserTransactions(uid);
    await adminDb.collection("users").doc(uid).set(
      {
        status: "deleted",
        role: "client",
        plan: "free",
        paymentStatus: "canceled",
        blockReason: "Conta excluida pelo usuário",
        deletedAt: new Date().toISOString(),
        billing: {
          source: "system",
          lastSyncAt: new Date().toISOString(),
          pendingPreapprovalId: null,
          pendingPlan: null,
          pendingCheckoutAt: null,
          lastError: null,
        },
      },
      { merge: true }
    );

    await adminDb.collection("billing_events").doc(`account_delete_${uid}_${Date.now()}`).set(
      {
        topic: "account_delete",
        action: "self_delete",
        resourceId: uid,
        uid,
        status: "processed",
        processedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Account delete API error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown_error" },
      { status: 500 }
    );
  }
}
