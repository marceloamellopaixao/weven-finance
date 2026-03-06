import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/services/firebase/admin";

type SupportType = "support" | "feature";

async function getAuthContext(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) throw new Error("missing_auth_token");
  const decoded = await adminAuth.verifyIdToken(token);
  const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
  if (!userSnap.exists) throw new Error("user_not_found");
  const userData = userSnap.data() as { role?: string; email?: string; displayName?: string; completeName?: string };
  return {
    uid: decoded.uid,
    email: decoded.email || userData.email || "",
    name: userData.displayName || userData.completeName || decoded.email || "Usuario",
    role: userData.role || "client",
  };
}

function normalizeDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    let queryRef: FirebaseFirestore.Query = adminDb.collection("support_requests");

    if (auth.role === "support") {
      queryRef = queryRef.where("assignedTo", "==", auth.uid);
    } else if (auth.role !== "admin" && auth.role !== "moderator") {
      queryRef = queryRef.where("uid", "==", auth.uid);
    }

    const snapshot = await queryRef.get();
    const tickets = snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        return {
          id: docSnap.id,
          ...data,
          createdAt: normalizeDate(data.createdAt),
        };
      })
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    return NextResponse.json({ ok: true, tickets }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const body = (await request.json()) as {
      type?: SupportType;
      message?: string;
      status?: string;
      platform?: string;
    };

    const type = body.type === "feature" ? "feature" : "support";
    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const payload: Record<string, unknown> = {
      uid: auth.uid,
      email: auth.email,
      name: auth.name,
      message,
      type,
      status: body.status || "pending",
      createdAt: FieldValue.serverTimestamp(),
      platform: body.platform || "web",
    };

    if (type === "feature") {
      payload.votes = 0;
    }

    const ref = await adminDb.collection("support_requests").add(payload);

    return NextResponse.json({ ok: true, id: ref.id }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const body = (await request.json()) as {
      ticketId?: string;
      updates?: Record<string, unknown>;
    };

    const ticketId = body.ticketId?.trim();
    if (!ticketId || !body.updates) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const ticketRef = adminDb.collection("support_requests").doc(ticketId);
    const ticketSnap = await ticketRef.get();
    if (!ticketSnap.exists) {
      return NextResponse.json({ ok: false, error: "ticket_not_found" }, { status: 404 });
    }
    const ticketData = ticketSnap.data() as { uid?: string; assignedTo?: string };

    const isManager = auth.role === "admin" || auth.role === "moderator";
    const isSupportSelfAssignment =
      auth.role === "support" &&
      (ticketData.assignedTo === auth.uid || body.updates.assignedTo === auth.uid);
    const isOwner = ticketData.uid === auth.uid;

    if (!isManager && !isSupportSelfAssignment && !isOwner) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    await ticketRef.set(body.updates, { merge: true });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (auth.role !== "admin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const ticketId = request.nextUrl.searchParams.get("ticketId")?.trim();
    if (!ticketId) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    await adminDb.collection("support_requests").doc(ticketId).delete();
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
