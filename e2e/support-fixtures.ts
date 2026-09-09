import { expect, type APIRequestContext, type Page } from "@playwright/test";

export type TestActor = { email: string; password: string; uid?: string };

export const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

export function actor(prefix: "USER_A" | "USER_B" | "ADMIN" | "DENIED") {
  const email = process.env[`E2E_${prefix}_EMAIL`] || "";
  const password = process.env[`E2E_${prefix}_PASSWORD`] || "";
  const uid = process.env[`E2E_${prefix}_UID`] || undefined;
  return email && password ? { email, password, uid } satisfies TestActor : null;
}

export function hasCoreActors() {
  return Boolean(actor("USER_A") && actor("USER_B") && actor("ADMIN"));
}

export async function getAccessToken(request: APIRequestContext, identity: TestActor) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !anonKey) throw new Error("E2E Supabase URL/anon key not configured");
  const response = await request.post(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    data: { email: identity.email, password: identity.password },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const payload = await response.json() as { access_token: string };
  return payload.access_token;
}

export function authHeaders(token: string, extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

export async function createBug(
  request: APIRequestContext,
  token: string,
  options: { image?: boolean; requestId?: string; headers?: Record<string, string>; workspaceId?: string } = {},
) {
  const requestId = options.requestId || crypto.randomUUID();
  const multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = {
    type: "bug",
    title: `Bug E2E ${requestId.slice(0, 8)}`,
    description: "Relato automatizado de validação da Central de Ajuda.",
    stepsToReproduce: "Abrir a tela e executar a ação testada.",
    expectedResult: "A operação deveria concluir normalmente.",
    actualResult: "O cenário controlado foi reproduzido.",
    includeTechnicalContext: "true",
    technicalContext: JSON.stringify({ route: "/dashboard?secret=removed", workspaceId: options.workspaceId, appVersion: "e2e" }),
    clientRequestId: requestId,
  };
  if (options.image) multipart.attachments = { name: "evidence.png", mimeType: "image/png", buffer: PNG_1PX };
  const response = await request.post("/api/support-requests", {
    headers: authHeaders(token, { "Idempotency-Key": requestId, ...options.headers }),
    multipart,
  });
  return { response, payload: await response.json() as { ok: boolean; id?: string; protocol?: string; duplicated?: boolean; error?: string }, requestId };
}

export async function login(page: Page, identity: TestActor) {
  await page.goto("/login");
  await page.locator("#email").fill(identity.email);
  await page.locator("#password").fill(identity.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

export async function openSupportReporter(page: Page) {
  await page.getByRole("button", { name: /abrir funções rápidas/i }).click();
  await page.getByRole("button", { name: /pedir ajuda ou relatar problema/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
