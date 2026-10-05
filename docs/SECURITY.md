# Security

How data is protected, what was found when this was audited (Phase 10, 2026-09-19), and how to check
it again. This document describes what is **implemented**; the reasoning behind the access model is in
`docs/PERMISSIONS.md`, and every interface is listed in `docs/API.md`.

The question that drove the audit: *can anyone read the database, or private data, through any API
they should not be able to reach?*

---

## 1. Where data can leave the system

There are only these doors. Each is closed by something that is tested.

| Door | Who can open it | Closed by | Checked by |
| --- | --- | --- | --- |
| Supabase PostgREST / GraphQL / Storage / Realtime, using the **public key** every browser holds | nobody | RLS on all 30 tables with **no policies**, no grants to `anon`/`authenticated`, no views, no callable functions, no public buckets, nothing published to Realtime | `pnpm security:audit` — 20 checks against the live project |
| Server-rendered pages | signed-in users, per permission | `requirePermission` / `requireScope` in every page; the proxy only redirects | `worker-boundaries.spec.ts`, `access-control.spec.ts` |
| Server Actions (74) | signed-in users, per permission | `authorizeAction(key)` in every one, plus Zod input validation | `api-doc.test.ts` fails if any action lacks an authorization call |
| `GET /search`, `GET /daily-stats/export`, `GET /auth/callback` | signed-in, per category / `daily_stats.export` / a one-time link | authorized inside each handler | `worker-boundaries.spec.ts` |
| The page payload itself (what a page hands to client components) | the viewer | `redactOrderDetail()` removes data on the **server** before it is serialized | unit tests + a raw-HTML assertion in E2E |
| Secrets in the browser bundle, git history, or committed files | nobody | secrets are server-only env vars; `NEXT_PUBLIC_*` holds only the public URL and key | `pnpm security:secrets` |

Prisma connects as the database owner and **bypasses RLS**. That is by design: RLS is a second wall for
the public-key door, and the application server is the real authorization point. Nothing a request
contains can change which database role Prisma uses.

## 2. What a user with a low-privilege role can receive

The seeded **Worker** role holds `orders.view` (not `.all`), `workers.view` (own profile), and a few
others — and nothing financial. Verified by signing in as a real Worker (a throwaway account, created
and deleted by `scripts/e2e-worker-fixture.ts`):

- Every management, finance, report, CRM and communication page → `/forbidden`, and no table renders.
- An order they are **not** assigned to → not readable.
- An order they **are** assigned to → only *their own item*. No prices, costs, customer, order
  total, other workers' items, or outsourced workers' names — checked in the rendered page **and in the
  raw HTML** (which contains the data handed to client components).
- The orders list → no Amount or Customer column; no customer, worker, service or
  category filters (their lists are not even loaded). (Buyer was removed from Order entirely,
  post-Phase-10 — there is no Buyer column or filter to check any more.)
- `/search` → nothing from any category they may not view. `/daily-stats/export` → 403.
- Sidebar → no Finance, Reports, CRM, Communication or Settings entries.

## 3. Findings from the Phase 10 audit, and their fixes

