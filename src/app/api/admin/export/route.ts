import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { supabaseSelect } from "@/services/supabase/admin";

type StaffRole = "admin" | "moderator" | "support" | "client";

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  if (/[",;\n]/.test(text)) return `"${text.replace(/"/g, "\"\"")}"`;
  return text;
}

function toCsv(headers: string[], rows: Array<Array<unknown>>) {
  return [headers, ...rows]
    .map((line) => line.map((cell) => escapeCsv(cell)).join(";"))
    .join("\n");
}

async function getAuthContext(request: NextRequest) {
  const decoded = await verifyRequestAuth(request);
  const rows = await supabaseSelect("profiles", { filters: { uid: decoded.uid }, limit: 1 });
  if (rows.length === 0) throw new Error("user_not_found");
  const row = rows[0];
  const raw = (row.raw as Record<string, unknown> | null) ?? {};
  const role = String(row.role || raw.role || "client") as StaffRole;
  return { uid: decoded.uid, role };
}

function isStaff(role: StaffRole) {
  return role === "admin" || role === "moderator" || role === "support";
}

function isManager(role: StaffRole) {
  return role === "admin" || role === "moderator";
}

function buildCsvResponse(filename: string, csv: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Cache-Control": "no-store",
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:admin-export:get", max: 20, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const auth = await getAuthContext(request);
    const kind = String(request.nextUrl.searchParams.get("kind") || "").toLowerCase();
    const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() || "";

    if (!kind || !["users", "support", "audit"].includes(kind)) {
      return NextResponse.json({ ok: false, error: "invalid_kind" }, { status: 400 });
    }
    if (!isStaff(auth.role)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    if (kind === "users") {
      if (!isManager(auth.role)) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }

      const role = request.nextUrl.searchParams.get("role")?.trim();
      const plan = request.nextUrl.searchParams.get("plan")?.trim();
      const status = request.nextUrl.searchParams.get("status")?.trim();
      const paymentStatus = request.nextUrl.searchParams.get("paymentStatus")?.trim();

      const rows = await supabaseSelect("profiles", {
        select: "uid,email,display_name,role,plan,status,payment_status,transaction_count,created_at",
        order: "created_at.desc.nullslast",
        limit: 5000,
      });

      const mapped = rows.filter((row) => {
        const displayName = String(row.display_name || "");
        const email = String(row.email || "");
        const rowRole = String(row.role || "client");
        const rowPlan = String(row.plan || "free");
        const rowStatus = String(row.status || "active");
        const rowPayment = String(row.payment_status || "pending");

        const matchesQ = !q || displayName.toLowerCase().includes(q) || email.toLowerCase().includes(q);
        const matchesRole = !role || role === "all" || rowRole === role;
        const matchesPlan = !plan || plan === "all" || rowPlan === plan;
        const matchesStatus = !status || status === "all" || rowStatus === status;
        const matchesPayment =
          !paymentStatus ||
          paymentStatus === "all" ||
          (paymentStatus === "unpaid_group"
            ? rowPayment !== "paid" && rowPayment !== "free"
            : rowPayment === paymentStatus);

        return matchesQ && matchesRole && matchesPlan && matchesStatus && matchesPayment;
      });

      const csv = toCsv(
        ["uid", "nome", "email", "plano", "cargo", "status", "pagamento", "lançamentos", "criado_em"],
        mapped.map((row) => [
          row.uid,
          row.display_name,
          row.email,
          row.plan,
          row.role,
          row.status,
          row.payment_status,
          row.transaction_count,
          row.created_at,
        ])
      );

      await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
      return buildCsvResponse(`admin-usuarios-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    }

    if (kind === "support") {
      const type = request.nextUrl.searchParams.get("type")?.trim();
      const status = request.nextUrl.searchParams.get("status")?.trim();
      const priority = request.nextUrl.searchParams.get("priority")?.trim();

      const rows = await supabaseSelect("support_requests", {
        select: "id,uid,email,name,message,ticket_type,ticket_status,assigned_to_name,created_at,raw",
        order: "created_at.desc.nullslast",
        limit: 5000,
      });

      const filtered = rows.filter((row) => {
        const rowType = String(row.ticket_type || "support");
        const rowStatus = String(row.ticket_status || "pending");
        const raw = ((row.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
        const rowPriority = String(raw.priority || "medium");
        const protocol = String(raw.protocol || "");
        const message = String(row.message || "");
        const name = String(row.name || "");
        const email = String(row.email || "");
        const matchesQ = !q || `${protocol} ${message} ${name} ${email}`.toLowerCase().includes(q);
        const matchesType = !type || type === "all" || rowType === type;
        const matchesStatus = !status || status === "all" || rowStatus === status;
        const matchesPriority = !priority || priority === "all" || rowPriority === priority;
        return matchesQ && matchesType && matchesStatus && matchesPriority;
      });

      const csv = toCsv(
        ["id", "protocolo", "tipo", "status", "prioridade", "solicitante", "email", "responsável", "mensagem", "criado_em"],
        filtered.map((row) => {
          const raw = ((row.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
          return [
            row.id,
            raw.protocol || "",
            row.ticket_type,
            row.ticket_status,
            raw.priority || "medium",
            row.name,
            row.email,
            row.assigned_to_name || "",
            row.message,
            row.created_at,
          ];
        })
      );
      await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
      return buildCsvResponse(`admin-suporte-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    }

    const action = request.nextUrl.searchParams.get("action")?.trim();
    const actorUid = request.nextUrl.searchParams.get("actorUid")?.trim();
    const targetUid = request.nextUrl.searchParams.get("targetUid")?.trim();
    const from = request.nextUrl.searchParams.get("from")?.trim();
    const to = request.nextUrl.searchParams.get("to")?.trim();
    const rows = await supabaseSelect("admin_audit_logs", {
      select: "id,actor_uid,action,target_uid,route,method,ip,details,created_at",
      order: "created_at.desc.nullslast",
      limit: 5000,
    });

    const filtered = rows.filter((row) => {
      if (action && action !== "all" && String(row.action || "") !== action) return false;
      if (actorUid && String(row.actor_uid || "") !== actorUid) return false;
      if (targetUid && String(row.target_uid || "") !== targetUid) return false;
      if (from && typeof row.created_at === "string" && row.created_at < `${from}T00:00:00.000Z`) return false;
      if (to && typeof row.created_at === "string" && row.created_at > `${to}T23:59:59.999Z`) return false;
      if (!q) return true;
      const blob = JSON.stringify({
        action: row.action,
        actor_uid: row.actor_uid,
        target_uid: row.target_uid,
        route: row.route,
        method: row.method,
        details: row.details,
      }).toLowerCase();
      return blob.includes(q);
    });

    const csv = toCsv(
      ["id", "ator_uid", "ação", "alvo_uid", "rota", "método", "ip", "detalhes", "criado_em"],
      filtered.map((row) => [
        row.id,
        row.actor_uid,
        row.action,
        row.target_uid,
        row.route,
        row.method,
        row.ip,
        JSON.stringify((row.details as Record<string, unknown> | null) ?? {}),
        row.created_at,
      ])
    );

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
    return buildCsvResponse(`admin-auditoria-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    apiLogger.error({
      message: "admin_export_get_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { error: message },
    });
    const status = message === "missing_auth_token" ? 401 : message === "forbidden" ? 403 : 500;
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

