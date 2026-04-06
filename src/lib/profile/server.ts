import "server-only";

import { normalizePhone } from "@/lib/phone";
import { supabaseSelect } from "@/services/supabase/admin";

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export async function findProfileByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const rows = await supabaseSelect("profiles", {
    select: "uid,email,raw",
    conditions: {
      email: `ilike.${normalizedEmail}`,
    },
    limit: 1,
  });

  return rows[0] ?? null;
}

export async function assertPhoneAvailable(phone: string, currentUid?: string) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return normalizedPhone;

  const rows = await supabaseSelect("profiles", {
    select: "uid,phone,raw",
    filters: {
      phone: normalizedPhone,
    },
    limit: 2,
  });

  const conflict = rows.find((row) => String(row.uid || "") !== String(currentUid || ""));
  if (conflict) {
    throw new Error("phone_already_in_use");
  }

  return normalizedPhone;
}
