import { expect, test } from "@playwright/test";
import { actor, login, openSupportReporter } from "./support-fixtures";

const user = actor("USER_A");
test.skip(!user, "Configure a conta E2E do usuário comum.");

test("Central de Ajuda permanece utilizável no viewport mobile", async ({ page }) => {
  await login(page, user!);
  await openSupportReporter(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeInViewport();
  await expect(dialog.locator("#support-report-title")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar relato" })).toBeVisible();
});
