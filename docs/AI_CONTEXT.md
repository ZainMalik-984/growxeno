# AI Context

A single-file map of this codebase: what it is, how it's shaped, every database model, the full
permission catalog, the conventions every file follows, and what's built versus not. Read this
first, before opening source files — it should answer "where does X live" and "what does the schema
look like" without a repo-wide search. For depth beyond this summary, each section names the
document that has it; those documents are the source of truth if this one ever drifts from the code.

This file itself can drift. If something here contradicts what you read in the code or a migration,
trust the code and fix this file.

---

## 1. What the product is

An internal business-operations platform for an agency that resells services (fulfilled either by
in-house staff or by outsourced third parties) to end/job clients ("Customers"), tracked as Orders
containing Order Items. There is no separate "recurring commercial client" concept any more — Buyer
existed through Phase 10 and was removed entirely, post-Phase-10 (2026-09-27, owner-directed,
confirmed directly: "Remove the Buyer category from order and from system"); see §5's `crm.prisma`
note for the full record. Orders are entered manually — including orders that originated on Fiverr,
re-typed in by a human — never synced or scraped (the "Absolute Fiverr Rule": no Fiverr API,
auth, or integration of any kind, anywhere, ever — `source` naming "Fiverr" as one of an order's two
possible values, §9, is a deliberate, confirmed exception for that one field, not a live integration).
The business runs several of its own Fiverr seller
profiles, tracked as plain manually-maintained records (`FiverrAccount`, §5) so an order can say which
one it came in on — this is bookkeeping about accounts the business owns, not an integration with
Fiverr, and does not relax the rule above. Money is paid in USD by clients and paid out to
workers in a fixed PKR amount that does **not** track the exchange rate, so the system never converts
between currencies — every amount carries its own `currency` column, and totals are never blended
across currencies.

The full requirements are `docs/SPECIFICATION.md` (162 sections, unmodified, the original brief).
`docs/REQUIREMENTS.md` maps every section to its current status (VERIFIED / PARTIAL / NOT_STARTED /
SCOPED OUT) with evidence — read it to know what is real versus planned.

## 2. Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · Tailwind CSS v4 · Supabase
(Postgres, Auth; Storage is referenced by the spec but no bucket is configured) · Prisma 7 with the
`@prisma/adapter-pg` driver adapter, schema split across `prisma/schema/*.prisma` · Zod · Vitest +
Testing Library (unit/component) · Playwright (E2E, against the live Supabase project — **there is no
separate test database**). Node **22.12+** is required (`.nvmrc` pins 22) — Node 20 breaks
`@supabase/supabase-js` (no global `WebSocket`), which breaks the seed's admin-provisioning step and,
if `next dev` is ever run under Node 20, sign-in itself.

