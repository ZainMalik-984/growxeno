import { expect, test } from "@playwright/test";

/**
 * Phase 2 (CRM) — Customers, against the real database.
 *
 * Buyer (and its contacts/pricing overrides) was removed entirely,
 * post-Phase-10 (2026-09-27, owner-directed) — see
 * `prisma/schema/crm.prisma`'s file header. This suite's Buyer CRUD test was
 * removed with it; only Customer remains.
 *
 * Same credentials and skip behaviour as authenticated.spec.ts. Each test
 * creates its own records (timestamped names, so re-runs cannot collide) and
 * deletes everything it made, the same discipline as the role CRUD test.
 */

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;

test.skip(
  !EMAIL || !PASSWORD,
  "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (or SEED_ADMIN_*) to run this suite.",
);

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL!);
  await page.getByLabel("Password").fill(PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe("CRM (Phase 2)", () => {
  test("creates a customer, edits it, then deletes it", async ({ page }) => {
    await signIn(page);
    const customerName = `E2E Test Customer ${Date.now()}`;

    await page.goto("/customers/new");
    await page.getByLabel("Name", { exact: true }).fill(customerName);
    await page.getByRole("button", { name: "Create customer" }).click();
    await page.waitForURL(/\/customers\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: customerName })).toBeVisible({
      timeout: 30_000,
    });

    const renamedName = `${customerName} renamed`;
    await page.getByLabel("Name", { exact: true }).fill(renamedName);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Customer updated.")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Delete" }).click();
    const dialog = page.locator("dialog[open]");
    await dialog.getByRole("button", { name: "Delete" }).click();
    await page.waitForURL(/\/customers$/, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: renamedName })).toHaveCount(0);
  });
});
