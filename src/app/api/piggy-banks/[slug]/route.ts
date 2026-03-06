import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/services/firebase/admin";
import { resolveActingContext } from "@/lib/impersonation/server";
import { resolveApiErrorStatus } from "@/lib/api/error";
import { PiggyBankGoalType } from "@/types/piggyBank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function sanitizeGoalType(value: unknown): PiggyBankGoalType {
  if (
    value === "card_limit" ||
    value === "emergency_reserve" ||
    value === "travel" ||
    value === "home_renovation" ||
    value === "dream_purchase" ||
    value === "custom"
  ) {
    return value;
  }
  return "custom";
}

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { actingUid } = await resolveActingContext(_request);
    const { slug } = await context.params;
    const safeSlug = String(slug || "").trim();
    if (!safeSlug) {
      return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 });
    }

    const piggyRef = adminDb.collection("users").doc(actingUid).collection("piggy_banks").doc(safeSlug);
    const piggySnap = await piggyRef.get();
    if (!piggySnap.exists) {
      return NextResponse.json({ ok: false, error: "piggy_bank_not_found" }, { status: 404 });
    }

    const data = piggySnap.data() as Record<string, unknown>;
    const historySnap = await piggyRef.collection("history").get();
    const history = historySnap.docs
      .map((docSnap) => {
        const entry = docSnap.data() as Record<string, unknown>;
        return {
          id: docSnap.id,
          piggyBankId: safeSlug,
          amount: Number(entry.amount || 0),
          withdrawalMode: typeof entry.withdrawalMode === "string" ? entry.withdrawalMode : undefined,
          yieldType: typeof entry.yieldType === "string" ? entry.yieldType : undefined,
          sourceType: entry.sourceType === "cash" ? "cash" : "bank",
          cardId: typeof entry.cardId === "string" ? entry.cardId : undefined,
          cardLabel: typeof entry.cardLabel === "string" ? entry.cardLabel : undefined,
          appliedToCardLimit: Boolean(entry.appliedToCardLimit),
          createdAt: toIsoDate(entry.createdAtServer) || (typeof entry.createdAt === "string" ? entry.createdAt : undefined),
        };
      })
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    const piggyBank = {
      id: piggySnap.id,
      slug: String(data.slug || piggySnap.id),
      name: String(data.name || "Cofrinho"),
      goalType: sanitizeGoalType(data.goalType),
      totalSaved: Number(data.totalSaved || 0),
      withdrawalMode: typeof data.withdrawalMode === "string" ? data.withdrawalMode : undefined,
      yieldType: typeof data.yieldType === "string" ? data.yieldType : undefined,
      createdAt: toIsoDate(data.createdAtServer) || (typeof data.createdAt === "string" ? data.createdAt : undefined),
      updatedAt: toIsoDate(data.updatedAtServer) || (typeof data.updatedAt === "string" ? data.updatedAt : undefined),
      lastDepositAt: toIsoDate(data.lastDepositAtServer) || (typeof data.lastDepositAt === "string" ? data.lastDepositAt : undefined),
      history,
    };

    return NextResponse.json({ ok: true, piggyBank }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
