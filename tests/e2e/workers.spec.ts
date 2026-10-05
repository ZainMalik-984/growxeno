import { expect, test } from "@playwright/test";

/**
 * Phase 5 (Worker Dashboard, Actions, Profile) — against the real database.
 *
 * Same credentials and skip behaviour as authenticated.spec.ts. The admin
 * seed account holds `orders.view.all` and `workers.view.all`, so this
 * covers the roster/profile pages and the dashboard's "Your work" section
 * rendering correctly; it does not exercise the assigned-worker-only scope
 * restriction (that needs a second, lower-privileged identity signed in
 * concurrently) — that restriction is covered by code review, recorded in
 * docs/REQUIREMENTS.md.
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

test.describe("Workers (Phase 5)", () => {
  test("dashboard shows a Your work section", async ({ page }) => {
    test.setTimeout(60_000);
    await signIn(page);
    await expect(page.getByRole("heading", { level: 2, name: "Your work" })).toBeVisible({ timeout: 30_000 });
  });

  test("the workers roster lists a worker and opens their profile", async ({ page }) => {
    test.setTimeout(60_000);
    await signIn(page);
    await page.goto("/workers");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1, name: "Workers" })).toBeVisible({ timeout: 30_000 });

    const firstWorkerLink = page.locator("table a").first();
    await expect(firstWorkerLink).toBeVisible({ timeout: 30_000 });
    await firstWorkerLink.click();

    await page.waitForURL(/\/workers\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 2, name: "Profile" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 2, name: "Work" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 2, name: "Not available yet" })).toBeVisible({
      timeout: 30_000,
    });
  });
});
