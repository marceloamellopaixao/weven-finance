import { NextRequest, NextResponse } from "next/server";

import { resolveApiErrorStatus } from "@/lib/api/error";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { normalizeCurrency } from "@/lib/money/formatMoney";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
import type { Workspace, WorkspaceSettings, WorkspaceType } from "@/types/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORKSPACE_TYPES = new Set<WorkspaceType>(["personal", "professional", "church", "family", "business"]);

const DEFAULT_NAMES: Record<WorkspaceType, string> = {
  personal: "Minha vida financeira",
  professional: "Meu trabalho",
  church: "Igreja / Ministério",
  family: "Família / Casa",
  business: "Meu negócio",
};

const CATEGORY_PRESETS: Record<WorkspaceType, Array<{ name: string; type: "income" | "expense" }>> = {
  personal: [
    { name: "Salário", type: "income" },
    { name: "Freelance", type: "income" },
    { name: "Reembolso", type: "income" },
    { name: "Investimentos", type: "income" },
    { name: "Alimentação", type: "expense" },
    { name: "Moradia", type: "expense" },
    { name: "Transporte", type: "expense" },
    { name: "Saúde", type: "expense" },
    { name: "Educação", type: "expense" },
    { name: "Lazer", type: "expense" },
    { name: "Cartão de crédito", type: "expense" },
    { name: "Assinaturas", type: "expense" },
  ],
  professional: [
    { name: "Cliente", type: "income" },
    { name: "Projeto", type: "income" },
    { name: "Serviço recorrente", type: "income" },
    { name: "Comissão", type: "income" },
    { name: "Ferramentas", type: "expense" },
    { name: "Internet", type: "expense" },
    { name: "Transporte", type: "expense" },
    { name: "Marketing", type: "expense" },
    { name: "Impostos", type: "expense" },
    { name: "Equipamentos", type: "expense" },
    { name: "Contabilidade", type: "expense" },
  ],
  church: [
    { name: "Dízimos", type: "income" },
    { name: "Ofertas", type: "income" },
    { name: "Missões", type: "income" },
    { name: "Cantina", type: "income" },
    { name: "Eventos", type: "income" },
    { name: "Doações", type: "income" },
    { name: "Aluguel", type: "expense" },
    { name: "Energia", type: "expense" },
    { name: "Água", type: "expense" },
    { name: "Som e mídia", type: "expense" },
    { name: "Departamento infantil", type: "expense" },
    { name: "Jovens", type: "expense" },
    { name: "Missões", type: "expense" },
    { name: "Cesta básica", type: "expense" },
    { name: "Manutenção", type: "expense" },
    { name: "Cantina", type: "expense" },
  ],
  family: [
    { name: "Salário principal", type: "income" },
    { name: "Salário secundário", type: "income" },
    { name: "Ajuda familiar", type: "income" },
    { name: "Mercado", type: "expense" },
    { name: "Aluguel/Financiamento", type: "expense" },
    { name: "Luz", type: "expense" },
    { name: "Água", type: "expense" },
    { name: "Internet", type: "expense" },
    { name: "Escola", type: "expense" },
    { name: "Saúde", type: "expense" },
    { name: "Transporte", type: "expense" },
    { name: "Lazer familiar", type: "expense" },
  ],
  business: [
    { name: "Vendas", type: "income" },
    { name: "Serviços", type: "income" },
    { name: "Mensalidades", type: "income" },
    { name: "Repasses", type: "income" },
    { name: "Fornecedores", type: "expense" },
    { name: "Estoque", type: "expense" },
    { name: "Marketing", type: "expense" },
    { name: "Taxas", type: "expense" },
    { name: "Plataforma", type: "expense" },
    { name: "Impostos", type: "expense" },
    { name: "Operacional", type: "expense" },
  ],
};

function parseType(value: unknown): WorkspaceType | null {
  return typeof value === "string" && WORKSPACE_TYPES.has(value as WorkspaceType) ? (value as WorkspaceType) : null;
}

