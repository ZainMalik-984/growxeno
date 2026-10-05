import { readFileSync } from "node:fs";

import { expect, request, test, type Page } from "@playwright/test";

/**
 * Data boundaries for a LOW-PRIVILEGE signed-in user (Phase 10).
 *
 * Signs in as a throwaway user holding only the seeded Worker role, and checks
 * that nothing beyond that role's reach comes back — from pages, from the search
 * endpoint, and from the export endpoint. Also checks that an anonymous caller
 * gets nothing from the two JSON/CSV endpoints. The user is created and deleted
 * by scripts/e2e-worker-fixture.ts; point E2E_WORKER_FIXTURE at its credentials
 * file (see docs/DEVELOPMENT.md). Skipped when not set.
 */

type Fixture = {
  email: string;
  password: string;
  customerId: string;
  foreignOrderId: string | null;
  assignedOrderId: string;
  assignedOrderNumber: number;
  stamp: number;
};

const fixturePath = process.env.E2E_WORKER_FIXTURE;
const fixture: Fixture | null = fixturePath ? (JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture) : null;

async function signInAsWorker(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(fixture!.email);
  await page.getByLabel("Password").fill(fixture!.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe("anonymous callers get nothing from the data endpoints", () => {
  for (const path of ["/search?q=growth", "/daily-stats/export"]) {
    test(`${path} returns no data`, async ({ baseURL }) => {
      const context = await request.newContext({ baseURL });
      const response = await context.get(path, { maxRedirects: 0 });
      expect([301, 302, 303, 307, 308, 401, 403]).toContain(response.status());
      expect(await response.text()).not.toContain('"results"');
      await context.dispose();
    });
  }
});

test.describe("a signed-in Worker cannot read beyond their role", () => {
  test.skip(!fixture, "Set E2E_WORKER_FIXTURE (run scripts/e2e-worker-fixture.ts create <file>) to run this suite.");

  const FORBIDDEN_PAGES = [
    "/finance",
    "/finance/expenses",
    "/finance/worker-payments",
    "/finance/revenue",
    "/finance/profit",
    "/reports",
    "/reports/sales",
    "/reports/orders",
    "/reports/workers",
    "/reports/customers",
    "/reports/profit",
    "/settings/users",
    "/settings/roles",
    "/settings/permissions",
    "/customers",
    "/workers",
    "/outsourced-workers",
    "/communication",
    "/communication/templates",
    "/communication/message-logs",
    "/services",
    "/categories",
    "/orders/new",
  ];

  test("every management, finance, report and CRM page is forbidden", async ({ page }) => {
    test.setTimeout(240_000);
    await signInAsWorker(page);
    for (const route of FORBIDDEN_PAGES) {
      await page.goto(route);
      await expect(page, `${route} should be forbidden`).toHaveURL(/\/forbidden/);
      await expect(page.getByRole("table"), `${route} must render no table`).toHaveCount(0);
    }
  });

  test("the customer detail page is forbidden even with a valid id", async ({ page }) => {
    test.setTimeout(90_000);
    await signInAsWorker(page);
    await page.goto(`/customers/${fixture!.customerId}`);
    await expect(page, "the customer detail page should be forbidden").toHaveURL(/\/forbidden/);
  });

  test("an order the worker is not assigned to is not readable", async ({ page }) => {
    test.setTimeout(90_000);
    test.skip(!fixture!.foreignOrderId, "No existing order to test against.");
    await signInAsWorker(page);
    await page.goto(`/orders/${fixture!.foreignOrderId}`);
    // Either bounced, or a 404 — but never the order itself.
    await expect(page.getByRole("heading", { level: 2, name: "Summary" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "Financials" })).toHaveCount(0);
    await expect(page.getByText("Worker cost")).toHaveCount(0);
  });

  test("an ASSIGNED order shows the worker only their own item — no prices, costs, customer or total", async ({ page }) => {
    test.setTimeout(90_000);
    await signInAsWorker(page);
    await page.goto(`/orders/${fixture!.assignedOrderId}`);
    await expect(page.getByRole("heading", { level: 1, name: `Order #${fixture!.assignedOrderNumber}` })).toBeVisible({ timeout: 30_000 });

    // What they may see: their own item.
    await expect(page.getByText(`E2E Own Service ${fixture!.stamp}`)).toBeVisible();

    // What they may not — checked in the rendered page AND in the raw HTML, which includes the
    // serialized data handed to client components (hidden-by-CSS values would still be in it).
    const forbidden = [
      "67.89",
      "9999.99",
      "679.00",
      `E2E Test Customer ${fixture!.stamp}`,
      `E2E Other Service ${fixture!.stamp}`,
      `E2E Test Outsourced ${fixture!.stamp}`,
      "Total amount",
      "worker cost",
    ];
    const html = await page.content();
    for (const value of forbidden) {
      expect(html, `"${value}" must not be anywhere in the page a worker receives`).not.toContain(value);
    }
  });

  test("the orders list gives a worker their assignment with no money, parties, or other people's names", async ({ page }) => {
    test.setTimeout(90_000);
    await signInAsWorker(page);
    await page.goto("/orders");
    await expect(page.getByRole("link", { name: `#${fixture!.assignedOrderNumber}` })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("columnheader", { name: "Amount" })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: /Customer/ })).toHaveCount(0);

    await page.getByRole("button", { name: "More filters" }).click();
    for (const label of ["Customer", "Worker", "Outsourced worker", "Service", "Category"]) {
      await expect(page.getByLabel(label, { exact: true }), `the ${label} filter must not be offered`).toHaveCount(0);
    }
    const html = await page.content();
    for (const value of [`E2E Test Customer ${fixture!.stamp}`, `E2E Test Outsourced ${fixture!.stamp}`, "Growth Bridge"]) {
      expect(html, `"${value}" must not be in the orders list a worker receives`).not.toContain(value);
    }
  });

  test("search returns nothing the worker may not view", async ({ page }) => {
    test.setTimeout(90_000);
    await signInAsWorker(page);

    for (const term of ["E2E Test Customer", "E2E Test Outsourced", "gmail", "growth", "7771111", "7770000"]) {
      const response = await page.request.get(`/search?q=${encodeURIComponent(term)}`);
      expect(response.status()).toBe(200);
      const body = (await response.json()) as { results: Record<string, unknown[]> };
      for (const category of ["Orders", "Customers", "Workers", "Services", "Categories"]) {
        expect(body.results[category], `"${term}" must return no ${category} to a worker`).toEqual([]);
      }
    }
  });

  test("the export endpoint refuses a worker without the export permission", async ({ page }) => {
    test.setTimeout(60_000);
    await signInAsWorker(page);
    const response = await page.request.get("/daily-stats/export");
    expect(response.status()).toBe(403);
    expect(await response.text()).not.toContain("Revenue");
  });

  test("the worker sees no finance or management entries in the sidebar", async ({ page }) => {
    test.setTimeout(60_000);
    await signInAsWorker(page);
    const nav = page.getByRole("navigation", { name: "Main" });
    for (const label of ["Finance", "Reports", "Customers", "Communication", "Settings", "Users"]) {
      await expect(nav.getByText(label, { exact: true }), `${label} must not be in this worker's sidebar`).toHaveCount(0);
    }
  });
});
