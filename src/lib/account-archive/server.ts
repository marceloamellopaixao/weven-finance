import { isDeletionWindowExpired } from "@/lib/account-deletion/policy";
import { readSecureProfilePayload } from "@/lib/secure-store/profile";
import { supabaseDeleteByFilters, supabasePatchByFilters, supabaseSelect } from "@/services/supabase/admin";
import { deleteSupabaseAuthUser, resolveSupabaseAuthUserId } from "@/services/supabase/service-client";

type JsonFieldName = "raw" | "data" | "meta";

type ArchiveConfig = {
  table: string;
  jsonField: JsonFieldName;
  select: string;
  idField?: string;
  extraFields?: string[];
  filters?: Record<string, string>;
};

const ARCHIVE_CONFIGS: ArchiveConfig[] = [
  {
    table: "categories",
    jsonField: "raw",
    select: "id,uid,source_id,raw",
    extraFields: ["uid", "source_id"],
  },
  {
    table: "transactions",
    jsonField: "raw",
    select: "id,uid,source_id,raw",
    extraFields: ["uid", "source_id"],
  },
  {
    table: "payment_cards",
    jsonField: "raw",
    select: "id,uid,source_id,raw",
    extraFields: ["uid", "source_id"],
  },
  {
    table: "piggy_banks",
    jsonField: "raw",
    select: "id,uid,source_id,raw",
    extraFields: ["uid", "source_id"],
  },
  {
    table: "piggy_bank_history",
    jsonField: "raw",
    select: "id,uid,source_id,raw",
    extraFields: ["uid", "source_id"],
  },
  {
    table: "user_settings",
    jsonField: "data",
    select: "id,uid,setting_key,data",
    extraFields: ["uid", "setting_key"],
  },
  {
    table: "notifications",
    jsonField: "meta",
    select: "id,uid,meta",
    extraFields: ["uid"],
  },
  {
    table: "support_requests",
    jsonField: "raw",
    select: "id,uid,raw",
    extraFields: ["uid"],
  },
];

