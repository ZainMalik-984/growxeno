import { expect, test } from "@playwright/test";

/**
 * Unauthenticated access control.
 *
 * These run WITHOUT any Supabase or database credentials, because they assert
 * the fail-closed behaviour: with nothing configured, every protected route
 * must still refuse to render. That is precisely the case worth testing without
 * infrastructure — a misconfigured deployment must not leak a dashboard.
 */

const PROTECTED_ROUTES = [
  "/dashboard",
  "/settings/users",
  "/settings/users/new",
  "/settings/roles",
  "/settings/permissions",
  "/buyers",
  "/buyers/new",
  "/customers",
  "/customers/new",
  "/contacts",
  "/categories",
  "/services",
  "/services/new",
  "/orders",
  "/orders/new",
  "/outsourced-workers",
  "/outsourced-workers/new",
];

test.describe("unauthenticated access", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route} redirects an anonymous visitor to the login page`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole("heading", { name: "Business Manager" })).toBeVisible();
    });
  }

  // The root path is the public marketing home page (confirmed directly,
  // 2026-10-03), not a redirect to the dashboard — it renders unconditionally,
  // without a Supabase session and without any database read, which is why
  // this lives in the "no infrastructure configured" file alongside the
  // fail-closed routes above rather than needing credentials of its own.
  test("the root path is the public marketing home page, not a redirect", async ({ page }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /Real growth for your/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("no protected content leaks into the redirected response body", async ({ page }) => {
    await page.goto("/settings/users");
    // The users table must not be present in any form.
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByText("Direct overrides")).toHaveCount(0);
  });

  test("the login page states what is missing when unconfigured", async ({ page }) => {
    await page.goto("/login");

    const configured = await page.getByLabel("Email").count();
    if (configured > 0) {
      // Supabase is configured in this environment: the real form renders.
      await expect(page.getByLabel("Password")).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    } else {
      // Unconfigured: say so plainly rather than showing a form that cannot work.
      await expect(page.getByText("This deployment is not configured yet")).toBeVisible();
    }
  });
});