function parseSettings(value: unknown): WorkspaceSettings {
  const data = (value as WorkspaceSettings | null) || {};
  return {
    currency: normalizeCurrency(data.currency),
    monthlyReportEnabled: data.monthlyReportEnabled !== false,
    categoriesPresetApplied: Boolean(data.categoriesPresetApplied),
  };
}

function toWorkspace(uid: string, row: Record<string, unknown>): Workspace {
  const raw = (row.raw as Record<string, unknown> | null) || {};
  const type = parseType(row.workspace_type ?? raw.type) || "personal";
  const settings = parseSettings(row.settings ?? raw.settings);
  return {
    id: String(row.source_id || raw.id || ""),
    uid,
    name: String(row.name || raw.name || DEFAULT_NAMES[type]),
    type,
    isDefault: Boolean(row.is_default ?? raw.isDefault),
    createdAt: String(row.created_at || raw.createdAt || new Date().toISOString()),
    updatedAt: String(row.updated_at || raw.updatedAt || new Date().toISOString()),
    settings,
  };
}

function toWorkspaceRow(uid: string, workspace: Workspace) {
  const raw = {
    id: workspace.id,
    uid,
    name: workspace.name,
    type: workspace.type,
    isDefault: workspace.isDefault,
    settings: workspace.settings,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
  return {
    id: `${uid}__${workspace.id}`,
    uid,
    source_id: workspace.id,
    name: workspace.name,
    workspace_type: workspace.type,
    is_default: workspace.isDefault,
    settings: workspace.settings,
    raw,
    created_at: workspace.createdAt,
    updated_at: workspace.updatedAt,
  };
}

function toCategoryRow(uid: string, sourceId: string, data: Record<string, unknown>) {
  return {
    id: `${uid}__${sourceId}`,
    uid,
    source_id: sourceId,
    name: data.name ?? "",
    parent_name: null,
    category_type: data.type ?? null,
    color: data.color ?? null,
    is_default: false,
    is_custom: true,
    raw: data,
    created_at: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
  };
}

async function getWorkspaceRows(uid: string) {
  const rows = await supabaseSelect("workspaces", {
    select: "source_id,name,workspace_type,is_default,settings,raw,created_at,updated_at",
    filters: { uid },
    order: "is_default.desc,created_at.asc",
  });
  return rows.map((row) => toWorkspace(uid, row));
}

async function applyCategoryPreset(uid: string, workspaceType: WorkspaceType) {
  const existingRows = await supabaseSelect("categories", {
    select: "name,category_type",
    filters: { uid },
  });
  const existing = new Set(existingRows.map((row) => `${String(row.name || "").toLowerCase()}::${String(row.category_type || "")}`));
  const now = new Date().toISOString();
  const rows = CATEGORY_PRESETS[workspaceType]
    .filter((category) => !existing.has(`${category.name.toLowerCase()}::${category.type}`))
    .map((category) =>
      toCategoryRow(uid, `preset_${workspaceType}_${category.type}_${category.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, {
        ...category,
        color: "bg-zinc-500/10 text-zinc-600 border-zinc-200/50 dark:text-zinc-400 dark:border-zinc-800/50",
        userId: uid,
        isCustom: true,
        workspacePreset: workspaceType,
        createdAt: now,
      })
    );

  if (rows.length > 0) {
    await supabaseUpsertRows("categories", rows, { onConflict: "id" });
  }
}

async function persistWorkspaceSet(uid: string, workspaces: Workspace[]) {
  await supabaseUpsertRows("workspaces", workspaces.map((workspace) => toWorkspaceRow(uid, workspace)), { onConflict: "id" });
}

function buildWorkspace(uid: string, input: { name?: string; type?: unknown; isDefault?: boolean; settings?: WorkspaceSettings }, currentCount: number): Workspace {
  const type = parseType(input.type) || "personal";
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    uid,
    name: input.name?.trim() || DEFAULT_NAMES[type],
    type,
    isDefault: Boolean(input.isDefault) || currentCount === 0,
    createdAt: now,
    updatedAt: now,
    settings: parseSettings({ ...input.settings, categoriesPresetApplied: true }),
  };
}

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:workspaces:get", max: 120, windowMs: 60_000 });
    if (!rate.allowed) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const { actingUid: uid } = await resolveActingContext(request);
    const workspaces = await getWorkspaceRows(uid);
    const defaultWorkspace = workspaces.find((workspace) => workspace.isDefault) || null;
    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json({ ok: true, workspaces, defaultWorkspace }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    apiLogger.error({ message: "workspaces_get_failed", requestId: meta.requestId, route: meta.route, method: meta.method, meta: { error: message } });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:workspaces:post", max: 40, windowMs: 60_000 });
    if (!rate.allowed) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const acting = await resolveActingContext(request);
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "workspaces:create",
      actionLabel: "Criar contexto de conta",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const uid = acting.actingUid;
    const body = (await request.json()) as { name?: string; type?: unknown; isDefault?: boolean; settings?: WorkspaceSettings };
    const type = parseType(body.type);
    if (!type) {
      return NextResponse.json({ ok: false, error: "invalid_workspace_type" }, { status: 400 });
    }

    const current = await getWorkspaceRows(uid);
    const workspace = buildWorkspace(uid, { ...body, type }, current.length);
    const next = workspace.isDefault
      ? [...current.map((item) => ({ ...item, isDefault: false, updatedAt: new Date().toISOString() })), workspace]
      : [...current, workspace];

    await persistWorkspaceSet(uid, next);
    await applyCategoryPreset(uid, workspace.type);
    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json({ ok: true, workspace }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    apiLogger.error({ message: "workspaces_post_failed", requestId: meta.requestId, route: meta.route, method: meta.method, meta: { error: message } });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:workspaces:patch", max: 60, windowMs: 60_000 });
    if (!rate.allowed) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const acting = await resolveActingContext(request);
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "workspaces:update",
      actionLabel: "Atualizar contexto de conta",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const uid = acting.actingUid;
    const body = (await request.json()) as {
      action?: "ensureDefault";
      workspace?: { name?: string; type?: unknown; settings?: WorkspaceSettings };
      id?: string;
      name?: string;
      type?: unknown;
      isDefault?: boolean;
      settings?: WorkspaceSettings;
    };
    const current = await getWorkspaceRows(uid);

    if (body.action === "ensureDefault") {
      const existingDefault = current.find((workspace) => workspace.isDefault);
      if (existingDefault) {
        return NextResponse.json({ ok: true, defaultWorkspace: existingDefault }, { status: 200 });
      }
      const workspace = buildWorkspace(uid, { ...body.workspace, isDefault: true }, current.length);
      const next = [...current.map((item) => ({ ...item, isDefault: false, updatedAt: new Date().toISOString() })), workspace];
      await persistWorkspaceSet(uid, next);
      await applyCategoryPreset(uid, workspace.type);
      return NextResponse.json({ ok: true, defaultWorkspace: workspace }, { status: 200 });
    }

    if (!body.id) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const target = current.find((workspace) => workspace.id === body.id);
    if (!target) {
      return NextResponse.json({ ok: false, error: "workspace_not_found" }, { status: 404 });
    }

    const nextType = body.type === undefined ? target.type : parseType(body.type);
    if (!nextType) {
      return NextResponse.json({ ok: false, error: "invalid_workspace_type" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const updated: Workspace = {
      ...target,
      name: body.name?.trim() || target.name,
      type: nextType,
      isDefault: typeof body.isDefault === "boolean" ? body.isDefault : target.isDefault,
      settings: parseSettings({ ...target.settings, ...body.settings }),
      updatedAt: now,
    };
    const next = current.map((workspace) =>
      workspace.id === updated.id
        ? updated
        : updated.isDefault
          ? { ...workspace, isDefault: false, updatedAt: now }
          : workspace
    );
    await persistWorkspaceSet(uid, next);
    if (updated.settings?.categoriesPresetApplied !== true || updated.type !== target.type) {
      await applyCategoryPreset(uid, updated.type);
    }

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json({ ok: true, workspace: updated }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    apiLogger.error({ message: "workspaces_patch_failed", requestId: meta.requestId, route: meta.route, method: meta.method, meta: { error: message } });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
