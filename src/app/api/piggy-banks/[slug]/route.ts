import { NextRequest, NextResponse } from "next/server";
import { resolveActingContext } from "@/lib/impersonation/server";
import { resolveApiErrorStatus } from "@/lib/api/error";
import { PiggyBankGoalType } from "@/types/piggyBank";
import { supabaseSelect } from "@/services/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const piggyRows = await supabaseSelect("piggy_banks", {
      filters: { uid: actingUid, source_id: safeSlug },
      limit: 1,
    });
    if (piggyRows.length === 0) {
      return NextResponse.json({ ok: false, error: "piggy_bank_not_found" }, { status: 404 });
    }

    const piggy = piggyRows[0];
    const piggyRaw = (piggy.raw as Record<string, unknown> | null) ?? {};

    const historyRows = await supabaseSelect("piggy_bank_history", {
      filters: { uid: actingUid, piggy_bank_id: String(piggy.id) },
      order: "created_at.desc.nullslast",
    });

    const history = historyRows
      .map((row) => {
        const entry = (row.raw as Record<string, unknown> | null) ?? {};
        return {
          id: String(row.source_id || row.id || ""),
          piggyBankId: safeSlug,
          amount: Number(row.amount || entry.amount || 0),
          withdrawalMode:
            typeof row.withdrawal_mode === "string"
              ? row.withdrawal_mode
              : typeof entry.withdrawalMode === "string"
                ? entry.withdrawalMode
                : undefined,
          yieldType:
            typeof row.yield_type === "string"
              ? row.yield_type
              : typeof entry.yieldType === "string"
                ? entry.yieldType
                : undefined,
          sourceType: row.source_type === "cash" || entry.sourceType === "cash" ? "cash" : "bank",
          cardId: typeof row.card_id === "string" ? row.card_id : typeof entry.cardId === "string" ? entry.cardId : undefined,
          cardLabel:
            typeof row.card_label === "string"
              ? row.card_label
              : typeof entry.cardLabel === "string"
                ? entry.cardLabel
                : undefined,
          appliedToCardLimit: Boolean(row.applied_to_card_limit ?? entry.appliedToCardLimit),
          createdAt:
            typeof row.created_at === "string"
              ? row.created_at
              : typeof entry.createdAt === "string"
                ? entry.createdAt
                : undefined,
        };
      })
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    const piggyBank = {
      id: String(piggy.source_id || piggy.id || ""),
      slug: String(piggy.slug || piggyRaw.slug || safeSlug),
      name: String(piggy.name || piggyRaw.name || "Cofrinho"),
      goalType: sanitizeGoalType(piggy.goal_type || piggyRaw.goalType),
      totalSaved: Number(piggy.total_saved || piggyRaw.totalSaved || 0),
      withdrawalMode:
        typeof piggy.withdrawal_mode === "string"
          ? piggy.withdrawal_mode
          : typeof piggyRaw.withdrawalMode === "string"
            ? piggyRaw.withdrawalMode
            : undefined,
      yieldType:
        typeof piggy.yield_type === "string"
          ? piggy.yield_type
          : typeof piggyRaw.yieldType === "string"
            ? piggyRaw.yieldType
            : undefined,
      createdAt:
        typeof piggy.created_at === "string"
          ? piggy.created_at
          : typeof piggyRaw.createdAt === "string"
            ? piggyRaw.createdAt
            : undefined,
      updatedAt:
        typeof piggy.updated_at === "string"
          ? piggy.updated_at
          : typeof piggyRaw.updatedAt === "string"
            ? piggyRaw.updatedAt
            : undefined,
      lastDepositAt: typeof piggyRaw.lastDepositAt === "string" ? piggyRaw.lastDepositAt : undefined,
      history,
    };

    return NextResponse.json({ ok: true, piggyBank }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
