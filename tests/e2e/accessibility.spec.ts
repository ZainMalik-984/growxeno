import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Accessibility audit (specification Section 105, Final Quality Gate) — axe-core
 * against WCAG 2.0/2.1 A and AA on the real pages of the live application, signed
 * in as an administrator. Fails on any violation. Automated checks find roughly
 * a third of accessibility problems (contrast, names, roles, labels, structure);
 * they do not replace keyboard and screen-reader testing, which is stated in
 * docs/REQUIREMENTS.md rather than implied.
 */

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;

test.skip(!EMAIL || !PASSWORD, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (or SEED_ADMIN_*) to run this suite.");

const PAGES = [
  "/dashboard",
  "/orders",
  "/orders/new",
  "/buyers",
  "/buyers/new",
  "/customers",
  "/contacts",
  "/services",
  "/categories",
  "/workers",
  "/outsourced-workers",
  "/daily-stats",
  "/finance",
  "/finance/expenses",
  "/finance/buyer-payments",
  "/finance/worker-payments",
  "/finance/revenue",
  "/finance/profit",
  "/reports",
  "/reports/sales",
  "/reports/orders",
  "/reports/workers",
  "/reports/buyers",
  "/reports/customers",
  "/reports/profit",
  "/notifications",
  "/communication",
  "/communication/templates",
  "/communication/message-logs",
  "/settings/users",
  "/settings/roles",
  "/settings/permissions",
];

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.help} — e.g. ${v.nodes[0]?.target.join(" ")}`);
  expect(summary, `${label} has accessibility violations`).toEqual([]);
}

test("the login page has no accessibility violations", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await scan(page, "/login");
});

test("the public marketing home page has no accessibility violations", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Real growth for your/ })).toBeVisible();
  await scan(page, "/ (marketing home)");
});

test("every application page has no accessibility violations", async ({ page }) => {
  test.setTimeout(590_000);
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL!);
  await page.getByLabel("Password").fill(PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);

  const problems: string[] = [];
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    for (const v of results.violations) {
      problems.push(`${path}: ${v.id} (${v.impact}) x${v.nodes.length} — ${v.help} — e.g. ${v.nodes[0]?.target.join(" ")}`);
    }
  }
  expect(problems, `\n${problems.join("\n")}\n`).toEqual([]);
});

test("an order's detail page and the main dialogs, once opened, have no accessibility violations", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL!);
  await page.getByLabel("Password").fill(PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);

  // The detail page of a real order, then its "Add item" dialog.
  await page.goto("/orders");
  const firstOrder = page.getByRole("link", { name: /^#\d+/ }).first();
  await expect(firstOrder).toBeVisible({ timeout: 30_000 });
  await firstOrder.click();
  await page.waitForURL(/\/orders\/[0-9a-f-]{36}/);
  await page.waitForLoadState("networkidle");
  await scan(page, "order detail");
  const addItem = page.getByRole("button", { name: "Add item" });
  if (await addItem.count()) {
    await addItem.first().click();
    await scan(page, "order detail — Add item dialog");
    await page.keyboard.press("Escape");
  }

  for (const [path, button, name] of [
    ["/finance/expenses", "Add expense", "Add expense dialog"],
    ["/communication/templates", "New template", "New template dialog"],
    ["/daily-stats", "Add entry", "Add daily statistics dialog"],
  ] as const) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const trigger = page.getByRole("button", { name: button });
    if (await trigger.count()) {
      await trigger.first().click();
      await scan(page, name);
      await page.keyboard.press("Escape");
    }
  }

  // The global search dialog and the notification popover.
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Search" }).click();
  await scan(page, "global search dialog");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Notifications/ }).click();
  await scan(page, "notification popover");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Growth|Bridge|admin/i }).first().click();
  await scan(page, "user menu");
});
