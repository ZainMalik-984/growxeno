# Business Manager

An internal business operations platform: customers, workers, orders and order items, assignments,
deadlines, manually entered daily statistics, finance, files, audit history, notifications, reports,
and a fully dynamic role and permission system.

> **Current state: Phases 1–7, 9 and 10 complete, Phase 8 partially (see below), except order files.** The application shell, authentication,
> the dynamic RBAC system, password reset, Customers, Categories/Services, Orders, the Worker
> Dashboard/Actions/Profile, Daily Statistics, and Finance are all built. There are **no pricing
> tiers** — an earlier version had them; the owner does not use tiers, and they were removed. A
> service's base price still exists as a reference figure, but since the post-Phase-10 Order Item
> redesign (below) an Order Item has no price of its own to prefill — an order's price is one number
> for the whole order. Orders carry the full state machine (Process Order, item-independent statuses,
> normalized URL search, an admin-only escape hatch to flag a completed item back to Revision) and
> assign work to an internal user or a distinct, login-less outsourced worker. Order **files** are
> not built — no Supabase Storage bucket is configured in this project; a worker attaches their
> deliverable as an Order Item link instead. Daily statistics are manually entered and never inferred
> from Orders, by requirement. Finance computes a Worker's earned/paid/outstanding at read time from
> Orders and payments — **never a stored balance** — and never sums across currencies (revenue is
> typically USD; worker cost and expenses are typically PKR). Order cancellation supports paying an
> outsourced worker for partial work already done, with a mandatory note and an outbox notification
> to stop work. **Every business decision that blocked a built phase is answered** (D9 timezone and
> D11 "required item" keep documented interim defaults). **Phase 8 (Notifications) is partial:** in-app
> notifications (header bell, `/notifications`), per-event/per-channel preferences, validated message
> templates and a message-log viewer work; **no email or WhatsApp is ever sent**, because the Redis +
> BullMQ queue the specification requires does not exist (a local install would have meant compiling
> LLVM/Rust from source on this macOS version, so it was deferred — docs/NOTIFICATIONS.md §7).
> **Phase 10 (security-first final gate) is built, and the gate is not fully met** — see docs/SECURITY.md and docs/REQUIREMENTS.md for what was found, fixed, and what still needs a person. **Phase 9 is built:** Reports (sales, orders, workers, customers, profit, plus expense/payment totals) and global search (Ctrl/Cmd+K). No exports, by decision. Exact status per requirement is tracked in
> [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md). **Post-Phase-10 (2026-09-27–28, owner-directed, not
> part of the original spec):** Fiverr Accounts/Gigs, an order-form Customer autocomplete, the
> Order Item redesign (growth-metric item types, order-level pricing), and Buyer's complete removal
> from the system (a Fiverr-vs-External order source replaces it) are all built (see "What works
> today" below and `docs/REQUIREMENTS.md`'s D12 and "Buyer removed" for the full record). Start with
> [`docs/AI_CONTEXT.md`](docs/AI_CONTEXT.md) for the full schema and structure in one file.
>
> A Supabase project **is** configured, and every migration — through Phase 10, the Fiverr-accounts
> one, the Order Item redesign's, and the Buyer-removal/order-source-simplification one (drops
> `buyers`/`buyer_contacts`/`buyer_pricing`/`buyer_payments` and their permission-catalog keys;
> real, irreversible data loss for any buyer-payment history that existed) — is applied and confirmed
> against the live database.

The product requirements are [`docs/SPECIFICATION.md`](docs/SPECIFICATION.md) — the original
162-section specification, unmodified. The first-run task is in
[`START_HERE.md`](START_HERE.md). This README replaces the starter-package readme, as that document
invited.

## What works today

- Supabase Auth sign-in/sign-out, password reset, and an in-app invite-a-user flow
- Application user profiles kept separate from auth identities
- Database-backed roles and permissions; **multiple roles per user**; full role CRUD (create,
  rename, duplicate, delete) in the UI
- Direct per-user **ALLOW** and **DENY** overrides, with deterministic precedence
- An effective-access view showing every permission, its outcome and **where it came from**
- Centralized server-side authorization on every protected surface
- Permission-aware collapsible nested navigation
- Role permission editor and user role/override editors, each audited
- Append-only audit log written in the same transaction as the change
- Editorial design system: one flat canvas, typography-led hierarchy, hairline tables, status dots
- Customers: profiles, search/filter/pagination, created only inline from the order form (never a
  separate page) — order history is deferred (not fabricated) until its prerequisites exist. Buyer,
  a "recurring commercial client" concept Customer used to optionally link to, was removed from the
  system entirely, post-Phase-10 (2026-09-28, owner-directed)
