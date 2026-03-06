import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/services/firebase/admin";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";

type CategoryType = "income" | "expense" | "both";

function parseCategoryType(value: unknown): CategoryType | null {
  if (value === "income" || value === "expense" || value === "both") return value;
  return null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { actingUid: uid } = await resolveActingContext(request);
    const [customSnapshot, settingsSnapshot] = await Promise.all([
      adminDb.collection("users").doc(uid).collection("categories").get(),
      adminDb.collection("users").doc(uid).collection("settings").doc("categories").get(),
    ]);

    const customCategories = customSnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      name: String(docSnap.data().name || ""),
      type: parseCategoryType(docSnap.data().type) || "both",
      color: String(docSnap.data().color || "bg-zinc-500/10 text-zinc-600 border-zinc-200/50 dark:text-zinc-400 dark:border-zinc-800/50"),
      userId: uid,
    }));

    const settingsData = settingsSnapshot.exists
      ? (settingsSnapshot.data() as { hiddenDefaultCategories?: unknown })
      : undefined;
    const hiddenDefaultCategories = Array.isArray(settingsData?.hiddenDefaultCategories)
      ? settingsData.hiddenDefaultCategories.filter((item): item is string => typeof item === "string")
      : [];

    return NextResponse.json(
      {
        ok: true,
        customCategories,
        hiddenDefaultCategories,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const acting = await resolveActingContext(request);
    const uid = acting.actingUid;
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "categories:create",
      actionLabel: "Criar categoria personalizada",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const body = (await request.json()) as {
      name?: string;
      type?: CategoryType;
      color?: string;
    };

    const name = body.name?.trim();
    const type = parseCategoryType(body.type);
    if (!name || !type) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const duplicate = await adminDb
      .collection("users")
      .doc(uid)
      .collection("categories")
      .where("name", "==", name)
      .limit(1)
      .get();

    if (!duplicate.empty) {
      return NextResponse.json({ ok: false, error: "duplicate_category_name" }, { status: 409 });
    }

    const categoryRef = await adminDb.collection("users").doc(uid).collection("categories").add({
      name,
      type,
      color: body.color || "bg-zinc-500/10 text-zinc-600 border-zinc-200/50 dark:text-zinc-400 dark:border-zinc-800/50",
      userId: uid,
    });

    return NextResponse.json({ ok: true, id: categoryRef.id }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const acting = await resolveActingContext(request);
    const uid = acting.actingUid;
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "categories:rename",
      actionLabel: "Renomear categorias personalizadas",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const body = (await request.json()) as {
      oldName?: string;
      newName?: string;
    };

    const oldName = body.oldName?.trim();
    const newName = body.newName?.trim();
    if (!oldName || !newName) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const categoriesSnapshot = await adminDb.collection("users").doc(uid).collection("categories").get();
    const allCustomCategories = categoriesSnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      name: String(docSnap.data().name || ""),
    }));

    const affected = allCustomCategories.filter(
      (item) => item.name === oldName || item.name.startsWith(`${oldName}::`)
    );

    if (affected.length === 0) {
      return NextResponse.json({ ok: true, updated: 0 }, { status: 200 });
    }

    const renameMap = new Map<string, string>();
    affected.forEach((item) => {
      const suffix = item.name.slice(oldName.length);
      renameMap.set(item.name, `${newName}${suffix}`);
    });

    const existingNames = new Set(
      allCustomCategories
        .filter((item) => !renameMap.has(item.name))
        .map((item) => item.name)
    );

    for (const targetName of renameMap.values()) {
      if (existingNames.has(targetName)) {
        return NextResponse.json({ ok: false, error: "duplicate_category_name" }, { status: 409 });
      }
    }

    const batch = adminDb.batch();
    let updateCount = 0;

    for (const item of affected) {
      const renamed = renameMap.get(item.name);
      if (!renamed || renamed === item.name) continue;
      batch.update(adminDb.collection("users").doc(uid).collection("categories").doc(item.id), { name: renamed });
      updateCount += 1;
    }

    const txSnapshots = await Promise.all(
      Array.from(renameMap.entries()).map(([currentName]) =>
        adminDb.collection("users").doc(uid).collection("transactions").where("category", "==", currentName).get()
      )
    );

    Array.from(renameMap.entries()).forEach(([, renamedName], index) => {
      txSnapshots[index].docs.forEach((docSnap) => {
        batch.update(docSnap.ref, { category: renamedName });
        updateCount += 1;
      });
    });

    if (updateCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({ ok: true, updated: updateCount }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const acting = await resolveActingContext(request);
    const uid = acting.actingUid;
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "categories:delete",
      actionLabel: "Excluir categoria personalizada",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const categoryName = request.nextUrl.searchParams.get("name")?.trim();
    const fallbackCategory = request.nextUrl.searchParams.get("fallbackCategory")?.trim() || "Outros";
    if (!categoryName) {
      return NextResponse.json({ ok: false, error: "missing_category_name" }, { status: 400 });
    }

    const customSnapshot = await adminDb.collection("users").doc(uid).collection("categories").get();
    const affected = customSnapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        name: String(docSnap.data().name || ""),
      }))
      .filter((item) => item.name === categoryName || item.name.startsWith(`${categoryName}::`));

    const batch = adminDb.batch();
    let updateCount = 0;

    affected.forEach((item) => {
      batch.delete(adminDb.collection("users").doc(uid).collection("categories").doc(item.id));
      updateCount += 1;
    });

    const txSnapshots = await Promise.all(
      affected.map((item) =>
        adminDb.collection("users").doc(uid).collection("transactions").where("category", "==", item.name).get()
      )
    );

    txSnapshots.forEach((txSnapshot) => {
      txSnapshot.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, { category: fallbackCategory });
        updateCount += 1;
      });
    });

    if (updateCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({ ok: true, updated: updateCount }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status =
      message === "missing_auth_token" ? 401
        : message.startsWith("impersonation_") ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