Planned but not yet added, each on the phase that needs it: TanStack Table, Resend, Meta
WhatsApp Business Platform, Redis + BullMQ (Phase 8 built everything around this gap except the
gap itself — see §5's `messaging.prisma` and docs/NOTIFICATIONS.md §7 for why).
Recharts was added in Phase 6.

## 3. Directory map

```
prisma/
  schema/*.prisma     one file per domain group (identity, crm, catalog, orders, audit) — see §5
  migrations/         applied in order; review SQL before committing a new one
  seed.ts             idempotent: syncs the permission catalog, seeds 3 roles, provisions the first admin
scripts/
  create-user.ts      pnpm db:create-user — the only way to provision a user in Phase 1-5 (no in-app screen)
src/
  app/
    (auth)/           login, forgot/reset password, account-inactive — no app shell
    (app)/            the authenticated shell (sidebar, header); every route here calls
                       requirePermission/requireActor and is force-dynamic
  components/
    ui/               design-system primitives (Button, Field, Input, Modal, Table, Section, ...)
    layout/           sidebar, user menu, nav icon mapping
  lib/
    auth/             session resolution (session.ts) + authorization entry points (authorize.ts)
    permissions/      catalog.ts, resolve.ts, scope.ts — pure, no DB, no server-only import
    access/           RBAC queries/service/actions (users, roles, permissions UI)
    audit/            record.ts — the one function that writes an AuditLog row
    db/               prisma.ts (the singleton client), transaction.ts (ServiceResult/runTransaction)
    navigation/       nav-tree.ts — the whole sidebar, declared once
    text/              slug.ts — pure slugify()
    supabase/         browser/server/admin Supabase clients
    customers/ categories/ services/ orders/ outsourced-workers/ workers/
                       (buyers/ removed entirely, post-Phase-10 — see §5)
    fiverr-accounts/   the business's own Fiverr seller profiles, their gigs, and daily gig stats
                       one folder per business domain, each split queries/service/actions — see §6
    crypto/            secret-box.ts — AES-256-GCM at-rest encryption for one sensitive credential
                       (a Fiverr account's PayPal password), key from CREDENTIALS_ENCRYPTION_KEY
  generated/prisma/   generated client — gitignored, never hand-edited
tests/
  unit/               pure logic only: state machines, scopes, catalog invariants, slug, url-normalize
  component/          jsdom, interactive components (e.g. sidebar filtering)
  e2e/                Playwright, against the live database; each spec creates and cleans up its own
                       timestamped rows; every spec `test.skip`s itself if E2E_ADMIN_*/SEED_ADMIN_*
                       env vars are absent
docs/                 this file plus the documents in the table at the bottom
```

## 4. Layering convention (every domain follows this)

`Presentation → authorization → service → data access`, expressed as one `src/lib/<domain>/`
folder with three files:

| File | Contains |
| --- | --- |
| `queries.ts` | Reads. Explicit `select` on every query — never a bare `findMany()`. **No authorization** — the caller (a page or an action) checks first. `import "server-only"`. |
| `service.ts` | Writes. Business rules, `runTransaction()`, and an `AuditLog` row written inside the same transaction as the change (`recordAudit()`). Takes an already-authorized `Actor`. |
| `actions.ts` | `"use server"`. Zod-validate → `authorizeAction("key")` → call the service → `revalidatePath`. Returns `{ok:true,...} \| {ok:false,error}`, never throws to the client. |

A Server Action never calls Prisma directly; a service never reads cookies or calls
`getCurrentActor()`. `src/lib/orders/state-machine.ts` and `url-normalize.ts` and
`date-ranges.ts` are the exception pattern: pure functions with no `server-only` import, because
they need to be unit-testable without a database and are the single place a given decision
(a legal status transition, a normalized URL, a day boundary) is made.

Server Components call `requirePermission(key)` / `requireActor()` / `requireScope(key)` from
`src/lib/auth/authorize.ts`, which redirect on failure. Server Actions call `authorizeAction(key)`,
which returns a typed result instead. For an action that is self-scoped by construction and needs no
permission key at all (marking your own notification read, setting your own preference — Phase 8),
call `authorizeAuthenticatedAction()` instead: same typed result, but only checks signed-in + active,
never a permission. The action itself must still scope every write to `actor.user.id` and never
accept a target user id. **Navigation (`nav-tree.ts`) is UX only** — hiding a sidebar link changes
nothing about what a crafted request can reach; every real check lives next to the data.

Money is always `Decimal(14,2)` (never `Float`), serialized to a `string` at the server/client
boundary, and paired with its own `currency CHAR(3)` column (default `"USD"`) — there is no
exchange-rate conversion anywhere, so amounts in different currencies are never summed. Dates that
are instants are `timestamptz`, handled in UTC; a calendar date is a Postgres `date`. The browser
formats, it never decides a day boundary.

## 5. Database schema — every model

Five schema files under `prisma/schema/`. Column names below are the Prisma field name; the
underlying Postgres column is `snake_case` via `@map`. "Money" means `Decimal(14,2)` + a paired
`currency CHAR(3)` column.

### `identity.prisma` — auth profile and RBAC

```
User            id, authUserId?(FK auth.users, unowned), email(unique), fullName, displayName?,
                jobTitle?, phone?, whatsappNumber?, avatarUrl?, isActive, deactivatedAt?,
                lastLoginAt?, createdById?→User
Role            id, name(unique), slug(unique), description?, isSystem
                (isSystem only blocks delete/slug-rename — permissions stay fully editable)
Permission      id, key(unique, dotted e.g. "orders.view"), name, module, description?
                (source of truth is src/lib/permissions/catalog.ts — seed syncs DB to it)
UserRole        (userId, roleId) PK, assignedAt, assignedById?
RolePermission  (roleId, permissionId) PK
UserPermission  (userId, permissionId) PK, effect(ALLOW|DENY), reason?, createdById?
                (a direct DENY beats every role grant; a direct ALLOW grants beyond roles)
```

Deactivation, not deletion, is how a `User` is "removed" — an inactive user resolves to **zero**
effective permissions regardless of role membership (enforced in `resolve.ts`, not just the UI).

### `crm.prisma` — Customers

Buyer, BuyerContact and BuyerPricing existed here through Phase 10 (a "recurring commercial client",
its contacts, and a per-buyer service price override) and were removed entirely, post-Phase-10
(2026-09-28, owner-directed, confirmed directly: "Remove the Buyer category from order and from
system its currently being used in orders"). A real migration
(`20260928000000_remove_buyer_and_simplify_order_source`) dropped their tables, `Order.buyerId` and
`Customer.buyerId`, and the now-dead `buyers.*`/`finance.buyer_payments.*`/`reports.buyers`
permission-catalog keys — real, irreversible data loss for any buyer-payment history that existed.
Finance's revenue/profit was never affected: it always read `Order.totalAmount`/`deliveredAt`
directly, never a Buyer-adjacent table.

```
enum PartyType   INDIVIDUAL | COMPANY

Customer        id, name, type, email?, phone?, notes?
                — created only inline from the order form's autocomplete (confirmed directly,
                  2026-09-27): name required, email optional, nothing else asked for there.
```

### `catalog.prisma` — Services and Categories

```
Category   id, name(unique), slug(unique), description?
Service    id, name, categoryId→Category, description?, basePrice?+currency, isActive,
           metricType?(post-Phase-10, 2026-09-27 — VIEWS|SUBSCRIBERS|WATCH_HOURS; drives which
           structured fields an Order Item against this service gets, see OrderItem below and
           src/lib/services/metric-type.ts)
```

No per-service "worker cost" field, deliberately: what it costs to fulfil a specific piece of work is
a fact about *that Order Item*, not the service catalog — see `OrderItem.workerCost` below.
`basePrice` is a reference figure only — since D12 (post-Phase-10) it no longer feeds an Order Item's
price, because an Order Item does not have one any more.

### `orders.prisma` — Orders (Phase 4), Workers (Phase 5)

```
enum OrderSource       FIVERR | EXTERNAL   (post-Phase-10, 2026-09-28, owner-directed: replaces the
                                             original generic DIRECT/WHOLESALE/MANUAL/OTHER. "Fiverr"
                                             naming this field is a deliberate, confirmed exception to
                                             the Absolute Fiverr Rule for this one field only — no live
                                             integration exists anywhere else)
enum OrderStatus        PENDING → PROCESSING → IN_PROGRESS → INTERNAL_REVIEW → READY_FOR_DELIVERY →
                         DELIVERED → COMPLETED, with REVISION and CANCELLED branches — full transition
                         table in src/lib/orders/state-machine.ts and docs/ORDERS.md §4
enum OrderItemStatus    PENDING | IN_PROGRESS | INTERNAL_REVIEW | REVISION | COMPLETED | CANCELLED
                         — independent of the parent Order's status

OutsourcedWorker  id, name, email?, phone?, whatsappNumber?, notes?, isActive
                  — NOT a User: no login, no auth identity, no RBAC. A cost-tracking contact only.

Order             id, orderNumber(unique autoincrement, shown as "#1042"), source, externalReference?,
                  customerId?→Customer, fiverrAccountId?→FiverrAccount(SET NULL; required by the
                  service layer when source = FIVERR, forced null when source = EXTERNAL —
                  post-Phase-10, 2026-09-27), orderDate, deadline?, status, totalAmount+
                  currency (post-Phase-10, 2026-09-27, D12: the WHOLE order's price, entered directly
                  by whoever creates/edits the order — no longer derived from items), notes?,
                  createdById→User(required), deliveredAt?(Phase 7, stamped every time status→DELIVERED,
                  including re-delivery after REVISION — revenue recognition reads THIS, not status),
                  refunded(Phase 7, boolean, whole-order only — no partial refund to a customer)

OrderItem         id, orderId→Order, serviceId→Service, categoryId (snapshotted from the service at
                  creation, so a later re-categorisation doesn't rewrite history), workerId?→User
                  XOR outsourcedWorkerId?→OutsourcedWorker (exactly one set, enforced in the service
                  layer, not a DB constraint), description?(doubles as the item's free-text "note"),
                  deadline?, channelLink?+targetCount?+currentCount?(post-Phase-10, D12 — only
                  meaningful, and required by the service layer, when service.metricType is set;
                  currentCount alone is optional, defaults 0), workerCost?+currency (paid to whoever
                  does the work), status, finishedAt?(Phase 9 — stamped on COMPLETED/CANCELLED,
                  cleared on reopen; what Reports and Finance range on, NOT updatedAt)
                  — workerCost is a SNAPSHOT taken at creation/edit time, never recomputed from a
                    worker's current rate. NO sellingPrice field exists any more (D12, post-Phase-10,
                    confirmed directly 2026-09-27: "order price should be taken for the whole order
                    not for each item") — superseding §9's original D3 note that both were snapshots.

OrderItemLink     id, orderItemId→OrderItem, url(verbatim, never fetched by the server), normalizedUrl
                  (lower-cased scheme/host, default port and one trailing slash dropped, path case
                  and query string preserved), domain, path, label?, createdById→User
                  — a table, not a text field, because Section 27 needs domain/substring search: a
                    pg_trgm GIN index on normalizedUrl plus a B-tree on domain (the trigram index is declared in the schema
                    migration; Prisma's DSL can't declare a trigram index).

OrderNote         id, orderId→Order, body, authorId→User            — internal, distinct from activity
OrderActivity     id, orderId→Order, actorId?→User, actorLabel?(denormalised, survives a rename or an
                  outsourced-worker actor with no User row), action, summary
                  — the operational feed. Distinct from OrderNote AND from AuditLog (the security
                    record) — three different things, never merged.
NotificationOutbox  id, eventType, payload(JSONB), status, sentAt?, error?
                  — durable notification INTENT written inside Process Order's transaction so an
                    unreachable email/WhatsApp provider never fails the order change. No dispatcher
                    drains it yet (Phase 8) — write-only until then.
```

**Order Item files** (specification §63) are specified but **not built** — no Supabase Storage bucket
is configured. Until it is, `orders.files.upload` is exercised through `OrderItemLink` instead: a
worker assigned to an item may add (never remove) a link on it, as the closest real substitute — see
`docs/ORDERS.md` §9/§11.

### `fiverr.prisma` — Fiverr accounts and gigs (post-Phase-10, 2026-09-27)

```
FiverrAccount   id, name, email?, paypalEmail?, paypalPasswordEncrypted?(AES-256-GCM ciphertext,
                src/lib/crypto/secret-box.ts, key from CREDENTIALS_ENCRYPTION_KEY — never selected
                as plaintext by a list/detail query; reveal is a separate action gated on
                fiverr_accounts.credentials.view, audited every call), isActive
                — the business's OWN Fiverr seller profiles (there are several); not a Customer,
                  who is the other side of a transaction
FiverrGig       id, fiverrAccountId→FiverrAccount(CASCADE), name, isActive
FiverrGigStat   id, gigId→FiverrGig(CASCADE), statDate(date), impressions, clicks, createdById→User
                @@unique([gigId, statDate])  — one manually-entered row per gig per day, same
                reject-a-duplicate rule as DailyStat (D10)
```

Feeds `/fiverr-accounts/gigs`: one Recharts two-line (impressions, clicks) chart per gig.

### `statistics.prisma` — Daily Statistics (Phase 6)

```
DailyStat   id, userId→User, statDate(date, not timestamptz), orders, completed, pending,
            revenue+revenueCurrency, notes?, createdById→User
            @@unique([userId, statDate])
```

Manually entered only — Section 51 explicitly forbids inferring these from `orders`/`order_items`,
and no query anywhere joins this table against Orders. The unique constraint is D10's answer
(reject a duplicate entry for the same user+day, don't sum or overwrite).

### `finance.prisma` — Expenses, Worker Payments (Phase 7)

```
ExpenseCategory   id, name(unique), slug(unique), isActive  — seeded (Software, Advertising,
                  Infrastructure, Salaries, Office, Miscellaneous); deactivate, never delete

Expense           id, amount+currency, categoryId→ExpenseCategory, date(calendar date), description?,
                  orderId?→Order (optional attribution — reported SEPARATELY from that order's
                  revenue, never netted), paidById?→User, notes?, createdById→User
                  — NO delete path anywhere (D8: edit in place, audit log keeps history)

WorkerPayment     id, workerId?→User XOR outsourcedWorkerId?→OutsourcedWorker (same XOR pattern as
                  OrderItem), amount+currency, paymentDate, reference?, notes?, createdById→User
                  — a LUMP SUM, not itemized per Order Item (the owner pays periodically for
                    everything completed since the last payment) — no order/order-item FK at all.
                    Hard delete allowed (D8)
```

BuyerPayment (money received from a Buyer) existed here through Phase 10 and was removed entirely
with Buyer itself, post-Phase-10 (2026-09-28) — see §5's `crm.prisma` note. Nothing in Finance
depended on it: revenue always read `Order.totalAmount`/`deliveredAt` directly.

**No `financial_transactions` ledger table exists.** A Worker's earned/paid/outstanding is computed
at read time from `Order`/`OrderItem`/`WorkerPayment` directly (`src/lib/finance/queries.ts`) — never
a stored/cached balance field anywhere. Revenue is recognised when `Order.deliveredAt` is set (D4),
not on `COMPLETED`. A worker
earns an Order Item's `workerCost` once that item reaches `COMPLETED`, **or** is `CANCELLED` with a
`workerCost` the admin has manually adjusted down to the partial amount actually owed (D5) — see
`EARNED_ITEM_STATUSES`/`REVENUE_RECOGNIZED_STATUSES` in `src/lib/finance/queries.ts`. Rounding is
half-up to 2 decimals (D2, `src/lib/finance/money.ts`'s `roundMoney`). Because revenue is typically
USD while worker cost/expenses are typically PKR, Revenue/Worker Cost/Expenses/Profit are always
shown as separate per-currency figures — a subtracted "profit" number is only computed when all
three happen to share one currency for a given order.

### `messaging.prisma` — Notifications (Phase 8)

```
enum NotificationEvent  ORDER_CREATED | ORDER_ASSIGNED | ORDER_PROCESSED | ORDER_STARTED |
                        ORDER_COMPLETED | ORDER_REVISED | DEADLINE_24H | DEADLINE_6H |
                        DEADLINE_TODAY | ORDER_OVERDUE | PAYMENT_DUE |
                        ORDER_ITEM_STOP_WORK_REQUESTED (addition — Phase 7's cancel-with-adjustment
                        workflow, formalized into this enum this phase)
enum NotificationChannel  IN_APP | EMAIL | WHATSAPP
enum MessageStatus       QUEUED | SENDING | SENT | DELIVERED | FAILED

Notification            id, recipientId→User, type(NotificationEvent), title, message, isRead,
                        readAt?, entityType?, entityId?, actionUrl?
                        — written SYNCHRONOUSLY in the same transaction as the business event
                          (a database write needs no queue); this is the one channel that actually
                          works this phase
NotificationTemplate    id, event, channel, name, subject?(email only), body,
                        requiredVariables(text[]), metaTemplateName?, metaTemplateLanguage?
                        (WhatsApp only), isActive
                        @@unique([event, channel]) — hard DELETE allowed (unlike Expense: nothing
                        depends on a template surviving, MessageLog.templateId is SetNull)
NotificationPreference  id, userId→User, event, channel, enabled
                        @@unique([userId, event, channel]) — a MISSING row means "use the system
                        default" (src/lib/notifications/events.ts), never a duplicated copy
MessageLog              id, recipientId?→User, recipientLabel(denormalized — often NOT a User: an
                        OutsourcedWorker, a Customer), channel, event, templateId?, status,
                        error?, created/sent/deliveredAt
                        — EMPTY today and will stay empty until a dispatcher exists (see below)
```

**The queue does not exist.** Specification §72 requires Redis + BullMQ; none is configured in this
project. A local Homebrew install was attempted this session and aborted when it started compiling
LLVM/Rust from source (no bottles exist for this macOS version) — the owner chose to defer it rather
than pay a 30-90+ minute build cost. Consequence: `NotificationOutbox` (still in `orders.prisma`,
built in Phase 4) accumulates `PENDING` rows forever, `getEmailProvider()`/`getWhatsAppProvider()`
(`src/lib/notifications/providers/`) always resolve to an "unconfigured" stub reporting `FAILED`,
and `MessageLog` stays empty — in-app notifications are the only channel that actually sends anything.
Full account: docs/NOTIFICATIONS.md §7.

**No new Supabase Realtime subscription either.** The bell (`notification-bell.tsx`) and
`/notifications` are server-rendered fresh on every navigation, not live-updating — a proper Realtime
subscription needs a new, reviewed RLS policy scoped to `recipient_id = auth.uid()`, deliberately not
added under the same time pressure as the deferred queue. docs/NOTIFICATIONS.md §9.

### `audit.prisma` — the security record

```
AuditLog   id, actorUserId?→User, actorEmail?(snapshot), action, entityType, entityId?, summary,
           previousValue?(JSON), newValue?(JSON), ipAddress?, userAgent?
```

Append-only: no update or delete path exists in any service. Written inside the same transaction as
the change it describes, via `src/lib/audit/record.ts`'s `recordAudit()`.

### Full relationship sketch

```
User ──M:N── Role ──M:N── Permission        (RBAC — resolve.ts is the ONLY place precedence runs)
User ──M:N(direct ALLOW/DENY)── Permission

Category ─1:N─ Service

Order ─0:N─ Customer
Order ─0:N─ FiverrAccount(only when source = FIVERR)
Order ─1:N─ OrderItem ─N:1─ Service, ─N:1─ Category(snapshotted)
OrderItem ─N:1─ User(workerId) XOR ─N:1─ OutsourcedWorker
OrderItem ─1:N─ OrderItemLink
Order ─1:N─ OrderNote(→User author), ─1:N─ OrderActivity(→User? actor)

User ─1:N─ AuditLog(as actor), ─1:N─ OrderActivity(as actor), ─1:N─ OrderItem(as assigned worker)
User ─1:N─ DailyStat(as subject), ─1:N─ DailyStat(as createdBy — usually an admin, not the subject)
```

Full detail, indexes, deletion policy per table, and the reasoning behind every deliberate omission:
**`docs/DATABASE.md`**.

## 6. Domain modules (`src/lib/<domain>/`)

| Domain | Owns | Notable |
| --- | --- | --- |
| `access` | Users, Roles, Permissions UI (RBAC administration) | `getUserAccessDetail` powers the "effective access" view showing precedence source |
| `orders` | Order, OrderItem, links, notes, activity, Process Order | `state-machine.ts`, `url-normalize.ts`, `date-ranges.ts` are pure; `queries.ts` folds combined item-level filters into ONE `items:{some:{...}}` clause so they match the *same* item |
| `workers` | Internal Worker Dashboard/Profile (Phase 5) | `getMyWorkSummary()` is shared by the dashboard's "Your work" section and `/workers/[id]`; reads `OrderItem.workerId`, never `outsourcedWorkerId` |
| `outsourced-workers` | Third-party worker CRUD | No scope split needed — an outsourced worker has no "self" to view their own profile |
| `daily-stats` | Daily Statistics (Phase 6) | `date-ranges.ts` is pure (Today/7/30/90/custom); `service.ts` enforces the one business rule (reject a duplicate user+date) and writes audit rows for create/update/delete/bulk/copy; the Worker Profile page reads this domain directly for a 30-day summary |
| `finance` | Expenses, ExpenseCategory, WorkerPayment (Phase 7; BuyerPayment removed post-Phase-10) | `money.ts` is pure (`roundMoney`, `sumByCurrency`, `formatCurrencyBreakdown`); `queries.ts` computes Worker earnings and per-order profit at read time — no stored balance; `Order.refunded`/`OrderItem` cancel-with-adjustment live in the `orders` domain but are Finance-adjacent, see §9 |
| `reports` | Reports (Phase 9) — no models, reads only | `range.ts` is pure (`clampRange` caps at 366 days, `chooseBucket` day/week/month); `queries.ts` is aggregates only (`GROUP BY`/`groupBy`, never fetch-and-sum), per-currency, Finance's recognition rules unchanged; pages under `/reports/*`, money columns need the matching `finance.*` key |
| `search` | Global search (Phase 9) — no models | `term.ts` is pure (2–80 chars, 5 hits per category); `queries.ts` `globalSearch()` runs one bounded query per category the actor may view, in parallel, served by the trigram indexes; endpoint is `GET /search` (a Route Handler so the browser can abort), UI is `components/layout/global-search.tsx` (Ctrl/Cmd+K) |
| `notifications` | In-app Notification, NotificationTemplate, NotificationPreference, MessageLog (Phase 8) | `events.ts` is pure (`getDefaultPreference`, `validateTemplateVariables`, `renderTemplate`); `emitNotificationEvent()` in `service.ts` is called from `orders/service.ts`'s transactions, same pattern as `logActivity`/`recordAudit`; `providers/` holds the Email/WhatsApp interfaces, currently always resolving to an "unconfigured" stub (no queue exists to dispatch through — docs/NOTIFICATIONS.md §7) |
| `customers` | CRM (Buyer removed post-Phase-10) | `customers/queries.ts`'s `searchCustomersByName()` feeds the order form's debounced `CustomerPicker` (post-Phase-10); `countCustomers()` feeds the dashboard's CRM count |
| `fiverr-accounts` | FiverrAccount, FiverrGig, FiverrGigStat (post-Phase-10, 2026-09-27) | The business's own Fiverr seller profiles — not CRM. PayPal password encrypted via `crypto/secret-box.ts`; `/fiverr-accounts/gigs` is the single page for entering every gig's daily stats |
| `categories` / `services` | Catalog | `services/queries.ts`'s `listServicesForOrderPicker` feeds the Order Item picker |
| `permissions` | Catalog, precedence resolution, scope resolution | The three files here have **zero** database or `server-only` dependency — pure, unit-tested |
| `auth` | Session + authorization entry points | `requirePermission`/`requireActor`/`requireScope` (redirect) vs. `authorizeAction` (typed result) — see §4 |
| `audit` | `recordAudit()` | Called from inside the same transaction as every mutating service call |
| `navigation` | `nav-tree.ts` | The entire sidebar as data; `getNavigationFor(permissions)` filters by permission AND `implemented` flag |
| `db` | Prisma client singleton, `runTransaction`/`ServiceResult` | See the dev-server gotcha in §8 |
| `supabase` | Browser/server/admin clients | `admin.ts` uses the secret key — bypasses RLS, server-only, never logged |

## 7. Permissions — the full catalog

Dynamic RBAC (specification §5–13): permissions are rows in the database, seeded from
`src/lib/permissions/catalog.ts` (the single source of truth for keys), never hard-coded role
checks anywhere (`if (user.role === "admin")` is mechanically forbidden — a unit test greps for it).

**Precedence** (`resolve.ts`): inactive user → deny everything, else direct `DENY` beats direct
`ALLOW` beats any role grant beats nothing. **Scope** (`scope.ts`) is a second, separate axis: a key
like `orders.view` answers "may they see orders at all"; the companion `orders.view.all` answers
"every order, or only their own/assigned ones" (`resolveScope` → `NONE \| ASSIGNED \| ALL`). Follow
this `key` / `key.all` convention for any new record-scoped permission — do not invent a second
mechanism. Full precedence table and worked example: **`docs/PERMISSIONS.md`**.

Modules and their keys (module → representative keys; `.all` siblings are the scope-widener for the
key they follow):

| Module | Keys |
| --- | --- |
| `orders` | `view` (+`.all`), `create`, `edit`, `delete`, `assign`, `process`, `change_status`, `comment`, `files.view`, `files.upload`, `activity.view`, `export` |
| `customers` | `view`, `create`, `edit`, `delete` (Buyer's whole module — `view`/`create`/`edit`/`delete`/`pricing.*`/`payments.*` — removed entirely, post-Phase-10, 2026-09-28) |
| `workers` | `view` (+`.all`, added Phase 5), `create`, `edit`, `delete`, `assign`, `stats.view` (+`.all`), `payments.view`, `payments.manage` |
| `daily_stats` | `view` (+`.all`), `create`, `edit`, `delete`, `export` |
| `services` / `categories` | `view`, `create`, `edit`, `delete` |
| `finance` | `view`, `revenue.view`, `revenue.manage` (ADDED post-Phase-10, replaces `finance.buyer_payments.manage` for the order refund flag), `expenses.view`/`.create`/`.edit`, `profit.view`, `worker_payments.view`/`.manage` — `finance.buyer_payments.view`/`.manage` removed with Buyer |
| `reports` | `view`, `sales`, `orders`, `workers`, `customers`, `profit`, `export` (`reports.buyers` removed with Buyer) — all pre-existing; Phase 9 added zero keys and built no export (`reports.export` unused). A money-showing report also needs the matching `finance.*` key. Global search has no key of its own: each category is gated by the key that governs viewing it |
| `communications` | `view`, `email.send`, `whatsapp.send`, `templates.view`/`.manage`, `message_logs.view` — all pre-existing since Phase 1; Phase 8 added zero new keys. `email.send`/`whatsapp.send` remain unused (no provider/queue to send through yet). Managing your OWN notifications/preferences needs no key at all — see `authorizeAuthenticatedAction()` below |
| `users` / `roles` | `view`, `create`, `edit`, `delete` |
| `permissions` / `settings` | `view` (+ `settings.edit`) |
| `audit` | `view` |
| `fiverr_accounts` | `view`, `manage`, `credentials.view` (post-Phase-10, 2026-09-27 — `credentials.view` is deliberately narrower than `view`: reveals a stored PayPal password rather than just that the account exists, and is audited on every call) |

**Seeded roles** (`prisma/seed.ts`, ordinary editable data, not special-cased in code):

- **Super Admin** — every catalog key.
- **Admin** — every key except `users.delete`, `roles.create/edit/delete`, `settings.edit`.
- **Worker** — `orders.view` (not `.all` — assigned work only), `orders.comment`,
  `orders.change_status`, `orders.files.view`, `orders.files.upload`, `orders.activity.view`,
  `daily_stats.view`, `workers.view` (own profile only), `workers.stats.view`. Deliberately no
  `orders.assign`, `orders.edit`, `orders.create`, `orders.process`, or anything financial.

**After adding a catalog key**: `pnpm db:seed` (idempotent) to sync it into the DB and re-attach role
grants — a permission that exists only in code and not in the database resolves to nothing.

## 8. Order / Order Item state machine

Full tables and worker-restricted subset: `src/lib/orders/state-machine.ts` (13 unit tests) and
`docs/ORDERS.md` §4. Summary:

```
Order:  PENDING → PROCESSING → IN_PROGRESS ⇄ REVISION → INTERNAL_REVIEW ⇄ REVISION →
        READY_FOR_DELIVERY ⇄ REVISION → DELIVERED ⇄ REVISION → COMPLETED
        (CANCELLED reachable from every state except COMPLETED/CANCELLED itself)

Item:   PENDING → IN_PROGRESS ⇄ REVISION → INTERNAL_REVIEW → COMPLETED ⇄ REVISION(admin only, Phase 7)
        (CANCELLED reachable from PENDING/IN_PROGRESS/INTERNAL_REVIEW/REVISION)

Item, worker acting on their OWN assignment only (asAssignedWorkerOnly=true):
        PENDING → IN_PROGRESS → INTERNAL_REVIEW   (and REVISION → IN_PROGRESS)
        — a worker can never self-mark COMPLETED, CANCELLED, or move INTO REVISION; those are
          reviewer/administrative actions. This is deliberate (Phase 4, left standing in Phase 5) —
          "Request Revision" from the specification's worker-actions list maps to Add Note, not a
          status transition a worker can trigger themselves.
```

`Process Order` (`processOrder()` in `orders/service.ts`) is the one transaction that moves
PENDING→PROCESSING and activates every item PENDING→IN_PROGRESS, writing activity + audit +
a `NotificationOutbox` row — with no notification-provider call inside the transaction itself.

`cancelOrderItemWithAdjustedCost` (Phase 7, `orders/service.ts`) is the guided path for cancelling an
item an outsourced worker was already mid-progress on: the admin enters an adjusted `workerCost` (not
necessarily 0) and a mandatory note in one dialog, which also writes a `NotificationOutbox` row
telling the worker to stop. No new "partial completion" schema — it reuses the existing, already-
editable `OrderItem.workerCost` field.

## 9. Standing decisions worth knowing before touching money or orders

These come from `docs/REQUIREMENTS.md`'s "Open business decisions." D1–D8, D10 and D12 are answered;
D9 (business timezone) and D11 (which item statuses are "required" for completion) remain open, each
with a documented interim default already implemented — see that document's "Still open" table. D6
and D7 are historical record only, below — Buyer (and BuyerPayment with it) no longer exists, removed
post-Phase-10 (2026-09-28, owner-directed; see §5's `crm.prisma` note).
Easy to get wrong by re-deriving from the specification's examples instead of from here:

- **No pricing tiers, and no per-buyer override any more either.** The specification's §47 mentions
  tiers as an illustrative example, not a requirement. A tier system was built once and explicitly
  removed at the owner's direction. The later per-buyer override (`BuyerPricing`) was dropped
  entirely with Buyer, post-Phase-10; `Service.basePrice` is now purely a reference figure — nothing
  feeds an Order Item's price automatically, since an Order Item has no price of its own any more
  (D12). Do not reintroduce tiers, or a buyer-pricing concept, from a literal reading of the
  specification.
- **No currency conversion, anywhere.** Clients pay in USD; workers are paid a fixed PKR amount that
  does not track the exchange rate; expenses book in whichever currency they were actually paid in.
  Every money-bearing model pairs its amount with its own `currency` column. Never sum amounts across
  differing currencies in a total or a report.
- **Rounding is half-up to 2 decimals (D2).** `src/lib/finance/money.ts`'s `roundMoney`, applied
  wherever a calculation (not a direct user entry) produces more precision.
- **Revenue is recognised on delivery, not completion (D4).** `Order.deliveredAt` is the field to
  read, stamped every time status becomes `DELIVERED` — not `Order.status === "DELIVERED"` itself,
  which can move on to `COMPLETED` or back to `REVISION` afterward without erasing when it was first
  delivered.
- **A worker earns per Order Item, not per order (D5).** An item earns its `workerCost` on
  `COMPLETED`, or on `CANCELLED` if the admin manually adjusted `workerCost` down to reflect partial
  work done. A cancelled item with no work done keeps `workerCost` at 0/null and earns nothing.
- **D6 and D7 (buyer payment allocation, credit limits) are historical only.** Both were about
  `Buyer`/`BuyerPayment`, removed entirely post-Phase-10 — nothing to apply going forward.
- **Corrections are edits, not reversing entries (D8).** A wrong `Expense`/`WorkerPayment` is
  corrected by editing it directly (or, for payments, deleting and re-entering); the audit log is
  what preserves the "what it used to say" history — there is no separate reversal/adjustment-entry
  mechanism.
- **`Order.refunded` is one boolean (D8-adjacent).** No partial refunds to a customer exist in this
  business, so there is nothing more to model.
- **A Customer is created only inline, from the order form's autocomplete, never a separate page
  (post-Phase-10, confirmed directly 2026-09-27).** Name required, email optional — do not add other
  fields to that inline create dialog; everything else about a Customer stays on `/customers/[id]`.
- **The Order Item redesign is built (D12, answered 2026-09-27).** The "type" lives on the
  **Service** (`Service.metricType`), not as a second field directly on the item — tag a service as
  VIEWS/SUBSCRIBERS/WATCH_HOURS once (e.g. three services under a "YouTube" category) and every Order
  Item against it gets `channelLink`/`targetCount`/`currentCount` automatically, with labels matched
  to the type. `workerCost` stays per-item, unchanged; `sellingPrice` is gone from the item entirely —
  `Order.totalAmount` is the one price for the whole order. `Service.basePrice` no longer feeds an
  item's price (there is none to feed; `BuyerPricing`, the other half of that old mechanism, was
  dropped entirely with Buyer) — this is how that sub-question resolved, not a separate open item.
  See `docs/REQUIREMENTS.md`'s D12 for the full record.

## 9b. Security rules that are easy to break (Phase 10 — full account in docs/SECURITY.md)

- **Never send data to a client component that its viewer may not see.** Hiding it in the UI still puts it in
  the page payload. `src/lib/orders/visibility.ts` (`orderVisibility`, `redactOrderDetail`) removes it on the
  server; a worker sees only their own item and no prices, costs or customer. Apply the same idea to
  any new page that returns records with money or third-party names.
- **`workers.view` means "my own profile" only.** Outsourced-worker pages, search hits and nav need
  `workers.view.all`. `orders.view.all` does not imply seeing money.
- **Every Server Action must authorize** (`authorizeAction(key)` or, for self-scoped ones,
  `authorizeAuthenticatedAction()`); `tests/unit/api-doc.test.ts` fails otherwise, and also fails if a new
  action is not listed in `docs/API.md`.
- **User-supplied redirects** go through `safeRedirectPath()`; **stored URLs** rendered as links must be
  http(s) (`normalizeUrl` / `safeExternalHref`).
- **Do not add a permissive RLS policy, a database view, or a function in `public`** without re-running
  `pnpm security:audit` — each is exposed on Supabase's public API. Keep extensions in `extensions`.
- **`security:audit`, `security:secrets`, `pnpm audit --prod`** are the three re-checks; run the first after
  every migration and dashboard change.
- The session cookie is `HttpOnly`/`SameSite=Lax`; security headers are in `next.config.ts`.
- **A genuinely sensitive third-party credential (not a session secret) gets application-level
  encryption at rest, not just RLS.** `FiverrAccount.paypalPasswordEncrypted` (post-Phase-10) is
  AES-256-GCM via `src/lib/crypto/secret-box.ts`, key from `CREDENTIALS_ENCRYPTION_KEY`. List/detail
  queries never select the plaintext — only a derived boolean; reading it back is a separate,
  narrower-permission, individually-audited action. Follow this pattern for the next credential like
  it, rather than storing it as a plain column behind RLS alone.

## 10. Environment gotchas

- **Node 22.12+ required.** Node 20 breaks `@supabase/supabase-js` (`Cannot read properties of
  undefined` / "native WebSocket not found") — breaks sign-in, the seed's admin-provisioning step,
  and any script using the Supabase Admin API.
- **The Prisma client is a `globalThis` singleton** (`src/lib/db/prisma.ts`), to survive Turbopack
  HMR without exhausting the connection pool. Consequence: a long-running `next dev` process must be
  **killed and restarted** after any new Prisma model/migration + `prisma generate`, or calls to the
  new model fail with `Cannot read properties of undefined (reading 'create')`.
- **No separate test database.** E2E tests run against the live Supabase project. Every spec creates
  its own timestamped throwaway rows and cleans them up; a spec that fails partway can leave rows
  behind (`E2E Test *` name prefixes make them easy to find and delete directly via Prisma).
  `test.skip`s itself without `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` (or `SEED_ADMIN_*`).
- **After adding a permission catalog key, re-run `pnpm db:seed`** — the catalog in code and the
  `permissions`/`role_permissions` tables are two different things until the seed syncs them.
- Database round-trip latency to this project's region has been observed varying widely (tens of ms
  to multiple seconds) session to session. If E2E tests time out on toast/status assertions with no
  application error in the dev server log, check raw query latency (a plain `SELECT 1` via Prisma)
  before assuming a code regression.
- **Declare trigram indexes in the Prisma schema; never hand-add one.** A `pg_trgm` index added by
  hand in SQL is invisible to Prisma, so every later `migrate dev` proposes dropping it (this bit
  Phases 6, 7 and 8). Prisma can declare it: `@@index([col(ops: raw("gin_trgm_ops"))], type: Gin,
  map: "table_col_trgm_idx")`. Since Phase 9 all 18 trigram indexes (the original
  `order_item_links.normalized_url` plus 17 for global search) are declared that way and no
  `DROP INDEX` is generated. Still read every generated `migration.sql` before applying it.
- **`prisma migrate dev` can fail on a migration that applied fine to the real project.** The Phase
  10 migration that moves `pg_trgm` into an `extensions` schema assumes that schema exists — true on
  Supabase, false on a fresh shadow database — so generating any LATER migration with `migrate dev`
  fails replaying it (P3006/P3018). Workaround (used post-Phase-10): `prisma migrate diff
  --from-config-datasource --to-schema prisma/schema --script` against the live datasource directly
  (no shadow DB involved), review the SQL, apply with `prisma db execute --file <path>` (no `--schema`
  flag — datasource comes from `prisma.config.ts`), and only THEN `prisma migrate resolve --applied
  <name>`. That order matters: `migrate resolve --applied` only updates Prisma's bookkeeping table, it
  runs no SQL — marking a migration applied before actually executing it desyncs tracking from the
  real schema (caught once this way; fixed by executing the SQL, not by re-marking).
- **`CREDENTIALS_ENCRYPTION_KEY` must be set before saving any credential through `secret-box.ts`.**
  Base64, must decode to exactly 32 bytes (`openssl rand -base64 32`); missing or wrong-length fails
  closed (throws) rather than ever storing plaintext.
- **`src/proxy.ts` uses `auth.getSession()`, not `auth.getUser()`, on purpose.** It is not the
  authorization boundary (every page's `getCurrentActor()` does the real, network-verified check), so
  a second `getUser()` call there was a fully redundant round trip to Supabase Auth on every
  navigation and every Server Action. Do not "fix" this back to `getUser()`.
- **A `Date` from a `@db.Date` column is UTC midnight; `Intl.DateTimeFormat` does not default to
  UTC.** Every formatter in this codebase must pass `timeZone: "UTC"` explicitly, or it shows the
  wrong calendar day in a non-UTC timezone. One was missed once (the Daily Statistics charts) and
  only caught by an E2E screenshot.
- **`prisma/seed.ts`'s independent steps must not sit behind a step that can throw.** Node 20 makes
  `seedSuperAdminUser()` throw (no global `WebSocket`, see above); it once ran BEFORE
  `seedExpenseCategories()` in `main()`, so its unhandled throw silently prevented an unrelated,
  independent seed step from ever running. Fixed by ordering independent steps first and wrapping the
  Node-20-fragile admin-provisioning call in try/catch (it logs, it doesn't throw). Apply the same
  ordering when adding a new seed step: put it before, not after, anything that can fail for reasons
  unrelated to it.
- **`brew install redis` (or anything else needing a compiled dependency) can silently balloon into
  compiling LLVM/Rust/coreutils from source** if this Mac's macOS version is newer than Homebrew has
  precompiled bottles for. Discovered this session: the download log showed it fetching
  `llvm-project-22.1.8.src.tar.xz` and Rust bootstrap resources for what should have been a small,
  fast install. Check what a `brew install` is actually about to build (watch the first ~30 seconds of
  output, or `brew info <formula>` for "Not installed" vs. a bottle reference) before letting it run
  unattended — a 30-90+ minute compile is a materially different cost than a bottle download, worth
  surfacing before committing to it, not after.

## 11. Where to go for more

| Need | Document |
| --- | --- |
| Exact status of every specification requirement, with evidence | `docs/REQUIREMENTS.md` |
| System design, layering, RLS reasoning, performance/timezone policy | `docs/ARCHITECTURE.md` |
| Every model, index, constraint, deletion policy | `docs/DATABASE.md` |
| Permission precedence, scopes, the full matrix | `docs/PERMISSIONS.md` |
| Order state machine and search design in full | `docs/ORDERS.md` |
| Design tokens, components, accessibility rules | `docs/DESIGN_SYSTEM.md` |
| Every server action: input, permission, errors, side effects | `docs/API.md` |
| Every env var and which environment needs it | `docs/ENVIRONMENT.md` |
| Deploy targets, the separate queue worker, backups | `docs/DEPLOYMENT.md` |
| Setup, conventions, "how do I add a permission/role/module" | `docs/DEVELOPMENT.md` |
| The original, unmodified 162-section product brief | `docs/SPECIFICATION.md` |
