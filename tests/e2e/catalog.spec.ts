import { expect, test } from "@playwright/test";

/**
 * Phase 3 (Catalog) — Categories and Services, against the real database.
 *
 * This suite's buyer-specific price override test was removed with Buyer
 * itself, post-Phase-10 (2026-09-27, owner-directed) — see
 * `prisma/schema/crm.prisma`'s file header.
 *
 * Same credentials and skip behaviour as authenticated.spec.ts. Each test
 * creates its own records (timestamped names) and deletes everything it made.
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

test.describe("Catalog (Phase 3)", () => {
  test("creates a category, renames it, then deletes it", async ({ page }) => {
    await signIn(page);
    const categoryName = `E2E Test Category ${Date.now()}`;

    await page.goto("/categories");
    await page.getByRole("button", { name: "New category" }).click();
    const createDialog = page.locator("dialog[open]");
    await createDialog.getByLabel("Name").fill(categoryName);
    await createDialog.getByRole("button", { name: "Create category" }).click();
    await expect(page.getByText("Category created.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("cell", { name: categoryName })).toBeVisible({ timeout: 30_000 });

    const renamedName = `${categoryName} renamed`;
    const row = page.getByRole("row").filter({ hasText: categoryName });
    await row.getByRole("button", { name: "Rename" }).click();
    const renameDialog = page.locator("dialog[open]");
    await renameDialog.getByLabel("Name").fill(renamedName);
    await renameDialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Category updated.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("cell", { name: renamedName })).toBeVisible({ timeout: 30_000 });

    const renamedRow = page.getByRole("row").filter({ hasText: renamedName });
    await renamedRow.getByRole("button", { name: "Delete" }).click();
    const deleteDialog = page.locator("dialog[open]");
    await deleteDialog.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Category deleted.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("cell", { name: renamedName })).toHaveCount(0);
  });

  test("creates a service under a category, edits it, deactivates it, then deletes it", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await signIn(page);
    const categoryName = `E2E Test Category ${Date.now()}`;
    const serviceName = `E2E Test Service ${Date.now()}`;

    // A service needs a category — create a throwaway one.
    await page.goto("/categories");
    await page.getByRole("button", { name: "New category" }).click();
    const createCategoryDialog = page.locator("dialog[open]");
    await createCategoryDialog.getByLabel("Name").fill(categoryName);
    await createCategoryDialog.getByRole("button", { name: "Create category" }).click();
    await expect(page.getByText("Category created.")).toBeVisible({ timeout: 15_000 });

    await page.goto("/services/new");
    await page.getByLabel("Name", { exact: true }).fill(serviceName);
    await page.getByLabel("Category").selectOption({ label: categoryName });
    await page.getByLabel("Base price").fill("120");
    await page.getByRole("button", { name: "Create service" }).click();
    await page.waitForURL(/\/services\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: serviceName })).toBeVisible({
      timeout: 30_000,
    });

    const renamedName = `${serviceName} renamed`;
    await page.locator("#edit-service-name").fill(renamedName);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Service updated.")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Deactivate" }).click();
    const deactivateDialog = page.locator("dialog[open]");
    await deactivateDialog.getByRole("button", { name: "Deactivate" }).click();
    await expect(page.getByText("Service deactivated.")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Reactivate" }).click();
    await expect(page.getByText("Service reactivated.")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Delete" }).click();
    const deleteServiceDialog = page.locator("dialog[open]");
    await deleteServiceDialog.getByRole("button", { name: "Delete" }).click();
    await page.waitForURL(/\/services$/, { timeout: 60_000 });

    // Clean up the throwaway category (now empty).
    await page.goto("/categories");
    const categoryRow = page.getByRole("row").filter({ hasText: categoryName });
    await categoryRow.getByRole("button", { name: "Delete" }).click();
    const deleteCategoryDialog = page.locator("dialog[open]");
    await deleteCategoryDialog.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Category deleted.")).toBeVisible({ timeout: 15_000 });
  });
});
