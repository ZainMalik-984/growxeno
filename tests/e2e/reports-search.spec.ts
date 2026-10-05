import { expect, test } from "@playwright/test";

/**
 * Phase 9 (Reports) and Global search (Section 76) — against the real database.
 * Same credentials and skip behaviour as finance.spec.ts. Read-only: nothing
 * here creates data, so nothing needs cleaning up.
 */

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? "Growth Bridge";

test.skip(!EMAIL || !PASSWORD, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (or SEED_ADMIN_*) to run this suite.");

/** Ctrl+K, retried until the page has hydrated and the handler is attached. */
async function openSearch(page: import("@playwright/test").Page) {
  const dialog = page.locator("dialog[open]");
  await expect(async () => {
    await page.keyboard.press("Control+k");
    await expect(dialog).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  return dialog;
}

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL!);
  await page.getByLabel("Password").fill(PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe("Reports (Phase 9)", () => {
  test("every report renders against the live database", async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page);

    for (const [path, heading] of [
      ["/reports", "Reports"],
      ["/reports/sales", "Sales"],
      ["/reports/orders", "Orders"],
      ["/reports/workers", "Workers"],
      ["/reports/customers", "Customers"],
      ["/reports/profit", "Profit"],
    ] as const) {
      await page.goto(`${path}?range=90d`);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible({ timeout: 30_000 });
      // A failing query lands on the error boundary instead of the report.
      await expect(page.getByRole("heading", { name: "Something broke" })).toHaveCount(0);
    }
  });

  test("an oversized custom range is clamped rather than run unbounded", async ({ page }) => {
    test.setTimeout(60_000);
    await signIn(page);
    await page.goto("/reports/sales?range=custom&from=2015-01-01");
    await expect(page.getByText(/wider than 366 days/)).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("Global search (Section 76)", () => {
  test("Ctrl+K finds a worker, groups results by category, and navigates", async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page);

    const dialog = await openSearch(page);

    await dialog.getByRole("textbox", { name: "Search" }).fill(ADMIN_NAME.split(" ")[0].toLowerCase());
    await expect(dialog.getByRole("heading", { name: "Workers" })).toBeVisible({ timeout: 30_000 });
    await dialog.getByRole("button", { name: new RegExp(ADMIN_NAME) }).first().click();
    await page.waitForURL(/\/workers\/[0-9a-f-]{36}/, { timeout: 30_000 });
  });

  test("does not hit the server per keystroke, or for a repeated term", async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page);

    const searchRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/search") searchRequests.push(request.url());
    });

    const dialog = await openSearch(page);
    const input = dialog.getByRole("textbox", { name: "Search" });

    // One character: below the minimum, so nothing is sent.
    await input.fill("g");
    await page.waitForTimeout(600);
    expect(searchRequests).toHaveLength(0);

    // Typed quickly, character by character: debounced into a single request.
    await input.fill("");
    await input.pressSequentially("growth", { delay: 40 });
    await expect.poll(() => searchRequests.length, { timeout: 30_000 }).toBe(1);
    // Let the response land (and be cached) — clearing the box first would abort it.
    await expect(dialog.getByRole("heading", { name: "Workers" })).toBeVisible({ timeout: 30_000 });

    // The same term again is answered from the in-memory cache.
    await input.fill("");
    await input.fill("growth");
    await page.waitForTimeout(800);
    expect(searchRequests).toHaveLength(1);
  });
});
