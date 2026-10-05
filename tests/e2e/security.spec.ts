import { expect, test } from "@playwright/test";

/**
 * Transport and session hardening (Phase 10) — checked on a real signed-in
 * session, not just configured: the response headers every page carries, and the
 * flags on the session cookie. Same credentials and skip behaviour as the other
 * authenticated suites.
 */

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;

test.skip(!EMAIL || !PASSWORD, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (or SEED_ADMIN_*) to run this suite.");

test("pages carry the security headers, and the framework is not advertised", async ({ page }) => {
  test.setTimeout(60_000);
  const response = await page.goto("/login");
  const headers = response!.headers();

  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["x-powered-by"]).toBeUndefined();

  const csp = headers["content-security-policy"];
  for (const directive of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) {
    expect(csp, `CSP must contain ${directive}`).toContain(directive);
  }
});

test("the session cookie cannot be read by page scripts and is not sent cross-site", async ({ page, context }) => {
  test.setTimeout(90_000);
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL!);
  await page.getByLabel("Password").fill(PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);

  const authCookies = (await context.cookies()).filter((c) => c.name.startsWith("sb-"));
  expect(authCookies.length).toBeGreaterThan(0);
  for (const cookie of authCookies) {
    expect(cookie.httpOnly, `${cookie.name} must be httpOnly`).toBe(true);
    expect(cookie.sameSite, `${cookie.name} must be SameSite=Lax`).toBe("Lax");
  }

  // The same fact seen from the page's own JavaScript: it must not be able to read the token.
  const visibleToScripts = await page.evaluate(() => document.cookie);
  expect(visibleToScripts).not.toContain("sb-");
});
