import { expect, test } from "@playwright/test";
import { actor, authHeaders, createBug, getAccessToken, hasCoreActors } from "./support-fixtures";

test.describe("isolamento, administração e resiliência da Central de Ajuda", () => {
  test.skip(!hasCoreActors(), "Configure contas E2E descartáveis USER_A, USER_B e ADMIN.");

  test("dois usuários e workspaces não vazam chamados", async ({ request }) => {
    const userA = actor("USER_A")!;
    const userB = actor("USER_B")!;
    const [tokenA, tokenB] = await Promise.all([getAccessToken(request, userA), getAccessToken(request, userB)]);
    const ticketA = await createBug(request, tokenA, { workspaceId: process.env.E2E_USER_A_WORKSPACE_ID });
    const ticketB = await createBug(request, tokenB, { workspaceId: process.env.E2E_USER_B_WORKSPACE_ID });
    expect(ticketA.response.ok(), JSON.stringify(ticketA.payload)).toBeTruthy();
    expect(ticketB.response.ok(), JSON.stringify(ticketB.payload)).toBeTruthy();

    const mineA = await request.get("/api/support-requests?scope=mine&limit=100", { headers: authHeaders(tokenA) });
    const mineB = await request.get("/api/support-requests?scope=mine&limit=100", { headers: authHeaders(tokenB) });
    const payloadA = await mineA.json() as { tickets: Array<{ id: string; workspaceId?: string }> };
    const payloadB = await mineB.json() as { tickets: Array<{ id: string; workspaceId?: string }> };
    expect(payloadA.tickets.some((ticket) => ticket.id === ticketA.payload.id)).toBeTruthy();
    expect(payloadA.tickets.some((ticket) => ticket.id === ticketB.payload.id)).toBeFalsy();
    expect(payloadB.tickets.some((ticket) => ticket.id === ticketB.payload.id)).toBeTruthy();
    expect(payloadB.tickets.some((ticket) => ticket.id === ticketA.payload.id)).toBeFalsy();
  });

  test("admin filtra, atribui, responde e abre evidência por URL curta", async ({ request }) => {
    const userToken = await getAccessToken(request, actor("USER_A")!);
    const admin = actor("ADMIN")!;
    const adminToken = await getAccessToken(request, admin);
    const created = await createBug(request, userToken, { image: true });
    expect(created.response.ok(), JSON.stringify(created.payload)).toBeTruthy();

    const filtered = await request.get(`/api/support-requests?q=${encodeURIComponent(created.payload.protocol || "")}&type=bug&status=pending`, { headers: authHeaders(adminToken) });
    expect(filtered.ok(), await filtered.text()).toBeTruthy();
    const list = await filtered.json() as { tickets: Array<{ id: string; attachments: Array<{ id: string }> }> };
    const ticket = list.tickets.find((item) => item.id === created.payload.id);
    expect(ticket).toBeTruthy();

    const assigned = await request.patch("/api/support-requests", {
      headers: authHeaders(adminToken),
      data: { ticketId: created.payload.id, updates: { assignedTo: admin.uid, assignedToName: "Admin E2E", status: "in_progress" } },
    });
    expect(assigned.ok(), await assigned.text()).toBeTruthy();

    const activityId = crypto.randomUUID();
    const reply = await request.post("/api/support-requests/activity", {
      headers: authHeaders(adminToken, { "Idempotency-Key": activityId }),
      multipart: { ticketId: created.payload.id!, action: "reply", message: "Resposta automatizada do suporte.", clientRequestId: activityId },
    });
    expect(reply.ok(), await reply.text()).toBeTruthy();

    const attachmentId = ticket?.attachments[0]?.id;
    expect(attachmentId).toBeTruthy();
    const signed = await request.get(`/api/support-requests/attachments?attachmentId=${attachmentId}`, {
      headers: authHeaders(adminToken, { "x-e2e-signed-url-ttl": "1" }),
    });
    expect(signed.ok(), await signed.text()).toBeTruthy();
    const signedPayload = await signed.json() as { attachment: { url: string; expiresIn: number } };
    expect(signedPayload.attachment.expiresIn).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    const expired = await request.get(signedPayload.attachment.url);
    expect(expired.ok()).toBeFalsy();
  });

  test("papel sem permissão recebe 403 ao alterar chamado", async ({ request }) => {
    test.skip(!actor("DENIED"), "Configure E2E_DENIED_EMAIL/PASSWORD com papel sem admin.support.write.");
    const ownerToken = await getAccessToken(request, actor("USER_A")!);
    const deniedToken = await getAccessToken(request, actor("DENIED")!);
    const created = await createBug(request, ownerToken);
    const response = await request.patch("/api/support-requests", {
      headers: authHeaders(deniedToken),
      data: { ticketId: created.payload.id, updates: { priority: "high" } },
    });
    expect(response.status()).toBe(403);
  });

  test("falha parcial do Storage não deixa ticket completo e retentativa é idempotente", async ({ request }) => {
    const token = await getAccessToken(request, actor("USER_A")!);
    const requestId = crypto.randomUUID();
    const failed = await createBug(request, token, { image: true, requestId, headers: { "x-e2e-storage-failure": "1" } });
    expect(failed.response.ok()).toBeFalsy();
    const retry = await createBug(request, token, { image: true, requestId });
    expect(retry.response.ok(), JSON.stringify(retry.payload)).toBeTruthy();
    const duplicate = await createBug(request, token, { image: true, requestId });
    expect(duplicate.response.ok()).toBeTruthy();
    expect(duplicate.payload.duplicated).toBeTruthy();
    expect(duplicate.payload.id).toBe(retry.payload.id);
  });

  test("impersonation válida, expirada e revogada respeita o estado no servidor", async ({ request }) => {
    const adminToken = await getAccessToken(request, actor("ADMIN")!);
    const fixtures = [
      [process.env.E2E_IMPERSONATION_VALID_UID, 200],
      [process.env.E2E_IMPERSONATION_EXPIRED_UID, 403],
      [process.env.E2E_IMPERSONATION_REVOKED_UID, 403],
    ] as const;
    test.skip(fixtures.some(([uid]) => !uid), "Prepare os três estados de impersonation descritos no checklist E2E.");
    for (const [targetUid, status] of fixtures) {
      const response = await request.get("/api/support-requests?scope=mine", {
        headers: authHeaders(adminToken, { "x-impersonate-uid": targetUid! }),
      });
      expect(response.status()).toBe(status);
    }
  });

  test("alteração de plano durante a sessão passa a valer no novo chamado", async ({ request }) => {
    const user = actor("USER_A")!;
    const admin = actor("ADMIN")!;
    const originalPlan = process.env.E2E_USER_A_ORIGINAL_PLAN;
    const alternatePlan = process.env.E2E_USER_A_ALTERNATE_PLAN;
    test.skip(!user.uid || !originalPlan || !alternatePlan, "Configure UID e planos da conta descartável para restaurá-la após o teste.");
    const [userToken, adminToken] = await Promise.all([getAccessToken(request, user), getAccessToken(request, admin)]);
    try {
      const changed = await request.patch("/api/admin/users", {
        headers: authHeaders(adminToken),
        data: { uid: user.uid, updates: { plan: alternatePlan } },
      });
      expect(changed.ok(), await changed.text()).toBeTruthy();
      const created = await createBug(request, userToken);
      expect(created.response.ok()).toBeTruthy();
      const mine = await request.get(`/api/support-requests?scope=mine&q=${encodeURIComponent(created.payload.protocol || "")}`, { headers: authHeaders(userToken) });
      const payload = await mine.json() as { tickets: Array<{ id: string; effectivePlan: string }> };
      expect(payload.tickets.find((ticket) => ticket.id === created.payload.id)?.effectivePlan).toBe(alternatePlan);
    } finally {
      await request.patch("/api/admin/users", { headers: authHeaders(adminToken), data: { uid: user.uid, updates: { plan: originalPlan } } });
    }
  });
});