function getJsonObject(row: Record<string, unknown>, field: JsonFieldName) {
  const value = row[field];
  return ((value as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
}

export function isArchivedJsonRecord(row: Record<string, unknown>, field: JsonFieldName = "raw") {
  const json = getJsonObject(row, field);
  return Boolean(json.isArchived);
}

export function filterActiveJsonRows(rows: Array<Record<string, unknown>>, field: JsonFieldName = "raw") {
  return rows.filter((row) => !isArchivedJsonRecord(row, field));
}

export async function setArchivedStateForUserData(uid: string, archived: boolean) {
  for (const config of ARCHIVE_CONFIGS) {
    const rows = await supabaseSelect(config.table, {
      select: config.select,
      filters: { uid, ...(config.filters ?? {}) },
    });

    if (rows.length === 0) continue;

    const upserts = rows.map((row) => {
      const json = getJsonObject(row, config.jsonField);
      return {
        rowId: row[config.idField ?? "id"],
        nextJson: {
          ...json,
          isArchived: archived,
          archivedAt: archived ? new Date().toISOString() : null,
        },
      };
    });

    for (const entry of upserts) {
      if (entry.rowId === undefined || entry.rowId === null || entry.rowId === "") continue;
      await supabasePatchByFilters(
        config.table,
        { [config.idField ?? "id"]: String(entry.rowId) },
        { [config.jsonField]: entry.nextJson }
      );
    }
  }
}

async function deleteRowsByIds(table: string, ids: string[]) {
  for (const id of ids) {
    if (!id) continue;
    await supabaseDeleteByFilters(table, { id });
  }
}

async function deleteRowsByUidSourceId(table: string, uid: string) {
  const rows = await supabaseSelect(table, {
    select: "source_id",
    filters: { uid },
  });

  for (const row of rows) {
    const sourceId = String(row.source_id || "");
    if (!sourceId) continue;
    await supabaseDeleteByFilters(table, { uid, source_id: sourceId });
  }
}

async function deleteUserCoreRows(uid: string) {
  await deleteRowsByUidSourceId("categories", uid);
  await deleteRowsByUidSourceId("transactions", uid);
  await deleteRowsByUidSourceId("payment_cards", uid);
  await deleteRowsByUidSourceId("piggy_bank_history", uid);
  await deleteRowsByUidSourceId("piggy_banks", uid);

  const userSettingsRows = await supabaseSelect("user_settings", {
    select: "id",
    filters: { uid },
  });
  await deleteRowsByIds("user_settings", userSettingsRows.map((row) => String(row.id || "")));

  const notificationRows = await supabaseSelect("notifications", {
    select: "id",
    filters: { uid },
  });
  await deleteRowsByIds("notifications", notificationRows.map((row) => String(row.id || "")));
}

export async function permanentlyDeleteUserData(uid: string, options?: { email?: string | null }) {
  const normalizedEmail = String(options?.email || "").trim().toLowerCase();

  await deleteUserCoreRows(uid);

  const supportRows = await supabaseSelect("support_requests", {
    select: "id,uid,email,raw",
  });
  const supportIds = supportRows
    .filter((row) => {
      const raw = (row.raw as Record<string, unknown> | null) ?? {};
      const rowEmail = String(row.email || raw.email || "").trim().toLowerCase();
      const targetUid = String(raw.targetUid || "");
      return String(row.uid || "") === uid || targetUid === uid || (normalizedEmail && rowEmail === normalizedEmail);
    })
    .map((row) => String(row.id || ""));
  await deleteRowsByIds("support_requests", supportIds);

  const billingEvents = await supabaseSelect("billing_events", {
    select: "id",
    filters: { uid },
  });
  await deleteRowsByIds("billing_events", billingEvents.map((row) => String(row.id || "")));

  const supportAccessRows = await supabaseSelect("support_access_requests", {
    select: "id,requester_uid,target_uid",
  });
  await deleteRowsByIds(
    "support_access_requests",
    supportAccessRows
      .filter((row) => String(row.requester_uid || "") === uid || String(row.target_uid || "") === uid)
      .map((row) => String(row.id || ""))
  );

  const impersonationActionRows = await supabaseSelect("impersonation_action_requests", {
    select: "id,requester_uid,target_uid",
  });
  await deleteRowsByIds(
    "impersonation_action_requests",
    impersonationActionRows
      .filter((row) => String(row.requester_uid || "") === uid || String(row.target_uid || "") === uid)
      .map((row) => String(row.id || ""))
  );

  const accessLogRows = await supabaseSelect("log_acesso_suporte", {
    select: "id,id_user,id_user_impersonate",
  });
  await deleteRowsByIds(
    "log_acesso_suporte",
    accessLogRows
      .filter((row) => String(row.id_user || "") === uid || String(row.id_user_impersonate || "") === uid)
      .map((row) => String(row.id || ""))
  );

  const auditRows = await supabaseSelect("admin_audit_logs", {
    select: "id,actor_uid,target_uid",
  });
  await deleteRowsByIds(
    "admin_audit_logs",
    auditRows
      .filter((row) => String(row.actor_uid || "") === uid || String(row.target_uid || "") === uid)
      .map((row) => String(row.id || ""))
  );

  const metricRows = await supabaseSelect("api_request_metrics", {
    select: "id",
    filters: { uid },
  });
  await deleteRowsByIds("api_request_metrics", metricRows.map((row) => String(row.id || "")));

  const notificationReferenceRows = await supabaseSelect("notifications", {
    select: "id,meta",
  });
  const notificationReferenceIds = notificationReferenceRows
    .filter((row) => {
      const meta = (row.meta as Record<string, unknown> | null) ?? {};
      return String(meta.targetUid || "") === uid || String(meta.fromUid || "") === uid;
    })
    .map((row) => String(row.id || ""));
  await deleteRowsByIds("notifications", notificationReferenceIds);

  await supabaseDeleteByFilters("profiles", { uid });
}

export async function runDeletedAccountGraceCleanup(now = new Date()) {
  const profiles = await supabaseSelect("profiles", {
    select: "uid,email,status,deleted_at,raw",
    filters: { status: "deleted" },
  });

  let purged = 0;
  let failed = 0;
  let skipped = 0;
  const errors: Array<{ uid: string; error: string }> = [];

  for (const profile of profiles) {
    const uid = String(profile.uid || "").trim();
    const raw = readSecureProfilePayload(profile.raw);
    const deletedAt =
      typeof profile.deleted_at === "string" ? profile.deleted_at : typeof raw.deletedAt === "string" ? raw.deletedAt : null;

    if (!uid || !isDeletionWindowExpired(deletedAt, raw, now)) {
      skipped += 1;
      continue;
    }

    try {
      const email = String(profile.email || raw.email || "").trim().toLowerCase();
      const authUserId = await resolveSupabaseAuthUserId({
        rawUid: typeof raw.authUserId === "string" ? raw.authUserId : null,
        uid,
        email,
      });

      await permanentlyDeleteUserData(uid, { email });

      if (authUserId) {
        await deleteSupabaseAuthUser(authUserId);
      }

      purged += 1;
    } catch (error) {
      failed += 1;
      errors.push({
        uid,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  return {
    scanned: profiles.length,
    purged,
    skipped,
    failed,
    processedAt: now.toISOString(),
    errors,
  };
}
