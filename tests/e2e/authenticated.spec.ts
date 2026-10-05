import { expect, test } from "@playwright/test";

/**
 * The signed-in Phase 1 flow, against a real database and a real Supabase
 * project.
 *
 * Credentials come from the environment, never from the repository. The suite
 * skips with a clear reason when they are absent, so a checkout without a
 * database reports NOT_RUN rather than a false pass.
 *
 * Run:
 *   E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… pnpm test:e2e
 * (or put them in .env.local and export before running)
 */

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;

test.skip(
  !EMAIL || !PASSWORD,
  "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (or SEED_ADMIN_*) to run the authenticated suite.",
);

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL!);
  await page.getByLabel("Password").fill(PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe("authenticated Super Admin", () => {
  test("signs in and reaches the dashboard", async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Good day");
    // Effective permission count is resolved from the database, not hard-coded.
    await expect(page.getByText("Effective permissions")).toBeVisible();
  });

  test("rejects a wrong password without revealing whether the account exists", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(EMAIL!);
    await page.getByLabel("Password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Scope to the form: Next.js renders its own role="alert" route announcer.
    await expect(
      page.locator("form").getByRole("alert"),
    ).toHaveText("Those credentials were not recognised.");
    await expect(page).toHaveURL(/\/login/);
  });

  test("shows the permission-aware sidebar for a Super Admin", async ({ page }) => {
    await signIn(page);
    const nav = page.getByRole("navigation", { name: "Main" });

    await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Users" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Roles" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Permissions" })).toBeVisible();
  });

  test("lists users from the database", async ({ page }) => {
    await signIn(page);
    await page.goto("/settings/users");

    await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();
    await expect(page.getByRole("link", { name: EMAIL!.split("@")[0], exact: false }).first())
      .toBeVisible();
    await expect(page.getByRole("cell", { name: EMAIL! })).toBeVisible();
  });

  test("shows the seeded roles with their permission counts", async ({ page }) => {
    await signIn(page);
    await page.goto("/settings/roles");

    await expect(page.getByRole("link", { name: "Super Admin" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin", exact: true })).toBeVisible();
    // exact: true — the sidebar's "Workers" and "Outsourced Workers" nav links
    // (Phase 5) both contain "Worker" as a substring, which Playwright's
    // default name matching treats as a match.
    await expect(page.getByRole("link", { name: "Worker", exact: true })).toBeVisible();
  });

  test("shows the seeded permission catalog with no drift", async ({ page }) => {
    await signIn(page);
    await page.goto("/settings/permissions");

    // The drift banner must be absent: code and database agree.
    await expect(page.getByText("defined in code but not seeded")).toHaveCount(0);
    await expect(page.getByText("85 permissions defined in code")).toBeVisible();
  });

  test("renders the effective-access view and refuses self-modification", async ({ page }) => {
    await signIn(page);
    await page.goto("/settings/users");

    // Open our own profile.
    const link = page.getByRole("row", { name: new RegExp(EMAIL!, "i") }).getByRole("link").first();
    await link.click();
    await page.waitForURL(/\/settings\/users\/[0-9a-f-]{36}/);

    await expect(page.getByText("Effective access")).toBeVisible();
    // Resolution sources are shown, which is the point of the view.
    await expect(page.getByText("Role", { exact: true }).first()).toBeVisible();

    // Safety rule: you cannot change your own access, so the override controls
    // are not offered on your own profile.
    await expect(page.getByText("You cannot change your own roles.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Deny", exact: true })).toHaveCount(0);
  });

  /**
   * The write path, against the real database.
   *
   * This is the test that matters most for Phase 1: it exercises a Server
   * Action -> authorization -> interactive transaction -> audit row, and it is
   * what caught the transaction timeout on a cold connection. Reads passing
   * while writes fail is exactly the kind of partial failure that hides.
   *
   * It acts on a SECOND user, because a user may not modify their own access.
   * Create one with:
   *   pnpm db:create-user --email worker.test@example.com --name "Test Worker" --role worker
   */
  test("assigns and removes a role on another user", async ({ page }) => {
    const workerEmail = process.env.E2E_WORKER_EMAIL;
    test.skip(!workerEmail, "Set E2E_WORKER_EMAIL to run the write-path test.");

    await signIn(page);
    await page.goto("/settings/users");

    await page
      .getByRole("row", { name: new RegExp(workerEmail!, "i") })
      .getByRole("link")
      .first()
      .click();
    await page.waitForURL(/\/settings\/users\/[0-9a-f-]{36}/);

    // Assign a role.
    await page.getByLabel("Role to assign").selectOption({ label: "Admin" });
    await page.getByRole("button", { name: "Assign role" }).click();
    await expect(page.getByText("Role assigned.")).toBeVisible({ timeout: 15_000 });
    // Generous timeout: the transition stays pending until the server has
    // re-rendered, and this database is in a distant region (~2 s per round
    // trip). The behaviour is correct, it is simply not instant.
    await expect(
      page.getByRole("listitem").filter({ hasText: "Admin" }),
    ).toBeVisible({ timeout: 30_000 });

    // Remove it again, leaving the user as we found them.
    await page.getByRole("button", { name: "Remove role Admin" }).click();
    await expect(page.getByText("Role removed.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Remove role Admin" })).toHaveCount(0, {
      timeout: 30_000,
    });
  });

  test("applies and clears a direct DENY override", async ({ page }) => {
    const workerEmail = process.env.E2E_WORKER_EMAIL;
    test.skip(!workerEmail, "Set E2E_WORKER_EMAIL to run the write-path test.");

    await signIn(page);
    await page.goto("/settings/users");
    await page
      .getByRole("row", { name: new RegExp(workerEmail!, "i") })
      .getByRole("link")
      .first()
      .click();
    await page.waitForURL(/\/settings\/users\/[0-9a-f-]{36}/);

    // orders.view is granted by the Worker role; a direct DENY must beat it.
    const row = page.getByRole("row").filter({ hasText: "orders.view" }).first();
    await row.getByRole("button", { name: "Deny", exact: true }).click();
    await expect(page.getByText("Direct DENY applied.")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Overrides" }).click();
    const overrideRow = page.getByRole("row").filter({ hasText: "orders.view" }).first();
    await expect(overrideRow.getByText("Direct deny")).toBeVisible({ timeout: 30_000 });
    await expect(overrideRow.getByText("Denied")).toBeVisible({ timeout: 30_000 });

    // Clear it; the permission must fall back to the role grant.
    await overrideRow.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByText("Override removed.")).toBeVisible({ timeout: 15_000 });
  });

  /**
   * Role CRUD (specification Section 7), against the real database.
   *
   * Creates its own role rather than touching a seeded one, and deletes
   * everything it made — including the mid-test rename, so nothing is left
   * behind for a re-run to collide with.
   */
  test("creates, renames, duplicates and deletes a role", async ({ page }) => {
    // Seven sequential round trips to a database whose latency has been
    // observed anywhere from tens of ms to multiple seconds per query —
    // the 90s default can be too tight on a slow day even though every step
    // individually succeeds.
    test.setTimeout(180_000);
    await signIn(page);
    await page.goto("/settings/roles");

    const roleName = `E2E Test Role ${Date.now()}`;

    await page.getByRole("button", { name: "New role" }).click();
    const createDialog = page.locator("dialog");
    await createDialog.getByLabel("Name").fill(roleName);
    await createDialog.getByRole("button", { name: "Create role" }).click();
    await page.waitForURL(/\/settings\/roles\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: roleName })).toBeVisible({
      timeout: 30_000,
    });

    const renamedName = `${roleName} renamed`;
    await page.getByRole("button", { name: "Rename" }).click();
    const renameDialog = page.locator("dialog");
    await renameDialog.getByLabel("Name").fill(renamedName);
    await renameDialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { level: 1, name: renamedName })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("button", { name: "Duplicate" }).click();
    const duplicateDialog = page.locator("dialog");
    await duplicateDialog.getByRole("button", { name: "Duplicate" }).click();
    await page.waitForURL(/\/settings\/roles\/[0-9a-f-]{36}/, { timeout: 30_000 });
    const duplicateName = `${renamedName} copy`;
    await expect(page.getByRole("heading", { level: 1, name: duplicateName })).toBeVisible({
      timeout: 30_000,
    });

    // Delete the duplicate — created with zero users, so deletion is allowed.
    await page.getByRole("button", { name: "Delete" }).click();
    const deleteDuplicateDialog = page.locator("dialog");
    await deleteDuplicateDialog.getByRole("button", { name: "Delete" }).click();
    await page.waitForURL(/\/settings\/roles$/, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: duplicateName })).toHaveCount(0);

    // Clean up the original test role too.
    await page.getByRole("link", { name: renamedName }).click();
    await page.waitForURL(/\/settings\/roles\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await page.getByRole("button", { name: "Delete" }).click();
    const deleteDialog = page.locator("dialog");
    await deleteDialog.getByRole("button", { name: "Delete" }).click();
    await page.waitForURL(/\/settings\/roles$/, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: renamedName })).toHaveCount(0);
  });

  /**
   * The invite form itself, without submitting it: submitting would email a
   * real invitation through the live Supabase project. This checks permission
   * gating and rendering only — the write path (createUser) is exercised by
   * TypeScript, unit coverage of its pure pieces, and manual verification.
   */
  test("renders the invite-a-user form", async ({ page }) => {
    await signIn(page);
    await page.goto("/settings/users/new");

    await expect(page.getByRole("heading", { level: 1, name: "Invite a user" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Full name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send invitation" })).toBeDisabled();
  });

  test("signs out and can no longer reach a protected page", async ({ page }) => {
    await signIn(page);

    await page.getByRole("button", { name: new RegExp(EMAIL!.split("@")[0], "i") }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await page.waitForURL(/\/login/);

    await page.goto("/settings/users");
    await expect(page).toHaveURL(/\/login/);
  });
});
