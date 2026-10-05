import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { expect, test } from "@playwright/test";

const execFileAsync = promisify(execFile);

/**
 * Phase 4 (Orders) — the full lifecycle, against the real database.
 *
 * Same credentials and skip behaviour as authenticated.spec.ts. Creates its
 * own category/service/outsourced worker/order (timestamped names) and
 * cleans up afterward via a direct database call, the same discipline as
 * every other phase's E2E suite, since there is no order-delete UI
 * (specification Section 139 leaves order deletion as a Phase 4/7 "soft
 * delete", not yet built — CANCELLED is the interim functional equivalent).
 * There is nothing in the app itself to click, so cleanup shells out to
 * scripts/e2e-cleanup-orders.ts as a separate `tsx` process rather than
 * importing Prisma directly here — Playwright loads .spec.ts as ESM and
 * cannot resolve the generated client's CommonJS `exports` in-process.
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

async function cleanupOrderTestData(stamp: number) {
  try {
    // Bounded: this runs in afterEach's own timeout budget, separate from
    // the test body's, but a hung subprocess (e.g. a slow `npx` resolve
    // under today's DB latency) should still not run forever.
    await execFileAsync("npx", ["tsx", "scripts/e2e-cleanup-orders.ts", String(stamp)], {
      cwd: process.cwd(),
      timeout: 60_000,
    });
  } catch (error) {
    // Best-effort: never let cleanup failure mask the test's own result.
    console.error("cleanupOrderTestData failed:", error);
  }
}

async function runOrderLifecycle(page: import("@playwright/test").Page, stamp: number) {
  await signIn(page);
  const categoryName = `E2E Test Category ${stamp}`;
  const serviceName = `E2E Test Service ${stamp}`;
  const workerName = `E2E Test Worker ${stamp}`;

  // --- Prerequisites: category, service, outsourced worker ---
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

  // --- Create the order ---
  await page.goto("/orders/new");
  // A freshly-navigated page's React tree can still be hydrating when a
  // fill() lands: the DOM value gets set natively, reads back fine, but
  // then React commits its (still-empty) controlled state over the top,
  // silently reverting it. Waiting for networkidle gives hydration time
  // to finish before any field is touched, on this and every other fresh
  // goto() below.
  await page.waitForLoadState("networkidle");
  const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  await page.getByLabel("Deadline").fill(deadline);
  await page.getByRole("button", { name: "Create order" }).click();
  await page.waitForURL(/\/orders\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1, name: /Order #\d+/ })).toBeVisible({
    timeout: 30_000,
  });

  // --- Add an item ---
  await page.getByRole("button", { name: "Add item" }).click();
  const addItemDialog = page.locator("dialog[open]");
  await addItemDialog.getByLabel("Service").selectOption({ label: `${categoryName} · ${serviceName}` });
  await addItemDialog.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("Item added.")).toBeVisible({ timeout: 30_000 });
  // Scoped to the item row itself: the service name also appears in the
  // (still-mounted) dialog's <select> options and in the activity feed.
  const itemRow = page.locator("li").filter({ hasText: serviceName }).first();
  await expect(itemRow).toBeVisible({ timeout: 30_000 });

  // --- Assign the outsourced worker ---
  await page.getByLabel("Assigned to").selectOption({ label: `${workerName} (outsourced)` });
  await expect(page.getByText("Assignment updated.")).toBeVisible({ timeout: 30_000 });

  // --- Add a link to the item ---
  await page.getByRole("button", { name: /Links \(0\)/ }).click();
  await page.getByPlaceholder("https://example.com/project").fill("https://example.com/e2e-project/");
  await page.getByRole("button", { name: "Add link" }).click();
  await expect(page.getByText("Link added.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "https://example.com/e2e-project/" })).toBeVisible({
    timeout: 30_000,
  });

  // --- Process the order (PENDING -> PROCESSING, item PENDING -> IN_PROGRESS) ---
  await page.getByRole("button", { name: "Process order" }).click();
  await expect(page.getByText("Order processed.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Processing", { exact: true }).first()).toBeVisible({ timeout: 30_000 });

  // --- Move the item to Internal Review, then Completed ---
  await page.getByLabel("Move to").selectOption({ label: "Internal Review" });
  await expect(page.getByText("Item status updated.")).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Move to").selectOption({ label: "Completed" });
  await expect(page.getByText("Item status updated.")).toBeVisible({ timeout: 30_000 });

  // --- Move the order forward: IN_PROGRESS was reached via Process; now
  // Internal Review -> Ready for Delivery -> Delivered -> Completed ---
  await page.getByRole("button", { name: "In Progress" }).click();
  const inProgressDialog = page.locator("dialog[open]");
  await inProgressDialog.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Status updated.", { exact: true })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Internal Review" }).click();
  const reviewDialog = page.locator("dialog[open]");
  await reviewDialog.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Status updated.", { exact: true })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Ready for Delivery" }).click();
  const readyDialog = page.locator("dialog[open]");
  await readyDialog.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Status updated.", { exact: true })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Delivered" }).click();
  const deliveredDialog = page.locator("dialog[open]");
  await deliveredDialog.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Status updated.", { exact: true })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Completed" }).click();
  const completedDialog = page.locator("dialog[open]");
  await completedDialog.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Status updated.", { exact: true })).toBeVisible({ timeout: 30_000 });

  // --- Add a note, and confirm the activity feed recorded the journey ---
  // Notes live behind the floating "Notes" button, not inline on the page
  // (confirmed directly, 2026-10-01) — open it before reaching for the form.
  await page.getByRole("button", { name: /^Notes/ }).click();
  // The four rapid status confirmations above each trigger a router.refresh();
  // if one of those RSC refreshes lands right as we fill the note textarea, the
  // form (a Client Component) can remount and reset its local state back to
  // empty, leaving "Add note" disabled with nothing left to re-fill it. Retry
  // the fill until the button actually reflects it, instead of assuming one
  // fill call survives any in-flight refresh.
  await expect(async () => {
    await page.getByPlaceholder("Add an internal note…").fill("E2E lifecycle test note");
    await expect(page.getByRole("button", { name: "Add note" })).toBeEnabled();
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("Note added.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("E2E lifecycle test note")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Order #\d+ processed/)).toBeVisible({ timeout: 15_000 });

  // --- Confirm it is findable through the order-item link filter ---
  await page.goto("/orders?link=example.com");
  await expect(page.getByText(/#\d+/).first()).toBeVisible({ timeout: 30_000 });
}

test.describe("Orders (Phase 4)", () => {
  // Set by the test itself, read by afterEach — a plain `let`, not a fixture,
  // because cleanup must run in afterEach's OWN timeout budget rather than
  // inside a try/finally in the test body: a slow cleanup subprocess there
  // would silently eat the test's remaining timeout and replace a real
  // failure's specific error with a generic "test timeout exceeded".
  let stamp: number | undefined;

  test.afterEach(async () => {
    if (stamp !== undefined) await cleanupOrderTestData(stamp);
  });

  test("creates a category, service and outsourced worker, then runs an order through its full lifecycle", async ({
    page,
  }) => {
    // Generous: this suite's ~25 sequential server round-trips have been
    // observed taking 5-19s each against the live Supabase pooler, well
    // above typical local-dev latency.
    test.setTimeout(480_000);
    stamp = Date.now();
    await runOrderLifecycle(page, stamp);
  });
});
