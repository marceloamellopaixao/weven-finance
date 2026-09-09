import { expect, test } from "@playwright/test";
import { actor, login, openSupportReporter, PNG_1PX } from "./support-fixtures";

const user = actor("USER_A");
test.skip(!user, "Configure E2E_USER_A_EMAIL e E2E_USER_A_PASSWORD em um ambiente descartável.");

test("usuário cria bug sem imagem", async ({ page }) => {
  await login(page, user!);
  await openSupportReporter(page);
  await page.locator("#support-report-title").fill("Bug sem imagem E2E");
  await page.locator("#support-report-description").fill("O teste valida o envio sem nenhuma evidência anexada.");
  await page.getByRole("button", { name: "Enviar relato" }).click();
  await expect(page.getByText("Relato enviado")).toBeVisible();
  await expect(page.getByText(/^WF-/)).toBeVisible();
});

test("cola, remove, reprova e tenta novamente um anexo após falha parcial do Storage", async ({ page }) => {
  await login(page, user!);
  await openSupportReporter(page);
  const dropZone = page.getByText(/cole uma captura/i).locator("..");
  await dropZone.evaluate((element, base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], "pasted.png", { type: "image/png" }));
    element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData: transfer }));
  }, PNG_1PX.toString("base64"));
  await expect(page.getByAltText("pasted.png")).toBeVisible();
  await page.getByRole("button", { name: /remover imagem/i }).click();
  await expect(page.getByAltText("pasted.png")).toHaveCount(0);

  const input = page.locator('input[type="file"]');
  await input.setInputFiles({ name: "invalid.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
  await expect(page.getByRole("alert")).toContainText(/png, jpeg ou webp/i);
  await input.setInputFiles({ name: "retry.png", mimeType: "image/png", buffer: PNG_1PX });
  await page.locator("#support-report-title").fill("Retentativa de upload E2E");
  await page.locator("#support-report-description").fill("Valida indisponibilidade parcial e retentativa idempotente.");

  let simulateFailure = true;
  await page.route("**/api/support-requests", async (route) => {
    await route.continue({ headers: { ...route.request().headers(), ...(simulateFailure ? { "x-e2e-storage-failure": "1" } : {}) } });
  });
  await page.getByRole("button", { name: "Enviar relato" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  simulateFailure = false;
  await page.getByRole("button", { name: "Enviar relato" }).click();
  await expect(page.getByText("Relato enviado")).toBeVisible();
});

test("modal mantém foco e fecha por teclado", async ({ page }) => {
  await login(page, user!);
  await openSupportReporter(page);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("dialog")).toContainText("Como podemos ajudar?");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