| # | Finding | Severity | Fix |
| --- | --- | --- | --- |
| 1 | **A worker assigned to one item of an order received every item, each with the client's price and each worker's cost, plus the buyer, customer and total** — serialized into their page. Spec §44 says workers must not automatically receive financial information (Buyer was removed from Order entirely, post-Phase-10 — the fix below now redacts only price, cost, total and customer) | **High** | `orderVisibility()` / `redactOrderDetail()`: the data is removed server-side. Costs and prices also removed from the activity feed text (`order_item.cancelled_with_adjustment` used to write cost figures into it; they now live only in the audit log) |
| 2 | The **orders list** showed a worker Buyer/Customer and Amount columns, and loaded every buyer, customer, worker and service name into the filter dropdowns (Buyer/buyer removed entirely, post-Phase-10 — only Customer/Amount and customer/worker/service filters remain to gate) | **High** | Pickers are not loaded, and columns not rendered, without the matching permission. Amount filters (a way to binary-search a price) are ignored |
| 3 | **Stored XSS via order item links.** `normalizeUrl` accepted `javascript:`, `data:` and any other scheme, and the link was rendered as a clickable `href`. A worker who may attach a link could run script as the admin who clicked it | **High** | Only `http:`/`https:` are accepted (`normalizeUrl`) and the rendered `href` is checked again (`safeExternalHref`). No stored link had a bad scheme |
| 4 | **Open redirect** after login and in the emailed-link callback: `/\evil.com` passed the `startsWith("/")` check, and browsers treat `\` as `/` | Medium | One shared `safeRedirectPath()`, parsed against a throwaway origin; rejects `//host`, backslashes and control characters |
| 5 | **Outsourced workers' names, phones and notes were readable by any Worker** (page and search) because those pages were gated on `workers.view`, the "my own profile" key | Medium | Gated on `workers.view.all` (page, detail, search, sidebar) |
| 6 | **No security headers** — no clickjacking, MIME-sniffing or content-security policy, and the framework version was advertised | Medium | CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP, HSTS (production), `X-Powered-By` removed, no browser source maps |
| 7 | The **session cookie was readable by page JavaScript** | Medium | `HttpOnly`, `SameSite=Lax`, `Secure` in production. The browser Supabase client is never used, so nothing needs script access |
| 8 | **`SETUP_LOG.md` (a live plaintext password) was neither tracked nor git-ignored** — one `git add .` from being committed. `docs/REQUIREMENTS.md` also contained the real admin email | Medium | Git-ignored, and `test-results/` too; the email redacted from the docs. **The password should still be rotated** (see §5) |
| 9 | 31 `pg_trgm` helper functions were callable as `/rest/v1/rpc/…` with the public key. They read no table, but were needless surface | Low | Extension moved to the `extensions` schema (PostgREST does not expose it); default privileges no longer auto-grant future functions |
| 10 | 3 vulnerable dependencies (`mysql2` x2, `deepmerge-ts`), all reachable only through the Prisma CLI, not the running app | Low | `pnpm` overrides; `pnpm audit --prod` is clean; Prisma validate/generate/migrate re-verified |
| 11 | Password reset minimum was 8 characters | Low | 12 |
| 12 | Colour contrast failed WCAG AA on nearly every page; 16 form controls had no accessible name; a popover used a wrong ARIA role | — (accessibility) | Text tokens darkened; labels added; role corrected. `axe-core` now passes on all 33 pages and the opened dialogs |

What was checked and found **already fine**: RLS on every table; no browser-side Supabase calls;
`SUPABASE_SECRET_KEY` only in a `server-only` module; none of your 13 secret values appear in the
browser bundle, any committable file, or git history; every action authorizes; audit rows never store
passwords; error pages show a digest, not a stack trace; identity is matched by Supabase user id, not
email, so a stray signup gets no access.

## 4. Re-checking it

```bash
pnpm security:audit      # the live database and Supabase APIs, with only the public key (20 checks)
pnpm build && pnpm security:secrets   # secret values vs. the browser bundle, committable files, git history
pnpm audit --prod        # dependency advisories
pnpm test                # includes: every action authorizes; API.md is complete; visibility rules
# data boundaries as a real low-privilege user (creates and deletes a throwaway account):
npx tsx scripts/e2e-worker-fixture.ts create /tmp/fx.json
E2E_WORKER_FIXTURE=/tmp/fx.json pnpm test:e2e tests/e2e/worker-boundaries.spec.ts
npx tsx scripts/e2e-worker-fixture.ts delete /tmp/fx.json
```

Run `security:audit` after **every** migration and after any change in the Supabase dashboard.

## 5. Open items — need a person, not code

1. **Turn off open self-signup** in Supabase (Authentication → Sign In / Providers → uncheck *Allow new
   users to sign up*). It is currently on, which `security:audit` reports as a FAIL. It grants no access
   to the app (a stray identity has no profile), but anyone with the public key can create auth users and
   trigger confirmation emails through your Resend account — a cost and spam risk. Users are created by
   administrators, which works with signup off.
2. **Rotate the seeded Super Admin password.** It was set in `.env.local`/`SETUP_LOG.md`, is short, and
   the account can do everything. Use a long random password, then delete `SETUP_LOG.md`.
3. **Enable MFA** for administrators in Supabase (Authentication → Multi-Factor), and consider a
   minimum password length of 12+ in Supabase's own policy (the app enforces 12 on reset only).
4. **Rate limiting** on sign-in is Supabase Auth's built-in limit; the app adds none. Fine at this size.

## 6. Design constraints for what is not built yet

- **File uploads (Storage)** must use a **private** bucket and short-lived signed URLs issued by a
  handler that checks the same order visibility rule as the page. `security:audit` already fails on a
  public bucket.
- **The WhatsApp webhook** must verify Meta's signature (`WHATSAPP_APP_SECRET`) and reject replays.
- **A nonce-based CSP** would let `script-src` drop `'unsafe-inline'`, but needs every page dynamic;
  today the CSP is defence in depth, and the XSS controls are escaping, no raw HTML, and http(s)-only links.
- **Realtime for the notification bell** needs a reviewed RLS policy scoped to the recipient; until then
  the bell refreshes on navigation.
