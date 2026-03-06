import { NextRequest, NextResponse } from "next/server";
import { resolveApiErrorStatus } from "@/lib/api/error";
import { resolveActingContext } from "@/lib/impersonation/server";
import { PaymentCardType } from "@/types/paymentCard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeBrand(value: string | null): string | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes("master")) return "Mastercard";
  if (lower.includes("visa")) return "Visa";
  if (lower.includes("amex") || lower.includes("american")) return "American Express";
  if (lower.includes("elo")) return "Elo";
  if (lower.includes("hipercard")) return "Hipercard";
  if (lower.includes("discover")) return "Discover";
  if (lower.includes("jcb")) return "JCB";
  if (lower.includes("diners")) return "Diners Club";
  return value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeType(value: string | null): PaymentCardType | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === "debit") return "debit_card";
  if (lower === "credit") return "credit_card";
  return null;
}

export async function GET(request: NextRequest) {
  try {
    await resolveActingContext(request);

    const bin = request.nextUrl.searchParams.get("bin")?.replace(/\D/g, "").slice(0, 8) || "";
    if (bin.length < 6) {
      return NextResponse.json({ ok: false, error: "invalid_bin" }, { status: 400 });
    }

    const response = await fetch(`https://lookup.binlist.net/${bin}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Version": "3",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: true,
          identification: { brand: null, bankName: null, suggestedType: null },
        },
        { status: 200 }
      );
    }

    const payload = (await response.json()) as {
      scheme?: string;
      type?: string;
      bank?: { name?: string };
    };

    const brand = normalizeBrand(payload.scheme || null);
    const bankName = payload.bank?.name?.trim() || null;
    const suggestedType = normalizeType(payload.type || null);

    return NextResponse.json(
      {
        ok: true,
        identification: {
          brand,
          bankName,
          suggestedType,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ ok: false, error: message }, { status: resolveApiErrorStatus(message) });
  }
}
