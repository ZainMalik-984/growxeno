import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { expect, test } from "@playwright/test";

const execFileAsync = promisify(execFile);

/**
 * Phase 7 (Finance) — against the real database.
 *
 * Same credentials and skip behaviour as authenticated.spec.ts. Each test
 * creates its own throwaway records and deletes them via the UI's own
 * Delete button where one exists (Worker payments); Expenses have no
 * delete path by design (docs/REQUIREMENTS.md D8 — edit in place, matching
 * the pre-existing `finance.expenses.*` permission shape), so the expense
 * test edits it back to a recognizable, harmless state rather than deleting.
 *
 * This suite's buyer-payment test was removed with Buyer itself,
 * post-Phase-10 (2026-09-27, owner-directed) — see
 * `prisma/schema/crm.prisma`'s file header.
 */

async function cleanupOrderTestData(stamp: number) {
  try {
    await execFileAsync("npx", ["tsx", "scripts/e2e-cleanup-orders.ts", String(stamp)], {
      cwd: process.cwd(),
      timeout: 60_000,
    });
  } catch (error) {
    console.error("cleanupOrderTestData failed:", error);
  }
}

async function cleanupBareOrder(orderId: string) {
  try {
    await execFileAsync("npx", ["tsx", "scripts/e2e-cleanup-orders.ts", "--order-id", orderId], {
      cwd: process.cwd(),
      timeout: 60_000,
    });
  } catch (error) {
    console.error("cleanupBareOrder failed:", error);
  }
}

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

