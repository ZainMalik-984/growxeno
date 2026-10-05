import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests.
 *
 * These require a real, migrated, seeded database and a configured Supabase
 * project. They are NOT part of `pnpm verify` for that reason — a suite that
 * cannot run in the default environment should fail loudly when invoked, not
 * quietly pass in CI.
 *
 * Run: pnpm db:migrate && pnpm db:seed && pnpm test:e2e
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  /**
   * Generous, because these tests talk to a real Supabase project that may be
   * in a distant region. Measured against ap-northeast-2 from Europe, a single
   * cold query round trip is ~2 s, and a write plus the server re-render that
   * follows it comfortably exceeds a 30 s test budget. Raising this is about
   * network distance, not about hiding slow code.
   */
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Invoked via the locally-installed binary rather than through a
        // package-manager script, so the suite does not depend on `pnpm` being
        // on PATH (it is used through Corepack in this project).
        command: "npx next dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
