import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/services/firebase/admin";

type UserRole = "admin" | "moderator" | "support" | "client";

async function getAuthContext(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) throw new Error("missing_auth_token");
  const decoded = await adminAuth.verifyIdToken(token);
  const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
  if (!userSnap.exists) throw new Error("user_not_found");
  const role = String((userSnap.data() as { role?: string }).role || "client") as UserRole;
  return { uid: decoded.uid, role };
}

function isManager(role: UserRole) {
  return role === "admin" || role === "moderator";
}

async function setArchiveForAllTransactions(uid: string, value: boolean) {
  const snapshot = await adminDb.collection("users").doc(uid).collection("transactions").get();
  if (snapshot.empty) return;
  let batch = adminDb.batch();
  let count = 0;
  for (const docSnap of snapshot.docs) {
    batch.set(docSnap.ref, { isArchived: value }, { merge: true });
    count += 1;
    if (count >= 400) {
      await batch.commit();
      batch = adminDb.batch();
      count = 0;
    }
  }
  if (count > 0) await batch.commit();
}

async function deleteAllTransactions(uid: string) {
  const snapshot = await adminDb.collection("users").doc(uid).collection("transactions").get();
  if (snapshot.empty) return 0;
  let batch = adminDb.batch();
  let count = 0;
  let deleted = 0;
  for (const docSnap of snapshot.docs) {
    batch.delete(docSnap.ref);
    count += 1;
    deleted += 1;
    if (count >= 400) {
      await batch.commit();
      batch = adminDb.batch();
      count = 0;
    }
  }
  if (count > 0) await batch.commit();
  return deleted;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!isManager(auth.role)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const scope = request.nextUrl.searchParams.get("scope");
    if (scope === "staff") {
      const usersRef = adminDb.collection("users");
      const [admins, moderators] = await Promise.all([
        usersRef.where("role", "==", "admin").get(),
        usersRef.where("role", "==", "moderator").get(),
      ]);

      const staff = [...admins.docs, ...moderators.docs].map((docSnap) => ({
        uid: docSnap.id,
        ...docSnap.data(),
      })) as Array<Record<string, unknown>>;
      return NextResponse.json({ ok: true, users: staff }, { status: 200 });
    }

    const usersSnapshot = await adminDb.collection("users").get();
    const users = (usersSnapshot.docs.map((docSnap) => ({
      uid: docSnap.id,
      ...docSnap.data(),
    })) as Array<Record<string, unknown>>).sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );

    return NextResponse.json({ ok: true, users }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!isManager(auth.role)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      uid?: string;
      updates?: Record<string, unknown>;
      requiresAdmin?: boolean;
    };
    if (!body.uid || !body.updates) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }
    if (body.requiresAdmin && auth.role !== "admin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    await adminDb.collection("users").doc(body.uid).set(body.updates, { merge: true });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!isManager(auth.role)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      action?: "normalize" | "resetFinancialData" | "softDelete" | "restore" | "recountTransactionCount";
      uid?: string;
      restoreData?: boolean;
    };

    if (body.action === "normalize") {
      if (auth.role !== "admin") {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      const snapshot = await adminDb.collection("users").get();
      let updateCount = 0;
      const batch = adminDb.batch();
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const updates: Record<string, unknown> = {};
        let needsUpdate = false;
        if (data.phone === undefined) { updates.phone = ""; needsUpdate = true; }
        if (data.completeName === undefined) { updates.completeName = data.displayName || ""; needsUpdate = true; }
        if (data.transactionCount === undefined) { updates.transactionCount = 0; needsUpdate = true; }
        if (data.paymentStatus === undefined) { updates.paymentStatus = "pending"; needsUpdate = true; }
        if (data.verifiedEmail === undefined) { updates.verifiedEmail = false; needsUpdate = true; }
        if (data.blockReason === undefined) { updates.blockReason = ""; needsUpdate = true; }
        if (data.role === undefined) { updates.role = "client"; needsUpdate = true; }
        if (data.plan === undefined) { updates.plan = "free"; needsUpdate = true; }
        if (data.status === undefined) { updates.status = "active"; needsUpdate = true; }
        if (needsUpdate) {
          batch.set(docSnap.ref, updates, { merge: true });
          updateCount += 1;
        }
      });
      if (updateCount > 0) await batch.commit();
      return NextResponse.json({ ok: true, count: updateCount }, { status: 200 });
    }

    if (!body.uid) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    if (body.action === "resetFinancialData") {
      const deleted = await deleteAllTransactions(body.uid);
      await adminDb.collection("users").doc(body.uid).set({ transactionCount: 0 }, { merge: true });
      return NextResponse.json({ ok: true, deleted }, { status: 200 });
    }

    if (body.action === "softDelete") {
      if (auth.role !== "admin") {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      await setArchiveForAllTransactions(body.uid, true);
      await adminDb.collection("users").doc(body.uid).set(
        {
          status: "deleted",
          role: "client",
          paymentStatus: "canceled",
          blockReason: "Usuario solicitado exclusao",
          deletedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (body.action === "restore") {
      if (body.restoreData !== false) {
        await setArchiveForAllTransactions(body.uid, false);
      }
      await adminDb.collection("users").doc(body.uid).set(
        {
          status: "active",
          paymentStatus: "pending",
          blockReason: "",
          deletedAt: null,
        },
        { merge: true }
      );
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (body.action === "recountTransactionCount") {
      const countSnapshot = await adminDb.collection("users").doc(body.uid).collection("transactions").count().get();
      const total = countSnapshot.data().count;
      await adminDb.collection("users").doc(body.uid).set({ transactionCount: total }, { merge: true });
      return NextResponse.json({ ok: true, count: total }, { status: 200 });
    }

    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