test.describe("Finance (Phase 7)", () => {
  test("shows the Finance overview with per-currency figures", async ({ page }) => {
    test.setTimeout(60_000);
    await signIn(page);
    await page.goto("/finance");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { level: 1, name: "Finance" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 2, name: "This range" })).toBeVisible({ timeout: 30_000 });
  });

  test("adds a custom expense with a category, then edits it", async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page);
    await page.goto("/finance/expenses");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { level: 1, name: "Expenses" })).toBeVisible({ timeout: 30_000 });

    const stamp = Date.now();
    const description = `E2E Test Expense ${stamp}`;

    await page.getByRole("button", { name: "Add expense" }).click();
    const addDialog = page.locator("dialog[open]");
    await addDialog.locator("#expense-amount").fill("42");
    await addDialog.locator("#expense-category").selectOption({ index: 1 });
    await addDialog.locator("#expense-description").fill(description);
    await addDialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Expense recorded.")).toBeVisible({ timeout: 30_000 });

    const row = page.getByRole("row").filter({ hasText: description });
    await expect(row).toBeVisible({ timeout: 30_000 });

    // Edit it back to a distinctly-labelled, harmless state — expenses have
    // no delete path (edit-in-place is the corrections policy, D8).
    await row.getByRole("button", { name: "Edit" }).click();
    const editDialog = page.locator("dialog[open]");
    await editDialog.locator("#expense-description").fill(`${description} (edited, safe to ignore)`);
    await editDialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Expense updated.")).toBeVisible({ timeout: 30_000 });
    // Scoped to this run's stamp: expenses have no delete path, so past runs'
    // "(edited, safe to ignore)" rows accumulate and would otherwise collide.
    await expect(page.getByRole("row").filter({ hasText: `${description} (edited` })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("adds a category, then deactivates it", async ({ page }) => {
    test.setTimeout(60_000);
    await signIn(page);
    await page.goto("/finance/expenses");
    await page.waitForLoadState("networkidle");

    const categoryName = `E2E Test Category ${Date.now()}`;
    await page.getByPlaceholder("New category name").fill(categoryName);
    await page.getByRole("button", { name: "Add category" }).click();
    await expect(page.getByText("Category created.")).toBeVisible({ timeout: 30_000 });

    const row = page.getByRole("listitem").filter({ hasText: categoryName });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.getByRole("button", { name: "Deactivate" }).click();
    await expect(page.getByText("Category deactivated.")).toBeVisible({ timeout: 30_000 });
  });

  test("records a worker payment, then deletes it", async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page);
    await page.goto("/finance/worker-payments");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Add payment" }).click();
    const addDialog = page.locator("dialog[open]");
    await addDialog.locator("#payment-worker").selectOption({ index: 1 });
    await addDialog.locator("#payment-amount").fill("3500");
    const reference = `E2E-${Date.now()}`;
    await addDialog.locator("#payment-reference").fill(reference);
    await addDialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Payment recorded.")).toBeVisible({ timeout: 30_000 });

    const row = page.getByRole("row").filter({ hasText: reference });
    await expect(row).toBeVisible({ timeout: 30_000 });

    await row.getByRole("button", { name: "Edit" }).click();
    const editDialog = page.locator("dialog[open]");
    await editDialog.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Payment deleted.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("row").filter({ hasText: reference })).toHaveCount(0, { timeout: 30_000 });
  });

  test("toggles the refund flag on an order and sees the financials panel", async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page);
    let orderId: string | undefined;
    try {
    // A throwaway order — refund/financials are order-level, no items needed.
    await page.goto("/orders/new");
    await page.waitForLoadState("networkidle");
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    await page.getByLabel("Deadline").fill(deadline);
    await page.getByRole("button", { name: "Create order" }).click();
    await page.waitForURL(/\/orders\/[0-9a-f-]{36}/, { timeout: 30_000 });
    orderId = page.url().split("/").pop();

    await expect(page.getByRole("heading", { level: 2, name: "Summary" })).toBeVisible({ timeout: 30_000 });
    const refundButton = page.getByRole("button", { name: /Mark as refunded|Clear refund flag/ });
    await expect(refundButton).toBeVisible({ timeout: 30_000 });

    const initialLabel = await refundButton.textContent();
    await refundButton.click();
    await expect(page.getByText(/Order marked as refunded\.|Refund flag cleared\./)).toBeVisible({ timeout: 30_000 });
    // Toggle back to leave the order exactly as found.
    await expect(page.getByRole("button", { name: /Mark as refunded|Clear refund flag/ })).not.toHaveText(
      initialLabel ?? "",
      { timeout: 30_000 },
    );
    await page.getByRole("button", { name: /Mark as refunded|Clear refund flag/ }).click();
    await expect(page.getByText(/Order marked as refunded\.|Refund flag cleared\./)).toBeVisible({ timeout: 30_000 });

    // Cancel it (there is no delete UI for orders, by design); the finally block removes the row.
    await page.getByRole("button", { name: "Cancelled" }).click();
    const cancelDialog = page.locator("dialog[open]");
    await cancelDialog.getByLabel("Reason").fill("E2E test cleanup");
    await cancelDialog.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("Status updated.")).toBeVisible({ timeout: 30_000 });
    } finally {
      if (orderId) await cleanupBareOrder(orderId);
    }
  });

  test("cancels an in-progress outsourced item with an adjusted cost, reflected in the worker's earnings", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const stamp = Date.now();
    try {
      await signIn(page);
      const categoryName = `E2E Test Category ${stamp}`;
      const serviceName = `E2E Test Service ${stamp}`;
      const workerName = `E2E Test Worker ${stamp}`;

      await page.goto("/categories");
      await page.getByRole("button", { name: "New category" }).click();
      const createCategoryDialog = page.locator("dialog[open]");
      await createCategoryDialog.getByLabel("Name").fill(categoryName);
      await createCategoryDialog.getByRole("button", { name: "Create category" }).click();
      await expect(page.getByText("Category created.")).toBeVisible({ timeout: 30_000 });

      await page.goto("/services/new");
      await page.waitForLoadState("networkidle");
      await page.getByLabel("Name", { exact: true }).fill(serviceName);
      await page.getByLabel("Category").selectOption({ label: categoryName });
      await page.getByLabel("Base price").fill("100");
      await page.getByRole("button", { name: "Create service" }).click();
      await page.waitForURL(/\/services\/[0-9a-f-]{36}/, { timeout: 30_000 });

      await page.goto("/outsourced-workers/new");
      await page.waitForLoadState("networkidle");
      await page.getByLabel("Name", { exact: true }).fill(workerName);
      await page.getByRole("button", { name: "Add worker" }).click();
      await page.waitForURL(/\/outsourced-workers\/[0-9a-f-]{36}/, { timeout: 30_000 });
      const workerUrl = page.url();
      const workerId = workerUrl.split("/").pop()!;

      await page.goto("/orders/new");
      await page.waitForLoadState("networkidle");
      const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
      await page.getByLabel("Deadline").fill(deadline);
      await page.getByRole("button", { name: "Create order" }).click();
      await page.waitForURL(/\/orders\/[0-9a-f-]{36}/, { timeout: 30_000 });

      await page.getByRole("button", { name: "Add item" }).click();
      const addItemDialog = page.locator("dialog[open]");
      await addItemDialog.getByLabel("Service").selectOption({ label: `${categoryName} · ${serviceName}` });
      await addItemDialog.locator("#item-worker-cost").fill("3500");
      await addItemDialog.getByRole("button", { name: "Add item" }).click();
      await expect(page.getByText("Item added.")).toBeVisible({ timeout: 30_000 });

      await page.getByLabel("Assigned to").selectOption({ label: `${workerName} (outsourced)` });
      await expect(page.getByText("Assignment updated.")).toBeVisible({ timeout: 30_000 });

      await page.getByRole("button", { name: "Process order" }).click();
      await expect(page.getByText(/Order #\d+ processed/)).toBeVisible({ timeout: 30_000 });

      // --- Cancel with an adjusted (partial) cost ---
      await page.getByLabel("Move to").selectOption({ label: "Cancelled" });
      const cancelDialog = page.locator("dialog[open]");
      // The dialog uses curly quotes ("…") around the service name, not straight ones.
      await expect(cancelDialog.getByRole("heading", { name: new RegExp(`Cancel .${serviceName}.`) })).toBeVisible({
        timeout: 30_000,
      });
      await cancelDialog.locator("#cancel-worker-cost").fill("1750");
      await cancelDialog.locator("#cancel-note").fill("Customer cancelled; 500/1000 subscribers done.");
      await cancelDialog.getByRole("button", { name: "Cancel item" }).click();
      await expect(page.getByText("Item cancelled.")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Customer cancelled; 500/1000 subscribers done.")).toBeVisible({
        timeout: 30_000,
      });

      // --- The worker's earnings reflect the adjusted amount, not the original ---
      await page.goto(`/outsourced-workers/${workerId}`);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { level: 2, name: "Earnings" })).toBeVisible({ timeout: 30_000 });
      // Both Earned and Outstanding show 1750.00 PKR here (nothing paid yet) —
      // the adjusted amount, not the original 3500.
      await expect(page.getByText("1750.00 PKR")).toHaveCount(2, { timeout: 30_000 });
      await expect(page.getByText("3500.00 PKR")).toHaveCount(0);
    } finally {
      await cleanupOrderTestData(stamp);
    }
  });
});