- Categories and Services, with an optional growth-metric type (Views/Subscribers/Watch Hours) that
  drives an Order Item's structured fields (no pricing tiers, and no per-buyer price override any
  more either — see the note above)
- Orders: full lifecycle (Process Order, controlled status transitions, item status independent of
  the order), assigned to an internal user or an outsourced worker, normalized Order Item links with
  substring/domain search, server-side search/filter/pagination, an activity feed distinct from
  notes and from the audit log. One price for the whole order (not per item); an item against a
  metric-tagged service additionally takes a channel link and a target/current count. Source is
  Fiverr or External — a Fiverr order takes which of the business's own Fiverr accounts it came in on
- Outsourced workers: a lightweight, login-less contact record for third parties who fulfil
  Order Items
- Worker Dashboard ("Your work" on `/dashboard`), Worker Profile (`/workers/[id]`) and a Workers
  roster, scoped so a worker sees their own profile and an admin sees every worker's
- Daily Statistics: manual entry (single and bulk), copy-previous-day, date/user filtering, CSV
  export, and two purpose-built charts — nothing here is computed from Orders
- Finance: expense categories and expenses (order-attributable but reported separately from
  revenue), worker payments (a lump sum, not itemized per order item) — Worker earned/paid/outstanding
  is always computed from Orders and payments, never a stored balance; revenue is recognized on
  delivery; a cancelled-mid-progress item can pay an outsourced worker for partial work with a
  mandatory note and a stop-work notification; figures are shown per-currency, never blended.
  (Buyer payments existed here too until Buyer was removed from the system, post-Phase-10.)
- Notifications: an in-app notification centre and header bell fed by order events (assigned,
  started, revised, completed), per-user preferences per event and channel, validated message
  templates, and a message-log viewer (empty until a queue exists to send anything)
- Reports: sales, orders, workers, customers and profit for any date range (capped at a year),
  money always per currency and never blended, refunded orders excluded, money columns hidden without
  the matching finance permission
- Global search (Ctrl/Cmd+K): orders (number, reference, item link), customers, workers,
  services, categories — by name, email, phone or reference, only what you may view, kept cheap by a
  2-character minimum, debounce, request cancellation, caching and trigram database indexes
- Fiverr Accounts (post-Phase-10, not part of the original 10-phase spec): the business's own Fiverr
  seller profiles — name, email, PayPal credentials (password AES-256-GCM-encrypted at rest, revealed
  only via a separate, narrowly-permissioned, audited action) — each with gigs and manually-entered
  daily impressions/clicks charted two lines per gig on one Gigs page; an order records which account
  it came in on (asked only when its source is Fiverr)
- Customers can now be created inline from the order form itself — a debounced autocomplete that
  offers "Create" on a genuine empty result and "Retry" on a failed search, never a separate page
