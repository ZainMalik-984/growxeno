# Development

## Prerequisites

| Tool | Version | Note |
| --- | --- | --- |
| Node.js | **≥ 22.12** | `.nvmrc` pins 22; verified on 22.23.2. **Node 20 does not work**: `@supabase/supabase-js` v2.116 throws at client construction because Node 20 has no global `WebSocket`, which breaks both the seed and sign-in |
| pnpm | 10.20.0 | pinned by `packageManager` |
| PostgreSQL | via Supabase | a local instance also works |

**pnpm is used through Corepack**, which ships with Node — nothing is installed machine-wide:

```bash
corepack pnpm install        # works immediately
corepack enable pnpm         # optional: gives you a bare `pnpm` command
```

Every `pnpm …` below can be read as `corepack pnpm …`.

## Setup

```bash
nvm use                           # or: nvm install 22 — see .nvmrc
corepack pnpm install
cp .env.example .env.local        # then fill in Supabase values
corepack pnpm db:generate         # generate the Prisma client
corepack pnpm db:migrate          # apply migrations (needs DIRECT_URL)
corepack pnpm db:seed             # permissions, roles, and optionally the first admin
corepack pnpm dev
```

Without Supabase credentials, steps 4–5 are skipped and `/login` says exactly what is missing.
`dev`, `build`, `lint`, `typecheck` and `test` all still work.

## Scripts

| Script | Does |
| --- | --- |
| `dev` | Next dev server |
| `build` / `start` | production build / serve |
| `typecheck` | `next typegen && tsc --noEmit` — typegen first, because `PageProps`/`LayoutProps` are generated |
| `lint` | ESLint |
| `test` / `test:watch` | Vitest (unit + component) |
| `test:e2e` | Playwright |
| `verify` | typecheck → lint → test → build. **Run before calling anything done** |
| `db:generate` | Prisma client |
| `db:migrate` / `db:migrate:deploy` / `db:migrate:status` | migrations |
| `db:seed` | idempotent seed |
| `db:create-user` | provision a user from the CLI (see below) |
| `db:studio` | Prisma Studio |

## Structure

```
prisma/
  schema/           one .prisma file per domain group
  migrations/
  seed.ts
src/
  app/
    (auth)/         login, account-inactive — no shell
    (app)/          authenticated shell; force-dynamic
  components/
    ui/             design-system primitives
    layout/         sidebar, user menu, icons
  lib/
    auth/           session resolution + authorization entry points
    permissions/    catalog, resolution, scopes   <- pure, no DB
    access/         queries / service / actions for RBAC
    audit/          audit writing
    db/             Prisma client
    supabase/       browser, server and admin clients
    navigation/     the nav tree
  generated/prisma/ generated client — gitignored, do not edit
tests/
  unit/ component/ e2e/
docs/
```

## Conventions

**Layering.** Presentation → authorization → service → data access. A Server Action never calls
Prisma directly; a service never reads cookies. This keeps services unit-testable and authorization
in one place.

**File naming inside `lib/<domain>/`:**

| File | Contains |
| --- | --- |
| `queries.ts` | reads. Explicit `select`. **No authorization** — the caller checks |
| `service.ts` | writes. Business rules, transactions, audit. Takes an already-authorized actor |
| `actions.ts` | `"use server"`. Validate → authorize → call service → revalidate |

**Server-only modules** carry `import "server-only"` — anything touching Prisma, secrets or
permission resolution. It turns a leak into a build error.

**Every query selects explicit columns.** No bare `findMany()`.

**Money** is `Decimal`, never `Float`, and is serialised to a string before crossing to the client.

**Dates**: instants are `timestamptz` and handled in UTC; a calendar date is a PostgreSQL `date`.
The browser formats, it never decides a day boundary.

## Adding things

### A permission

1. Add it to `PERMISSION_CATALOG` in `src/lib/permissions/catalog.ts`.
2. `pnpm db:seed` (idempotent).
3. Grant it to roles at `/settings/roles/[id]`.
4. Use `requirePermission("your.key")` — TypeScript checks the key.

For a record-scope permission, add the companion `your.key.all` and read it with `resolveScope`.
See `docs/PERMISSIONS.md` §3.

### A role

