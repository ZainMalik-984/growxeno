import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { expect, test } from "@playwright/test";

const execFileAsync = promisify(execFile);

/**
 * Phase 8 (Notifications, in-app + templates + message logs) — against the
 * real database. Same credentials and skip behaviour as finance.spec.ts.
 *
 * Email/WhatsApp sending is NOT tested here because it is not built — no
 * queue exists yet (docs/NOTIFICATIONS.md, deferred this phase). Only the
 * in-app notification pipeline, preferences, templates and the (empty)
 * message log viewer are real.
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

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? "Growth Bridge";

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

test.describe("Notifications (Phase 8)", () => {
  test("shows the notification centre and its preferences table", async ({ page }) => {
    test.setTimeout(60_000);
    await signIn(page);
    await page.goto("/notifications");

    await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Preferences" })).toBeVisible();
    // Every event has an In-app switch, and specification Section 65's list
    // is long enough that at least this one is always present.
    await expect(page.getByRole("switch", { name: /Order assigned via In-app/ })).toBeVisible();
  });

  test("toggles a notification preference and it survives a reload", async ({ page }) => {
    test.setTimeout(60_000);
    await signIn(page);
    await page.goto("/notifications");

    const toggle = page.getByRole("switch", { name: /Deadline in 24 hours via Email/ });
    const before = await toggle.getAttribute("aria-checked");
    await toggle.click();
    await expect(page.getByRole("switch", { name: /Deadline in 24 hours via Email/ })).toHaveAttribute(
      "aria-checked",
      before === "true" ? "false" : "true",
      { timeout: 15_000 },
    );

    await page.reload();
    await expect(page.getByRole("switch", { name: /Deadline in 24 hours via Email/ })).toHaveAttribute(
      "aria-checked",
      before === "true" ? "false" : "true",
    );

    // Restore original state so this test is idempotent across runs.
    await page.getByRole("switch", { name: /Deadline in 24 hours via Email/ }).click();
    await expect(page.getByRole("switch", { name: /Deadline in 24 hours via Email/ })).toHaveAttribute(
      "aria-checked",
      before ?? "false",
      { timeout: 15_000 },
    );
  });

  test("creates a template, edits it, then deactivates it", async ({ page }) => {
    test.setTimeout(60_000);
    await signIn(page);
    const stamp = Date.now();
    const templateName = `E2E Test Template ${stamp}`;

    await page.goto("/communication/templates");
    await page.getByRole("button", { name: "New template" }).click();

    const dialog = page.locator("dialog[open]");
    await dialog.getByLabel("Event").selectOption({ label: "Payment due" });
    await dialog.getByLabel("Channel").selectOption({ label: "In-app" });
    await dialog.getByLabel("Name").fill(templateName);
    await dialog.getByLabel("Body").fill("Hi {{customer_name}}, payment of {{amount}} is due.");
    await dialog.getByLabel("Required variables").fill("customer_name, amount");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Template created.")).toBeVisible({ timeout: 30_000 });

    const row = page.getByRole("row").filter({ hasText: templateName });
    await expect(row).toBeVisible();
    await expect(row.getByText("Active")).toBeVisible();

    await row.getByRole("button", { name: "Edit" }).click();
    const editDialog = page.locator("dialog[open]");
    await editDialog.getByLabel("Name").fill(`${templateName} (edited)`);
    await editDialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Template updated.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("row").filter({ hasText: `${templateName} (edited)` })).toBeVisible();

    await page
      .getByRole("row")
      .filter({ hasText: `${templateName} (edited)` })
      .getByRole("button", { name: "Deactivate" })
      .click();
    await expect(page.getByText("Template deactivated.")).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("row").filter({ hasText: `${templateName} (edited)` }).getByText("Inactive"),
    ).toBeVisible();

    // Delete afterward — unlike Expense, a template has no delete-blocking
    // history requirement (MessageLog.templateId is SetNull), and this test
    // reuses the same (event, channel) pair every run, which would collide
    // with the unique constraint on a second run if left behind.
    await page
      .getByRole("row")
      .filter({ hasText: `${templateName} (edited)` })
      .getByRole("button", { name: "Edit" })
      .click();
    await page.locator("dialog[open]").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Template deleted.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("row").filter({ hasText: `${templateName} (edited)` })).toHaveCount(0);
  });

  test("rejects a template with an unknown placeholder", async ({ page }) => {
    test.setTimeout(60_000);
    await signIn(page);
    const stamp = Date.now();

    await page.goto("/communication/templates");
    await page.getByRole("button", { name: "New template" }).click();

    const dialog = page.locator("dialog[open]");
    await dialog.getByLabel("Event").selectOption({ label: "Order created" });
    await dialog.getByLabel("Channel").selectOption({ label: "In-app" });
    await dialog.getByLabel("Name").fill(`E2E Test Bad Template ${stamp}`);
    await dialog.getByLabel("Body").fill("Hello {{nickname}}");
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(dialog.getByRole("alert")).toContainText("Unknown placeholder", { timeout: 15_000 });
  });

  test("shows the message logs page", async ({ page }) => {
    test.setTimeout(30_000);
    await signIn(page);
    await page.goto("/communication/message-logs");
    await expect(page.getByRole("heading", { level: 1, name: "Message Logs" })).toBeVisible();
  });

  test("assigning and processing an order item notifies the assigned worker in-app", async ({ page }) => {
    test.setTimeout(120_000);
    const stamp = Date.now();
    // This test depends on the signed-in admin's OWN in-app preferences (a saved override beats the
    // default), so it sets what it needs and puts them back — it must not assume a pristine account.
    const wanted = ["Order assigned via In-app", "Order started via In-app"];
    const toRestore: string[] = [];
    try {
      await signIn(page);
      await page.goto("/notifications");
      for (const name of wanted) {
        const toggle = page.getByRole("switch", { name });
        await expect(toggle).toBeVisible({ timeout: 30_000 });
        if ((await toggle.getAttribute("aria-checked")) !== "true") {
          await toggle.click();
          await expect(page.getByRole("switch", { name })).toHaveAttribute("aria-checked", "true", { timeout: 30_000 });
          toRestore.push(name);
        }
      }
      const categoryName = `E2E Test Category ${stamp}`;
      const serviceName = `E2E Test Service ${stamp}`;

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
      await page.getByLabel("Base price").fill("50");
      await page.getByRole("button", { name: "Create service" }).click();
      await page.waitForURL(/\/services\/[0-9a-f-]{36}/, { timeout: 30_000 });

      await page.goto("/orders/new");
      await page.waitForLoadState("networkidle");
      const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
      await page.getByLabel("Deadline").fill(deadline);
      await page.getByRole("button", { name: "Create order" }).click();
      await page.waitForURL(/\/orders\/[0-9a-f-]{36}/, { timeout: 30_000 });
      const orderHeading = await page.getByRole("heading", { level: 1 }).textContent();
      const orderNumberMatch = orderHeading?.match(/#(\d+)/);
      expect(orderNumberMatch).not.toBeNull();
      const orderNumber = orderNumberMatch![1];

      await page.getByRole("button", { name: "Add item" }).click();
      const addItemDialog = page.locator("dialog[open]");
      await addItemDialog.getByLabel("Service").selectOption({ label: `${categoryName} · ${serviceName}` });
      await addItemDialog.getByRole("button", { name: "Add item" }).click();
      await expect(page.getByText("Item added.")).toBeVisible({ timeout: 30_000 });

      // Self-assign — every active user, including the signed-in admin, is
      // in the assignment picker, so this stays a single-identity test.
      await page.getByLabel("Assigned to").selectOption({ label: ADMIN_NAME });
      await expect(page.getByText("Assignment updated.")).toBeVisible({ timeout: 30_000 });

      await page.getByRole("button", { name: "Process order" }).click();
      await expect(page.getByText(/Order #\d+ processed/)).toBeVisible({ timeout: 30_000 });

      await page.goto("/notifications");
      await expect(
        page.getByText(new RegExp(`Assigned to order #${orderNumber}`)),
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        page.getByText(new RegExp(`Order #${orderNumber} started`)),
      ).toBeVisible({ timeout: 30_000 });

      await page.getByRole("button", { name: "Mark all read" }).click();
      await expect(page.getByText("All notifications marked read.")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: "Mark read" })).toHaveCount(0);
    } finally {
      await cleanupOrderTestData(stamp);
      if (toRestore.length > 0) {
        await page.goto("/notifications");
        for (const name of toRestore) {
          const toggle = page.getByRole("switch", { name });
          if ((await toggle.getAttribute("aria-checked")) === "true") await toggle.click();
        }
        await page.waitForTimeout(1500);
      }
    }
  });
});