- CLI user provisioning (`pnpm db:create-user`) remains available alongside the in-app screen
- Security: an audit of every route out of the system (RLS on 29 tables verified against the live project with only the public key, secrets vs. bundle/files/history, server-side redaction so a worker never receives prices, costs or the customer, http(s)-only links, safe redirects, security headers, `HttpOnly` session cookie, WCAG AA on every page) — re-runnable with `pnpm security:audit` and `pnpm security:secrets`
- 215 unit/component tests, all passing; end-to-end tests against a live Supabase project (three
  whole tests — a Buyer CRUD test, a buyer-pricing-override test, a buyer-payment test — were removed
  along with Buyer, post-Phase-10; the suite's exact current count was not re-verified against a live
  run this session, no credentials were available; 2 pre-existing failures unrelated to this work —
  see `docs/REQUIREMENTS.md`'s 2026-09-15 log)

## Not built yet

Order files (needs a Supabase Storage bucket), email/WhatsApp sending and the Redis + BullMQ queue
behind it (deadline reminders included), report exports (declined), and the final-quality-gate lines that depend on those. All of it is preserved as scope in
`docs/REQUIREMENTS.md`, not dropped.

There is **no Fiverr integration** (no API, auth, sync, scraping or webhooks), by requirement, and
none may be added. This is distinct from **Fiverr Accounts** (below): plain, manually-maintained
records of the business's own seller profiles — nothing in that feature talks to Fiverr.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · Supabase
(PostgreSQL, Auth, Storage) · Prisma 7 · Zod · Recharts · Vitest · Testing Library · Playwright

Planned: TanStack Table, Resend, Meta WhatsApp Business Platform, Redis + BullMQ —
each added in the phase that needs it, not before.

## Requirements

- Node.js **≥ 22.12** (`.nvmrc` pins 22). Node 20 will not work — `@supabase/supabase-js` requires a global `WebSocket`
- pnpm 10.20.0, used via Corepack — **nothing is installed machine-wide**
- A Supabase project, for anything database-backed

## Quick start

```bash
nvm use                        # Node 22, per .nvmrc
corepack pnpm install
cp .env.example .env.local     # fill in Supabase values
corepack pnpm db:generate
corepack pnpm db:migrate       # needs DIRECT_URL
corepack pnpm db:seed          # permissions, roles, first Super Admin
corepack pnpm dev              # http://localhost:3000
```

`corepack enable pnpm` once gives you a bare `pnpm` command if you prefer.

**Without Supabase credentials** the app still builds, lints, typechecks and tests. `/login` states
plainly which variables are missing rather than showing a form that cannot work.

The seed is idempotent. It creates the permission catalog and the Super Admin / Admin / Worker
roles, and provisions the first administrator when `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` and
`SUPABASE_SECRET_KEY` are set — otherwise it says exactly what it skipped.

## Verifying

```bash
corepack pnpm verify                        # typecheck, lint, unit + component tests, build
corepack pnpm exec playwright install chromium
corepack pnpm test:e2e
```

## Architecture in one paragraph

Server Components by default; Client Components only where interaction demands it. Prisma, secrets
and permission resolution live in `server-only` modules. Each domain is split into `queries.ts`
(reads, explicit column selection), `service.ts` (writes, transactions, audit) and `actions.ts`
(validate → authorize → call service). Authorization is resolved once per request from the verified
Supabase session and enforced at every protected surface — **navigation filtering is UX, never
security**. Prisma connects as the database owner and therefore bypasses RLS, so RLS is enabled with
no permissive policies as defense-in-depth for the browser-facing Supabase key, and server code is
the real control. Full detail in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Documentation

| Document | Contents |
| --- | --- |
| [AI_CONTEXT.md](docs/AI_CONTEXT.md) | The whole schema, structure and conventions in one file — start here |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, layering, RLS reasoning, performance and timezone policy |
| [DATABASE.md](docs/DATABASE.md) | Every model, index, constraint, deletion policy; where to change a model |
| [PERMISSIONS.md](docs/PERMISSIONS.md) | Precedence, scopes, safety rules, the permission matrix |
| [ORDERS.md](docs/ORDERS.md) | Order state machine, search design, and the Worker Dashboard/Actions/Profile it feeds |
| [NOTIFICATIONS.md](docs/NOTIFICATIONS.md) | Events, providers, outbox, queue *(in-app built; queue designed, blocked on Redis)* |
| [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Tokens, components, accessibility, forbidden patterns |
| [API.md](docs/API.md) | Every server action and route handler with its required permission — kept in step with the code by a test |
| [SECURITY.md](docs/SECURITY.md) | What can leave the system, what the audit found and fixed, how to re-check, open items |
| [ENVIRONMENT.md](docs/ENVIRONMENT.md) | Every variable, where it comes from, which environment needs it |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Vercel, Supabase, the separate queue worker, backups |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Setup, conventions, how to add a permission/role/module |
| [REQUIREMENTS.md](docs/REQUIREMENTS.md) | All 162 sections mapped to status and evidence |

Documents marked *designed* describe decisions, not working code. They say so at the top.

## Security notes

- `SUPABASE_SECRET_KEY` bypasses RLS. Server-only, never `NEXT_PUBLIC_`, never logged.
- Every real identity/authorization decision (`getCurrentActor()`) comes from
  `supabase.auth.getUser()` (revalidates the token), never `getSession()`. The proxy is the one
  deliberate exception: it uses the cheap, local `getSession()` for its own UX-only redirect,
  precisely because it is not the authorization boundary — see `src/proxy.ts`'s header comment.
- Every Server Action re-checks its permission; the proxy is session hygiene, not authorization.
- Users are deactivated, never deleted, and an inactive user resolves to zero permissions.
- A user cannot modify their own access, and no change may leave the system without an administrator.