Roles are data. Create one in the UI, or add it to `ROLES` in `prisma/seed.ts` if it should exist in
every environment. **Never** branch on a role name in code — a unit test fails if you do.

### A module

1. Add its models to a new `prisma/schema/<domain>.prisma`; document them in `docs/DATABASE.md`.
2. `pnpm db:migrate --name add_<domain>`; review the generated SQL before committing.
3. Add permissions to the catalog; seed.
4. Create `src/lib/<domain>/{queries,service,actions}.ts`.
5. Add routes under `src/app/(app)/`, each calling `requirePermission`.
6. Add nav nodes in `nav-tree.ts` and flip `implemented: true`.
7. Add tests. Update `docs/REQUIREMENTS.md` with evidence.

### A user

Phase 1 has no in-app user-creation screen yet. The supported path is:

```bash
pnpm db:create-user --email ada@example.com --name "Ada Lovelace" --role worker
```

It creates the Supabase Auth identity, the application profile and the role
assignment in one go, writes an audit row, and prints a generated password once
if you did not supply one. Roles are given by slug (`super-admin`, `admin`,
`worker`). It requires `SUPABASE_SECRET_KEY`, so only someone with server access
can run it. Re-running it for an existing email reuses the auth identity rather
than failing.

### A migration

```bash
pnpm db:migrate --name descriptive_name
```

Review the SQL. **Never** run `prisma db push` or `migrate reset` against a populated or unknown
database. Before anything destructive: assess data loss, check dependent code, confirm a backup.

Migrations can be generated without a database:

```bash
pnpm exec prisma migrate diff --from-empty --to-schema prisma/schema --script
```

## Testing

| Layer | Runs | Scope |
| --- | --- | --- |
| unit | `tests/unit/**/*.test.ts`, node | pure logic: permission resolution, scopes, navigation, catalog |
| component | `tests/component/**/*.test.tsx`, jsdom | interactive components |
| e2e | `tests/e2e/**/*.spec.ts`, Playwright | real browser; some specs need a database |

```bash
pnpm test
pnpm exec playwright install chromium   # once
pnpm test:e2e
```

Never weaken a test to make it pass. A check that cannot run reports `NOT_RUN` with the reason.

## Gotchas found while building this

- **`prisma`'s npm `latest` tag is currently an 8.0.0 release candidate.** Both `prisma` and
  `@prisma/client` are pinned to exactly `7.10.0`. Do not `npm i prisma@latest`.
- **Prisma 7 requires a driver adapter** (`@prisma/adapter-pg` + `pg`) and a `prisma.config.ts`, and
  the generator must be `prisma-client` with an explicit `output`.
- **Next.js 16 renamed `middleware.ts` to `proxy.ts`**, exporting `proxy`.
- **`PageProps` / `LayoutProps` are generated**, so `tsc` fails on a clean checkout until
  `next typegen` runs. That is why `typecheck` chains them.
- **Authenticated routes must be `force-dynamic`.** Without it, a build on a machine with no
  Supabase env resolves the actor to null without reading cookies, so Next prerenders the pages and
  bakes in a redirect to `/login` — which then gets served to signed-in users.
- **`react-hooks/set-state-in-effect` is an error.** Reading `localStorage` into state in an effect
  is rejected; use `useSyncExternalStore` (see `use-persisted-flag.ts`) or derive the value.
- **Never nest a `<Link>` inside a `<Button>`.** Use `buttonVariants()` on the link.
- **`as const satisfies T[]`** narrows each entry to its literal type and drops optional fields; widen
  to `readonly T[]` before iterating over an optional property.
- **The Prisma CLI does not read `.env.local`.** That is a Next.js convention. `prisma.config.ts`
  and `prisma/seed.ts` load `.env.local` then `.env` explicitly with dotenv.
- **Supabase's direct host is IPv6-only** without the IPv4 add-on. On an IPv4 network use the pooler
  hostname for both URLs. Percent-encode special characters in the password.
- **Prisma's default transaction `maxWait` is 2000 ms**, measured from the start of the transaction,
  so it must also cover the connection handshake. Against a distant region the first query alone
  takes ~2 s and every cold write fails while reads succeed. `transactionOptions` is set on the
  client for this reason — do not remove it without re-measuring.
