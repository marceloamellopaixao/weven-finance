import { NextRequest, NextResponse } from "next/server";

import { resolveApiErrorStatus } from "@/lib/api/error";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { normalizeCurrency } from "@/lib/money/formatMoney";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { getDefaultCategoriesForWorkspaceType } from "@/lib/categories/defaultCategories";
import { canPlanUseProfile } from "@/lib/plans/catalog";
import { getUserPlanContext } from "@/lib/plans/server";
import { canAccessAdminArea } from "@/lib/access-control/roles";
import { supabaseDeleteByFilters, supabasePatchByFilters, supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
import { toFinancialProfileType, type Workspace, type WorkspaceSettings, type WorkspaceType } from "@/types/workspace";
import { ensureFamilyManagerMembership, getActiveMemberships, toWorkspaceMember } from "@/lib/workspaces/server";

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


function parseType(value: unknown): WorkspaceType | null {
  return typeof value === "string" && WORKSPACE_TYPES.has(value as WorkspaceType) ? (value as WorkspaceType) : null;
}

function normalizeWorkspaceType(type: WorkspaceType): WorkspaceType {
  return type === "professional" || type === "church" ? "business" : type;
}

function assertDocumentAllowed(type: WorkspaceType, settings?: WorkspaceSettings) {
  const document = typeof settings?.businessDocument === "string" ? settings.businessDocument.replace(/\D/g, "") : "";
  if (document && type !== "business") {
    throw new Error("Para controlar um negócio, MEI, igreja, projeto profissional ou qualquer atividade com CNPJ, use o perfil Business/PJ.");
  }
}

async function assertPlanCanUseWorkspace(uid: string, type: WorkspaceType) {
  const [planContext, memberships] = await Promise.all([
    getUserPlanContext(uid),
    getActiveMemberships(uid),
  ]);
  const profileType = toFinancialProfileType(type);
  if (canAccessAdminArea({ uid, role: planContext.role }) || canPlanUseProfile(planContext.plan, profileType)) return;
  if (memberships.some((membership) => membership.workspaceUid !== uid)) {
    throw new Error("Enquanto você participar de um perfil compartilhado, não é possível criar ou reativar outro perfil financeiro.");
  }
  if (profileType === "family") {
    throw new Error("Para criar um perfil Família, escolha o plano Família.");
  }
  if (profileType === "business") {
    throw new Error("Para controlar MEI, CNPJ, igreja, projeto profissional ou pequeno negócio, escolha o plano Business/PJ.");
  }
  throw new Error("Este tipo de perfil não está disponível no seu plano atual.");
}

function parseSettings(value: unknown): WorkspaceSettings {
  const data = (value as WorkspaceSettings | null) || {};
  const archivedAt = typeof data.archivedAt === "string" && data.archivedAt ? data.archivedAt : undefined;
  return {
    currency: normalizeCurrency(data.currency),
    monthlyReportEnabled: data.monthlyReportEnabled !== false,
    categoriesPresetApplied: Boolean(data.categoriesPresetApplied),
    familyModeEnabled: Boolean(data.familyModeEnabled),
    businessDocument: typeof data.businessDocument === "string" ? data.businessDocument.replace(/\D/g, "").slice(0, 14) : undefined,
    archivedAt,
  };
}

function getWorkspaceErrorStatus(message: string) {
  if (message.includes("CNPJ")) return 400;
  if (message.startsWith("Enquanto você participar")) return 409;
  if (message.startsWith("Para criar um perfil") || message.startsWith("Para controlar")) return 403;
  return resolveApiErrorStatus(message);
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
    status: settings.archivedAt ? "archived" : "active",
    createdAt: String(row.created_at || raw.createdAt || new Date().toISOString()),
    updatedAt: String(row.updated_at || raw.updatedAt || new Date().toISOString()),
    settings,
  };
}

function toSharedWorkspace(row: Record<string, unknown>, uid: string, membership: ReturnType<typeof toWorkspaceMember>): Workspace {
  const workspace = toWorkspace(uid, row);
  return {
    ...workspace,
    uid,
    ownerUid: String(row.uid || uid),
    isDefault: false,
    membership,
  };
}

