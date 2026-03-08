import { supabaseUpsertRows } from "@/services/supabase/admin";

export type NotificationKind =
  | "system"
  | "billing"
  | "support"
  | "onboarding"
  | "transaction"
  | "card"
  | "goal";

type NotificationInput = {
  uid: string;
  kind: NotificationKind;
  title: string;
  message: string;
  href?: string | null;
  meta?: Record<string, unknown>;
};

function toRow(input: NotificationInput) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    uid: input.uid,
    kind: input.kind,
    title: input.title,
    message: input.message,
    href: input.href || null,
    is_read: false,
    meta: input.meta || {},
    created_at: now,
    updated_at: now,
  };
}

function isMissingNotificationsTableError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.message.includes("notifications") && (error.message.includes("42P01") || error.message.includes("does not exist"));
}

export async function pushNotification(input: NotificationInput) {
  try {
    await supabaseUpsertRows("notifications", [toRow(input)], { onConflict: "id" });
  } catch (error) {
    if (!isMissingNotificationsTableError(error)) {
      throw error;
    }
  }
}

export async function pushNotifications(inputs: NotificationInput[]) {
  if (inputs.length === 0) return;
  try {
    await supabaseUpsertRows(
      "notifications",
      inputs.map((item) => toRow(item)),
      { onConflict: "id" }
    );
  } catch (error) {
    if (!isMissingNotificationsTableError(error)) {
      throw error;
    }
  }
}