- **Never depend on the `searchParams` object in an effect that navigates.** `router.replace` returns
  a new object each time, so the effect re-fires forever. Depend on `searchParams.toString()` and
  guard against navigating to the URL you are already on.
- **A running `next dev` process does not pick up a new Prisma model without a restart.**
  `src/lib/db/prisma.ts` caches the `PrismaClient` singleton on `globalThis` so hot reload does not
  exhaust the connection pool — but that means an ALREADY-RUNNING dev server keeps the client built
  from the OLD generated client even after `prisma migrate dev` and `prisma generate` finish, and
  every call to the new model fails with `Cannot read properties of undefined (reading '<method>')`.
  Kill and restart `next dev` (not just save a file) after adding a model. This cost real time
  building Phase 2's Buyers/Customers — three E2E tests failed on this before the restart, not on a
  code bug.
- **Any index Prisma's schema does not declare will be proposed for DROP by the next `migrate dev`.**
  This bit three migrations (Phases 6, 7, 8) because the `pg_trgm` GIN index on
  `order_item_links.normalized_url` was added by hand in SQL. **Resolved in Phase 9**: Prisma *can*
  declare it, as `@@index([col(ops: raw("gin_trgm_ops"))], type: Gin, map: "...")` — no preview
  feature needed. That index and the 17 search indexes are now declared in `prisma/schema/*.prisma`,
  and `migrate dev` generates no `DROP INDEX` for them. Do the same for any new trigram index (never
  hand-add one). **Still read every generated `migration.sql` before applying it, always** — Prisma's
  other blind spots (a `varchar`→enum change drops and re-adds the column, see below) remain.
- **A day stored as `@db.Date` compares correctly across Prisma's JS `Date` boundary, but
  `Intl.DateTimeFormat` does NOT default to UTC.** Formatting a UTC-midnight `Date` (which is what a
  Postgres `date` column round-trips as) without an explicit `timeZone: "UTC"` shows the WRONG day in
  any browser/server whose local timezone is behind UTC — e.g. "16 Sept" renders as "15 Sept" in
  Pacific time. Every `Intl.DateTimeFormat` in this codebase must set `timeZone: "UTC"` explicitly;
  one was missed in the first draft of the Daily Statistics charts and caught only by an E2E
  screenshot, not by any type or lint check.
- **`proxy.ts` must use `auth.getSession()`, not `auth.getUser()`.** `getUser()` makes a real network
  round trip to Supabase Auth to revalidate the token; `getSession()` decodes the cookie locally. The
  proxy is explicitly NOT the authorization boundary (every page re-checks via `getCurrentActor()`,
  which does call the real `getUser()`), so calling `getUser()` here too was a second, redundant
  network hop added to every single navigation AND every Server Action (which are POSTs to the same
  route the proxy matches). Measured impact: `proxy.ts` timing dropped from 300-5000ms to a
  consistent 4-9ms after the fix. Do not "fix" this back to `getUser()` in the name of security — it
  adds latency with no security benefit, since a forged/expired session is still caught a moment
  later by the page's own check.
- **`prisma/seed.ts`'s independent steps must not run behind one that can throw.** Node 20 makes
  `seedSuperAdminUser()` throw (no global `WebSocket` — see the Node 22 note above); it once ran
  BEFORE `seedExpenseCategories()` in `main()`, so its unhandled throw silently stopped an unrelated
  step from ever running on the first attempt. Order independent seed steps before anything that can
  fail for reasons unrelated to them, and wrap a step that's known to be fragile under a specific
  environment (like the Node-20 admin-provisioning call) in try/catch so it logs instead of blocking
  everything after it.
- **E2E specs that reuse a fixed match string collide across runs when a model has no delete path.**
  `finance.spec.ts`'s "edit an expense" test matched a generic `"(edited, safe to ignore)"` suffix;
  once a second run left its own edited row in the database (Expenses are edit-in-place by design,
  D8 — no delete action exists), the generic filter matched two rows and failed with a Playwright
  strict-mode violation. Scope any such assertion to the run's own unique (timestamp-based)
  description, not just the literal suffix, whenever the entity under test has no delete/cleanup path.
