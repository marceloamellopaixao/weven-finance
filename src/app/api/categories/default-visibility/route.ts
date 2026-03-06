import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/services/firebase/admin";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { resolveApiErrorStatus } from "@/lib/api/error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const acting = await resolveActingContext(request);
    const uid = acting.actingUid;
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "categories:default-visibility",
      actionLabel: "Ocultar ou mostrar categoria padrao",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const body = (await request.json()) as {
      categoryName?: string;
      hidden?: boolean;
    };

    const categoryName = body.categoryName?.trim();
    const hidden = body.hidden;
    if (!categoryName || typeof hidden !== "boolean") {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }
    if (categoryName === "Outros") {
      return NextResponse.json({ ok: false, error: "cannot_hide_others" }, { status: 400 });
    }

    const settingsRef = adminDb.collection("users").doc(uid).collection("settings").doc("categories");
    const settingsSnap = await settingsRef.get();
    const settingsData = settingsSnap.exists ? (settingsSnap.data() as { hiddenDefaultCategories?: unknown }) : undefined;
    const currentHidden = Array.isArray(settingsData?.hiddenDefaultCategories)
      ? settingsData.hiddenDefaultCategories.filter((item): item is string => typeof item === "string")
      : [];

    const next = hidden
      ? Array.from(new Set([...currentHidden, categoryName]))
      : currentHidden.filter((name) => name !== categoryName);

    await settingsRef.set({ hiddenDefaultCategories: next }, { merge: true });
    return NextResponse.json({ ok: true, hiddenDefaultCategories: next }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
