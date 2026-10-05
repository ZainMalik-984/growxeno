import { expect, test } from "@playwright/test";

/**
 * Phase 6 (Daily Statistics) — against the real database.
 *
 * Same credentials and skip behaviour as authenticated.spec.ts. Creates its
 * own entry (via the single add dialog) and deletes it via the UI's own
 * Delete button — unlike Orders, this domain has real delete UI, so no
 * separate database cleanup script is needed.
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

test.describe("Daily Statistics (Phase 6)", () => {
  test("adds an entry, edits it, then deletes it", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page);
    await page.goto("/daily-stats");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { level: 1, name: "Daily Statistics" })).toBeVisible({
      timeout: 30_000,
    });

    // --- Add an entry for today, for the signed-in admin ---
    await page.getByRole("button", { name: "Add entry" }).click();
    const addDialog = page.locator("dialog[open]");
    await addDialog.locator("#stat-user").selectOption({ index: 1 });
    await addDialog.locator("#stat-orders").fill("8");
    await addDialog.locator("#stat-completed").fill("6");
    await addDialog.locator("#stat-pending").fill("2");
    await addDialog.locator("#stat-revenue").fill("240");
    await addDialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Entry saved.")).toBeVisible({ timeout: 30_000 });

    // --- The new row appears in the Entries table ---
    // Scoped to a row with an Edit button: "By user" above it is a totals
    // summary with no actions, but also shows this user's "240.00 USD" and
    // would otherwise tie for the first `/240/`-matching row.
    const entryRow = () => page.getByRole("row").filter({ has: page.getByRole("button", { name: "Edit" }) });
    await expect(entryRow()).toBeVisible({ timeout: 30_000 });

    // --- Edit it ---
    await entryRow().getByRole("button", { name: "Edit" }).click();
    const editDialog = page.locator("dialog[open]");
    await editDialog.locator("#stat-orders").fill("9");
    await editDialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Entry updated.")).toBeVisible({ timeout: 30_000 });
    await expect(entryRow().getByRole("cell", { name: "9", exact: true })).toBeVisible({ timeout: 30_000 });

    // --- Delete it, cleaning up after the test ---
    await entryRow().getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Entry deleted.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("row", { name: /240/ })).toHaveCount(0, { timeout: 30_000 });
  });

  test("shows the overview charts and an export link", async ({ page }) => {
    test.setTimeout(60_000);
    await signIn(page);
    await page.goto("/daily-stats");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { level: 2, name: "Overview" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Export CSV" })).toBeVisible({ timeout: 30_000 });
  });

  test("bulk-enters a row for today, then copies it to tomorrow", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page);
    await page.goto("/daily-stats");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { level: 2, name: "Bulk entry" })).toBeVisible({ timeout: 30_000 });
    const bulkSection = page.locator("#bulk-entry");
    const firstRow = bulkSection.getByRole("row").nth(1); // 0 is the header row
    await firstRow.getByRole("cell").nth(1).locator("input").fill("5");
    await firstRow.getByRole("cell").nth(2).locator("input").fill("3");
    await firstRow.getByRole("cell").nth(3).locator("input").fill("2");
    await firstRow.getByRole("cell").nth(4).locator("input").fill("99");
    await bulkSection.getByRole("button", { name: "Save all" }).click();
    await expect(page.getByText(/Saved \d+ entr/)).toBeVisible({ timeout: 30_000 });

    const entryRow = () => page.getByRole("row").filter({ has: page.getByRole("button", { name: "Edit" }) });
    await expect(entryRow().filter({ hasText: "99 " })).toBeVisible({ timeout: 30_000 });

    // Advance the bulk-entry date by one day, then copy yesterday's (today's) row forward.
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await bulkSection.locator('input[type="date"]').fill(tomorrow);
    await page.waitForLoadState("networkidle");
    await bulkSection.getByRole("button", { name: "Copy previous day" }).click();
    await expect(page.getByText(/Copied \d+ entr/)).toBeVisible({ timeout: 30_000 });

    // Two rows now carry the 99 revenue: today's and the copied tomorrow's.
    await expect(entryRow().filter({ hasText: "99 " })).toHaveCount(2, { timeout: 30_000 });

    // --- Clean up both rows ---
    for (let i = 0; i < 2; i += 1) {
      await entryRow().filter({ hasText: "99 " }).first().getByRole("button", { name: "Delete" }).click();
      await expect(page.getByText("Entry deleted.")).toBeVisible({ timeout: 30_000 });
    }
    await expect(entryRow().filter({ hasText: "99 " })).toHaveCount(0, { timeout: 30_000 });
  });
});
