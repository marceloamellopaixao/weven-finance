import "server-only";

type QueryValue = string | number | boolean | null | undefined;

function sanitizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function getSupabaseBaseUrl() {
  const value = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error("missing_supabase_env");
  }
  return sanitizeBaseUrl(value);
}

function getSupabaseServerKey() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) {
    throw new Error("missing_supabase_env");
  }
  return value;
}

export function isSupabaseReadEnabled() {
  return process.env.SUPABASE_READS_ENABLED === "true";
}

export function isSupabaseWriteEnabled() {
  return process.env.SUPABASE_WRITES_ENABLED === "true";
}

function toFilterValue(value: QueryValue) {
  if (value === null) return "is.null";
  if (typeof value === "boolean") return `eq.${value ? "true" : "false"}`;
  return `eq.${encodeURIComponent(String(value))}`;
}

export async function supabaseSelect(
  table: string,
  options?: {
    select?: string;
    filters?: Record<string, QueryValue>;
    conditions?: Record<string, string | string[]>;
    or?: string;
    order?: string;
    limit?: number;
  }
) {
  const baseUrl = getSupabaseBaseUrl();
  const serviceKey = getSupabaseServerKey();

  const params = new URLSearchParams();
  params.set("select", options?.select || "*");
  if (options?.order) params.set("order", options.order);
  if (options?.limit && options.limit > 0) params.set("limit", String(options.limit));

  if (options?.filters) {
    for (const [field, value] of Object.entries(options.filters)) {
      if (value === undefined) continue;
      params.set(field, toFilterValue(value));
    }
  }
  if (options?.conditions) {
    for (const [field, condition] of Object.entries(options.conditions)) {
      if (!condition) continue;
      if (Array.isArray(condition)) {
        for (const value of condition) {
          if (!value) continue;
          params.append(field, value);
        }
        continue;
      }
      params.set(field, condition);
    }
  }
  if (options?.or) {
    params.set("or", options.or.startsWith("(") ? options.or : `(${options.or})`);
  }

  const response = await fetch(`${baseUrl}/rest/v1/${table}?${params.toString()}`, {
    method: "GET",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`supabase_select_failed_${table}_${response.status}:${body}`);
  }

  const data = (await response.json()) as Array<Record<string, unknown>>;
  return data;
}

export async function supabaseSelectPaged(
  table: string,
  options?: {
    select?: string;
    filters?: Record<string, QueryValue>;
    conditions?: Record<string, string | string[]>;
    or?: string;
    order?: string;
    page?: number;
    limit?: number;
  }
) {
  const baseUrl = getSupabaseBaseUrl();
  const serviceKey = getSupabaseServerKey();

  const page = Math.max(1, Number(options?.page || 1));
  const limit = Math.max(1, Math.min(200, Number(options?.limit || 20)));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const params = new URLSearchParams();
  params.set("select", options?.select || "*");
  if (options?.order) params.set("order", options.order);

  if (options?.filters) {
    for (const [field, value] of Object.entries(options.filters)) {
      if (value === undefined) continue;
      params.set(field, toFilterValue(value));
    }
  }
  if (options?.conditions) {
    for (const [field, condition] of Object.entries(options.conditions)) {
      if (!condition) continue;
      if (Array.isArray(condition)) {
        for (const value of condition) {
          if (!value) continue;
          params.append(field, value);
        }
        continue;
      }
      params.set(field, condition);
    }
  }
  if (options?.or) {
    params.set("or", options.or.startsWith("(") ? options.or : `(${options.or})`);
  }

  const response = await fetch(`${baseUrl}/rest/v1/${table}?${params.toString()}`, {
    method: "GET",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "count=exact",
      "Range-Unit": "items",
      Range: `${from}-${to}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`supabase_select_paged_failed_${table}_${response.status}:${body}`);
  }

  const data = (await response.json()) as Array<Record<string, unknown>>;
  const contentRange = response.headers.get("content-range") || "";
  const match = contentRange.match(/\/(\d+)$/);
  const total = match ? Number(match[1]) : data.length;

  return { data, total, page, limit };
}

export async function supabaseUpsertRows(
  table: string,
  rows: Array<Record<string, unknown>>,
  options?: { onConflict?: string }
) {
  if (rows.length === 0) return;
  const baseUrl = getSupabaseBaseUrl();
  const serviceKey = getSupabaseServerKey();
  const onConflict = options?.onConflict;
  const url = onConflict
    ? `${baseUrl}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`
    : `${baseUrl}/rest/v1/${table}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`supabase_upsert_failed_${table}_${response.status}:${body}`);
  }
}

export async function supabaseDeleteByFilters(
  table: string,
  filters: Record<string, QueryValue>
) {
  const baseUrl = getSupabaseBaseUrl();
  const serviceKey = getSupabaseServerKey();
  const params = new URLSearchParams();
  for (const [field, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    params.set(field, toFilterValue(value));
  }

  const response = await fetch(`${baseUrl}/rest/v1/${table}?${params.toString()}`, {
    method: "DELETE",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`supabase_delete_failed_${table}_${response.status}:${body}`);
  }
}

export async function supabaseRpc(functionName: string, args?: Record<string, unknown>) {
  const baseUrl = getSupabaseBaseUrl();
  const serviceKey = getSupabaseServerKey();
  const response = await fetch(`${baseUrl}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args ?? {}),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`supabase_rpc_failed_${functionName}_${response.status}:${body}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as unknown;
  }

  return null;
}