function toWorkspaceRow(uid: string, workspace: Workspace) {
  const raw = {
    id: workspace.id,
    uid,
    name: workspace.name,
    type: workspace.type,
    isDefault: workspace.isDefault,
    status: workspace.status || "active",
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

function isMissingCategoryWorkspaceColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("workspace_id") || message.includes("PGRST204");
}

function withoutWorkspaceColumn(row: Record<string, unknown>) {
  const { workspace_id: _workspaceId, ...legacyRow } = row;
  void _workspaceId;
  return legacyRow;
}

async function upsertCategoryRows(rows: Array<Record<string, unknown>>) {
  try {
    await supabaseUpsertRows("categories", rows, { onConflict: "id" });
  } catch (error) {
    if (!isMissingCategoryWorkspaceColumn(error)) throw error;
    await supabaseUpsertRows("categories", rows.map(withoutWorkspaceColumn), { onConflict: "id" });
  }
}

function toCategoryRow(uid: string, sourceId: string, data: Record<string, unknown>, workspaceId?: string | null) {
  return {
    id: `${uid}__${sourceId}`,
    uid,
    workspace_id: workspaceId || null,
    source_id: sourceId,
    name: data.name ?? "",
    parent_name: null,
    category_type: data.type ?? null,
    color: data.color ?? null,
    is_default: false,
    is_custom: true,
    raw: { ...data, workspaceId: workspaceId || null },
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

function isWorkspaceActive(workspace: Workspace) {
  return workspace.status !== "archived" && !workspace.settings?.archivedAt;
}

async function getProfileSummary(uid: string) {
  const rows = await supabaseSelect("profiles", {
    select: "uid,email,display_name,complete_name,raw",
    filters: { uid },
    limit: 1,
  });
  const row = rows[0] || {};
  const raw = (row.raw as Record<string, unknown> | null) || {};
  return {
    email: String(row.email || raw.email || ""),
    displayName: String(row.display_name || raw.displayName || row.complete_name || raw.completeName || row.email || raw.email || "Gestor"),
  };
}

async function applyCategoryPreset(uid: string, workspaceType: WorkspaceType, workspaceId: string) {
  let existingRows: Record<string, unknown>[];
  try {
    existingRows = await supabaseSelect("categories", {
      select: "name,category_type,workspace_id,raw",
      filters: { uid },
    });
  } catch (error) {
    if (!isMissingCategoryWorkspaceColumn(error)) throw error;
    existingRows = await supabaseSelect("categories", {
      select: "name,category_type,raw",
      filters: { uid },
    });
  }
  const workspaceRows = existingRows.filter((row) => {
    const raw = (row.raw as Record<string, unknown> | null) || {};
    return String(row.workspace_id || raw.workspaceId || "") === workspaceId;
  });
  const existing = new Set(workspaceRows.map((row) => `${String(row.name || "").toLowerCase()}::${String(row.category_type || "")}`));
  const now = new Date().toISOString();
  const rows = getDefaultCategoriesForWorkspaceType(workspaceType)
    .filter((category) => !existing.has(`${category.name.toLowerCase()}::${category.type}`))
    .map((category) =>
      toCategoryRow(uid, `preset_${workspaceId}_${workspaceType}_${category.type}_${category.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, {
        ...category,
        userId: uid,
        isCustom: true,
        workspacePreset: workspaceType,
        createdAt: now,
      }, workspaceId)
    );

  if (rows.length > 0) {
    await upsertCategoryRows(rows);
  }
}

async function persistWorkspaceSet(uid: string, workspaces: Workspace[]) {
  await supabaseUpsertRows("workspaces", workspaces.map((workspace) => toWorkspaceRow(uid, workspace)), { onConflict: "id" });
}

async function ensureFamilyOwnerIfNeeded(uid: string, workspace: Workspace) {
  if (workspace.type !== "family") return;
  const profile = await getProfileSummary(uid);
  await ensureFamilyManagerMembership({
    workspaceUid: uid,
    workspaceId: workspace.id,
    email: profile.email,
    displayName: profile.displayName,
  });
}

async function clearFamilyAccess(uid: string, workspaceId: string, now: string) {
  try {
    await supabasePatchByFilters(
      "workspace_members",
      { workspace_uid: uid, workspace_id: workspaceId },
      { member_status: "disabled", updated_at: now, raw: { status: "disabled", archivedAt: now } },
    );
    await supabasePatchByFilters(
      "workspace_invitations",
      { workspace_uid: uid, workspace_id: workspaceId },
      { invitation_status: "revoked", updated_at: now, raw: { status: "revoked", archivedAt: now } },
    );
  } catch {
    // Older installs may not have family tables yet.
  }
}

async function deleteWorkspaceFinancialData(uid: string, workspaceId: string) {
  const tables = ["transactions", "categories", "payment_cards", "piggy_banks", "piggy_bank_history"];
  for (const table of tables) {
    try {
      await supabaseDeleteByFilters(table, { uid, workspace_id: workspaceId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "");
      if (!message.includes("workspace_id") && !message.includes("PGRST204")) throw error;
    }
  }
  try {
    await supabaseDeleteByFilters("user_settings", { uid, setting_key: `categories:${workspaceId}` });
  } catch {
    // Non-critical cleanup.
  }
}

function buildWorkspace(uid: string, input: { name?: string; type?: unknown; isDefault?: boolean; settings?: WorkspaceSettings }, currentCount: number): Workspace {
  const type = normalizeWorkspaceType(parseType(input.type) || "personal");
  assertDocumentAllowed(type, input.settings);
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
    const [ownedWorkspaces, memberships, planContext] = await Promise.all([
      getWorkspaceRows(uid),
      getActiveMemberships(uid),
      getUserPlanContext(uid),
    ]);
    const sharedRows =
      memberships.length > 0
        ? await Promise.all(
            memberships
              .filter((member) => member.workspaceUid !== uid)
              .map(async (member) => {
                const rows = await supabaseSelect("workspaces", {
                  select: "uid,source_id,name,workspace_type,is_default,settings,raw,created_at,updated_at",
                  filters: { uid: member.workspaceUid, source_id: member.workspaceId },
                  limit: 1,
                });
                const workspace = rows[0] ? toSharedWorkspace(rows[0], uid, member) : null;
                return workspace && isWorkspaceActive(workspace) ? workspace : null;
              }),
          )
        : [];
    const activeSharedWorkspaces = sharedRows.filter((workspace): workspace is Workspace => Boolean(workspace));
    const isStaff = canAccessAdminArea({ uid, role: planContext.role });
    const workspaces = isStaff
      ? [...ownedWorkspaces, ...activeSharedWorkspaces]
      : activeSharedWorkspaces.length > 0
        ? activeSharedWorkspaces
        : ownedWorkspaces.filter((workspace) => canPlanUseProfile(planContext.plan, toFinancialProfileType(workspace.type)));
    const defaultWorkspace = workspaces.find((workspace) => workspace.isDefault && isWorkspaceActive(workspace)) || null;
    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json({ ok: true, workspaces, defaultWorkspace }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = getWorkspaceErrorStatus(message);
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
      actionLabel: "Criar perfil financeiro",
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
    const activeCurrent = current.filter(isWorkspaceActive);
    const workspace = buildWorkspace(uid, { ...body, type }, current.length);
    const workspaceToPersist = activeCurrent.length === 0 ? { ...workspace, isDefault: true } : workspace;
    await assertPlanCanUseWorkspace(uid, workspace.type);
    const next = workspaceToPersist.isDefault
      ? [...current.map((item) => ({ ...item, isDefault: false, updatedAt: new Date().toISOString() })), workspaceToPersist]
      : [...current, workspaceToPersist];

    await persistWorkspaceSet(uid, next);
    await ensureFamilyOwnerIfNeeded(uid, workspaceToPersist);
    await applyCategoryPreset(uid, workspaceToPersist.type, workspaceToPersist.id);
    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json({ ok: true, workspace: workspaceToPersist }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = getWorkspaceErrorStatus(message);
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
      actionLabel: "Atualizar perfil financeiro",
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
      const existingDefault = current.find((workspace) => workspace.isDefault && isWorkspaceActive(workspace));
      if (existingDefault) {
        return NextResponse.json({ ok: true, defaultWorkspace: existingDefault }, { status: 200 });
      }
      const workspace = buildWorkspace(uid, { ...body.workspace, isDefault: true }, current.length);
      await assertPlanCanUseWorkspace(uid, workspace.type);
      const next = [...current.map((item) => ({ ...item, isDefault: false, updatedAt: new Date().toISOString() })), workspace];
      await persistWorkspaceSet(uid, next);
      await ensureFamilyOwnerIfNeeded(uid, workspace);
      await applyCategoryPreset(uid, workspace.type, workspace.id);
      return NextResponse.json({ ok: true, defaultWorkspace: workspace }, { status: 200 });
    }

    if (!body.id) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const target = current.find((workspace) => workspace.id === body.id);
    if (!target) {
      return NextResponse.json({ ok: false, error: "workspace_not_found" }, { status: 404 });
    }

    const parsedNextType = body.type === undefined ? target.type : parseType(body.type);
    if (!parsedNextType) {
      return NextResponse.json({ ok: false, error: "invalid_workspace_type" }, { status: 400 });
    }
    const nextType = normalizeWorkspaceType(parsedNextType);
    assertDocumentAllowed(nextType, { ...target.settings, ...body.settings });
    if (nextType !== target.type) {
      await assertPlanCanUseWorkspace(uid, nextType);
    }
    const now = new Date().toISOString();
    const nextSettings = parseSettings({ ...target.settings, ...body.settings });
    const restoringArchived = Boolean(target.settings?.archivedAt) && body.settings && "archivedAt" in body.settings && !body.settings.archivedAt;
    if (restoringArchived) {
      await assertPlanCanUseWorkspace(uid, nextType);
    }
    const activeAfterRestore = current.filter((workspace) => workspace.id !== target.id && isWorkspaceActive(workspace));
    const updated: Workspace = {
      ...target,
      name: body.name?.trim() || target.name,
      type: nextType,
      isDefault: nextSettings.archivedAt ? false : typeof body.isDefault === "boolean" ? body.isDefault : restoringArchived && activeAfterRestore.length === 0 ? true : target.isDefault,
      status: nextSettings.archivedAt ? "archived" : "active",
      settings: nextSettings,
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
    await ensureFamilyOwnerIfNeeded(uid, updated);
    if (updated.settings?.categoriesPresetApplied !== true || updated.type !== target.type) {
      await applyCategoryPreset(uid, updated.type, updated.id);
    }

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json({ ok: true, workspace: updated }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = getWorkspaceErrorStatus(message);
    apiLogger.error({ message: "workspaces_patch_failed", requestId: meta.requestId, route: meta.route, method: meta.method, meta: { error: message } });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:workspaces:delete", max: 20, windowMs: 60_000 });
    if (!rate.allowed) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const acting = await resolveActingContext(request);
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "workspaces:delete",
      actionLabel: "Excluir ou arquivar perfil financeiro",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const uid = acting.actingUid;
    const body = (await request.json()) as { id?: string; mode?: "archive" | "delete_data" };
    const workspaceId = String(body.id || "").trim();
    const mode = body.mode === "delete_data" ? "delete_data" : "archive";
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const current = await getWorkspaceRows(uid);
    const target = current.find((workspace) => workspace.id === workspaceId);
    if (!target || target.membership) {
      return NextResponse.json({ ok: false, error: "workspace_not_found" }, { status: 404 });
    }

    const activeOthers = current.filter((workspace) => workspace.id !== workspaceId && isWorkspaceActive(workspace) && !workspace.membership);
    if (activeOthers.length === 0) {
      return NextResponse.json({ ok: false, error: "Crie ou restaure outro perfil antes de remover este." }, { status: 400 });
    }

    const now = new Date().toISOString();
    if (target.type === "family") {
      await clearFamilyAccess(uid, workspaceId, now);
    }

    if (mode === "delete_data") {
      await deleteWorkspaceFinancialData(uid, workspaceId);
      await supabaseDeleteByFilters("workspaces", { uid, source_id: workspaceId });
      const fallbackDefault = activeOthers[0];
      const next = current
        .filter((workspace) => workspace.id !== workspaceId)
        .map((workspace) => {
          if (workspace.id === fallbackDefault.id) return { ...workspace, isDefault: true, updatedAt: now };
          return workspace.isDefault ? { ...workspace, isDefault: false, updatedAt: now } : workspace;
        });
      await persistWorkspaceSet(uid, next);
      await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
      return NextResponse.json({ ok: true, mode, defaultWorkspace: fallbackDefault }, { status: 200 });
    }

    const archived: Workspace = {
      ...target,
      isDefault: false,
      status: "archived",
      settings: { ...target.settings, archivedAt: now },
      updatedAt: now,
    };
    const fallbackDefault = activeOthers.find((workspace) => workspace.isDefault) || activeOthers[0];
    const next = current.map((workspace) => {
      if (workspace.id === archived.id) return archived;
      if (workspace.id === fallbackDefault.id) return { ...workspace, isDefault: true, updatedAt: now };
      return workspace.isDefault ? { ...workspace, isDefault: false, updatedAt: now } : workspace;
    });
    await persistWorkspaceSet(uid, next);

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json({ ok: true, mode, workspace: archived, defaultWorkspace: fallbackDefault }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = getWorkspaceErrorStatus(message);
    apiLogger.error({ message: "workspaces_delete_failed", requestId: meta.requestId, route: meta.route, method: meta.method, meta: { error: message } });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
