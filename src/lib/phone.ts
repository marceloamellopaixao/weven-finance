export function normalizePhone(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "").slice(0, 11);
}

export function formatPhone(value: string | null | undefined) {
  const digits = normalizePhone(value);
  if (!digits) return "";

  if (digits.length <= 2) return digits;

  if (digits.length <= 6) {
    return digits.replace(/(\d{2})(\d{0,4})/, "($1) $2").trim();
  }

  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  }

  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}