- **Prisma's generated SQL for changing a column from `varchar` to an enum drops and re-adds the
  column — destroying data on a `NOT NULL` column with rows.** `20260918141857_add_messaging` changed
  `notification_outbox.event_type` this way; `migrate dev --create-only` correctly warned "No cast
  exists, the column would be dropped and recreated, which cannot be done since the column is required
  and there is data in the table." Check row counts before writing the fix (22 + 7 rows here), then
  hand-edit the migration: add a new enum column, `UPDATE ... CASE` old strings to enum members, set
  `NOT NULL`, drop the old column, rename. Verify afterward with a `groupBy`. `--create-only` is what
  makes this catchable at all — never let `migrate dev` apply a type change unreviewed.
- **`brew install <formula>` can balloon into compiling LLVM/Rust from source** on a macOS version
  newer than Homebrew has bottles for (this Mac is macOS 26: no bottle for `redis` or `openssl@3`).
  Watch the first ~30 seconds of output for `llvm-project`/`rust` source downloads and abort early;
  see docs/NOTIFICATIONS.md §7 for why the Redis queue was deferred instead.
- **`playwright test` does not read `.env.local`.** The specs read `process.env.SEED_ADMIN_*`
  directly and `test.skip` themselves silently (7 "skipped" in the list reporter, exit code 0) when
  the variables are absent. Export them first:
  `set -a && source <(grep -E "^SEED_ADMIN_(EMAIL|PASSWORD|NAME)=" .env.local) && set +a`.
- **Piping a long `playwright test` run through `| tail` shows nothing until the whole run ends**
  (tail buffers to EOF). For a 15+ minute full-suite run, redirect to a file
  (`> /tmp/e2e.log 2>&1`) and read it while it runs.
- **An E2E test that creates an order must delete it, or it leaks one row per run.** The app has no
  order-delete action by design, so `finance.spec.ts`'s refund test used to cancel its throwaway order and
  leave it: nine empty cancelled orders had accumulated by Phase 9. Tests now remove theirs through
  `scripts/e2e-cleanup-orders.ts --order-id <uuid>`, which refuses anything with a customer or
  expense (it refused a buyer or payment too, before Buyer was removed entirely, post-Phase-10).
  After any full E2E run, `Order` count should be back where it started.
- **Anything a server component passes to a client component is sent to the browser — hiding it in the UI
  is not enough.** Phase 10 found an order page handing a worker every item's price and cost inside the
  serialized props, merely not *rendering* them. Remove what an actor may not see on the server, before it
  is passed down (`src/lib/orders/visibility.ts`), and test the **raw HTML** (`page.content()`), not just
  what is visible. `tests/e2e/worker-boundaries.spec.ts` does this.
- **`startsWith("/") && !startsWith("//")` is not a safe redirect check.** Browsers treat `\` as `/`, so
  `/\evil.com` leaves the site, and a tab or newline inside `/\t/evil.com` is stripped by URL parsers. Use
  `safeRedirectPath()` (`src/lib/auth/redirect.ts`) for every user-supplied redirect target.
- **A stored URL rendered as an `href` must be restricted to `http:`/`https:`.** `new URL()` happily parses
  `javascript:` and `data:`. `normalizeUrl` rejects them at save time and `safeExternalHref` guards the
  render.
- **Extensions belong in the `extensions` schema, not `public`.** PostgREST exposes every function in an
  exposed schema as `/rpc/<name>`; `pg_trgm` in `public` put 31 helper functions on the public API. The
  session `search_path` includes `extensions`, so trigram indexes and `ILIKE` are unaffected.
- **`pnpm audit` findings that only touch the Prisma CLI can still be fixed with an override.**
  `pnpm-workspace.yaml` `overrides:` (mysql2, deepmerge-ts) — re-run `prisma validate`, `generate`,
  `migrate status` and `migrate diff` after each; all four still passed.
- **`zsh` treats an unmatched glob as an error.** `grep -rn x src --include=*.ts` fails with `no matches
  found`; use `grep -rn x src` or quote the glob.
- **Playwright can't type a raw control character through a shell heredoc** — the tool rejects the command.
  Build such strings with `String.fromCharCode(...)` (see `tests/unit/redirect.test.ts`).
