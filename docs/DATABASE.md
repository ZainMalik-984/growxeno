# Database

PostgreSQL on Supabase, accessed through Prisma ORM 7.

**Implemented:** the identity/RBAC and audit models below.
**Designed but not built:** everything under "Planned models".

---

## Where to change a model

The schema is a **folder**, not one file. Prisma reads every `*.prisma` in `prisma/schema/`
(configured by `schema` in `prisma.config.ts`).

| Looking for | File |
| --- | --- |
| datasource, generator, shared enums | `prisma/schema/schema.prisma` |
| users, roles, permissions, join tables | `prisma/schema/identity.prisma` |
| audit log | `prisma/schema/audit.prisma` |
| *customers* | `crm.prisma` (Phase 2; Buyer removed post-Phase-10, see below) |
| *categories, services* | `catalog.prisma` (Phase 3) |
| *orders, items, links, files, notes, activity* | `orders.prisma` (Phase 4) |
| *daily statistics* | `statistics.prisma` (Phase 6) |
| *ledger, payments, expenses* | `finance.prisma` (Phase 7) |
| *notifications, templates, preferences, message logs* | `messaging.prisma` (Phase 8) — `notification_outbox` stays in `orders.prisma` (Phase 4) |

Add a model to the file for its domain. Create the file when its phase starts. No build step
assembles them.

---

## Conventions

| Concern | Rule |
| --- | --- |
| Table names | `snake_case`, plural (`user_roles`) via `@@map` |
| Field names | `camelCase` in Prisma, `snake_case` in PostgreSQL via `@map` |
| Primary keys | `uuid` — safe to expose in a URL, no enumeration of record counts |
| Instants | `timestamptz(6)`, always UTC |
| Calendar dates | PostgreSQL `date` — "September 9" is not an instant and must not shift by timezone |
| Money | `Decimal @db.Decimal(14,2)`. **Never `Float`.** Serialised to string at the server boundary |
| Enums | PostgreSQL enums for closed sets (`PermissionEffect`, later `OrderStatus`) |
| Deletion | Decided per entity. See "Deletion policy" |

---

## Implemented models

### `users`

The application profile. Separate from Supabase Auth, which owns credentials.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `auth_user_id` | uuid, **unique, nullable** | Points at `auth.users.id`. Nullable so an operator can create a profile before the invitation is accepted. A profile with no auth identity **cannot sign in** — correct fail-closed behaviour |
| `email` | varchar(320), **unique** | Always stored lower-cased by the user service, so uniqueness is genuinely case-insensitive without the `citext` extension |
| `full_name` | varchar(160) | |
| `display_name`, `job_title` | nullable | |
| `phone`, `whatsapp_number` | varchar(32), nullable | E.164 where possible; used by Phase 8 |
| `avatar_url` | text, nullable | |
| `is_active` | boolean, default true | **Drives rule 0 of permission resolution** — an inactive user resolves to zero permissions |
| `deactivated_at` | timestamptz, nullable | |
| `last_login_at` | timestamptz, nullable | |
| `created_by_id` | uuid FK → users, `ON DELETE SET NULL` | Self-relation |

Indexes: `is_active`, `full_name` (list sorting), unique on `email` and `auth_user_id`.

**No foreign key to `auth.users`.** Prisma does not manage the `auth` schema, and a cross-schema FK
would couple our migrations to Supabase internals. Integrity is enforced by the provisioning
service. Detecting orphans is an operational check, not a constraint.

**Deletion: never.** Users are deactivated. Orders, payments and audit rows must keep pointing at a
real person (specification Section 140).

### `roles`

| Field | Notes |
| --- | --- |
| `id` | uuid PK |
| `name` | varchar(80), unique |
| `slug` | varchar(80), unique — stable identifier used by the seed |
| `description` | text, nullable |
| `is_system` | boolean — protected from **deletion** only; permissions stay fully editable |

### `permissions`

| Field | Notes |
| --- | --- |
| `id` | uuid PK |
| `key` | varchar(120), unique — the dotted key application code checks |
| `name`, `module`, `description` | `module` groups the permission editor UI |

Index on `module`. Rows are upserted from `src/lib/permissions/catalog.ts` by the seed; the catalog
in code is the source of truth.

### Join tables

| Table | PK | Extra columns | Cascade |
| --- | --- | --- | --- |
| `user_roles` | `(user_id, role_id)` | `assigned_at`, `assigned_by_id` | user/role delete → cascade; assigner delete → set null |
| `role_permissions` | `(role_id, permission_id)` | `created_at` | cascade both sides |
| `user_permissions` | `(user_id, permission_id)` | `effect` (ALLOW/DENY), `reason`, `created_by_id` | cascade user/permission; creator → set null |

Each has a secondary index on the non-leading key so reverse lookups ("who holds this permission?")
do not scan.

The composite primary key on `user_permissions` means a user **cannot** hold both a direct ALLOW and
a direct DENY for one permission. The resolver still prefers DENY if both ever appeared, rather than
relying on the constraint for safety.

### `audit_logs`

Append-only. Written inside the same transaction as the change it describes.

| Field | Notes |
| --- | --- |
| `id` | uuid PK |
| `actor_user_id` | FK → users, `ON DELETE SET NULL`; null for system actions |
| `actor_email` | **Denormalised snapshot** so the log stays readable after a rename |
| `action` | machine-readable, e.g. `user.role.assigned` |
| `entity_type`, `entity_id` | target |
| `summary` | one-line human sentence |
| `previous_value`, `new_value` | JSONB; services must redact secrets before writing |
| `ip_address`, `user_agent` | nullable |

Indexes: `(entity_type, entity_id, created_at DESC)` for an entity history panel,
`(actor_user_id, created_at DESC)` for "what did this person do", `(created_at DESC)` for the global
feed.

**No update or delete path exists in application code** (specification Section 64).

Audit is distinct from `order_activity` (Phase 4): audit is the security/compliance record, activity
is the human-readable feed on an order. Comments are a third, separate thing.

### Buyer — REMOVED entirely, post-Phase-10 (2026-09-27)

`buyers`, `buyer_contacts` and `buyer_pricing` (Phase 2/3) and `buyer_payments` (Phase 7) all existed
here through Phase 10, modelling a "recurring commercial client" per specification Section 46, with
its own contacts, credit limit, a per-buyer service price override, and payments received. They were
dropped entirely — owner-directed, confirmed directly: "Remove the Buyer category from order and from
system its currently being used in orders." A real migration
(`20260928000000_remove_buyer_and_simplify_order_source`) dropped all four tables, the `buyer_id`
columns on `orders` and `customers`, and the now-dead `buyers.*`/`finance.buyer_payments.*`/
`reports.buyers` permission-catalog keys (with any role/user grant of them, via cascade). This is real
data loss, not a soft removal — any buyer-payment history that existed is gone, recoverable only from
a backup taken before that migration ran (docs/REQUIREMENTS.md's 2026-09-28 verification log has the
full record). Finance's revenue/profit calculations were never affected: they always read
`Order.totalAmount`/`deliveredAt` directly, never `BuyerPayment`.

### `customers` (Phase 2)

The end/job customer (specification Section 3). Buyer, which Customer used to optionally link to, no
longer exists — see above.

| Field | Notes |
| --- | --- |
| `id` | uuid PK |
| `name` | varchar(160) |
| `type` | `PartyType` enum, default INDIVIDUAL |
| `email`, `phone` | nullable |
| `notes` | text, nullable |

Indexes: `name`. **Deletion: hard** (`customers.delete`) — the specification gives Customer a simpler
profile with no active/inactive status, so there is no deactivation to choose between, unlike `users`.
Created only inline from the order form's autocomplete (post-Phase-10, confirmed directly
2026-09-27) — name required, email optional, nothing else asked for there.

### `categories` (Phase 3)

A grouping of related services (specification Section 50), e.g. "Design" containing "UX Design".

| Field | Notes |
| --- | --- |
| `id` | uuid PK |
| `name` | varchar(120), unique |
| `slug` | varchar(120), unique — assigned once at creation, never changed on rename |
| `description` | text, nullable |

**Deletion:** hard delete, refused while it still has any services (move or delete them first).

### `services` (Phase 3)

A sellable service (specification Section 50).

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `name` | varchar(160) | |
| `category_id` | FK → categories, `ON DELETE RESTRICT` | A service always belongs to exactly one category |
| `description` | text, nullable | |
| `base_price` | `numeric(14,2)`, nullable | The default client-facing price. Nullable: a service can exist before its price is finalised. No longer feeds an Order Item's price (D12, below) — kept as a reference figure only |
| `currency` | `char(3)`, default `'USD'` | See "Money" above and docs/REQUIREMENTS.md D1 |
| `metric_type` | `ServiceMetricType` enum, nullable (post-Phase-10, 2026-09-27) | `VIEWS` \| `SUBSCRIBERS` \| `WATCH_HOURS` — which of the three growth metrics this service sells, if any. Drives which structured fields an Order Item against it gets — see `order_items` below and `src/lib/services/metric-type.ts` |
| `is_active` | boolean, default true | A service no longer offered is deactivated, not deleted |

Indexes: `category_id`, `name`, `is_active`.

**What is deliberately NOT a field here:** a per-service "worker cost". Specification Section 24 puts
"Worker cost" on the **Order Item**, not the Service — what it costs to fulfil a specific piece of
work (e.g. an outsourced worker's rate) is a fact about who does *that* work, entered when the Order
Item is created (Phase 4) and snapshotted there, so a later rate change never rewrites history. The
owner was explicit that the business's own Service and whatever an outsourced worker charges are
different things, tracked separately — not one "service" with two prices, and not a second
"outsourced worker's service catalog". See `docs/ARCHITECTURE.md` §12 and `prisma/schema/catalog.prisma`.

**Deletion:** deactivate is the normal lifecycle action. A real delete (`services.delete`) is refused
while any order item still references the service.

**Pricing precedence — historical (docs/REQUIREMENTS.md D3, answered 2026-09-15, then superseded).**
Originally: a per-buyer `buyer_pricing` override if one existed, else `base_price` — and no tier layer
above even that (an earlier version of Phase 2 had a `pricing_tiers` table; removed at the owner's
explicit direction before anything depended on it). `buyer_pricing` was itself dropped entirely with
Buyer, post-Phase-10 (2026-09-27) — see the note above. `base_price` is now purely a reference figure;
nothing reads it to set a price automatically, on an item or on an order.

### `outsourced_workers` (Phase 4)

A third party who fulfils Order Items, with no application account, login, or RBAC — a
cost-tracking contact, not an actor in the system.

| Field | Notes |
| --- | --- |
| `id` | uuid PK |
| `name` | varchar(160) |
| `email`, `phone`, `whatsapp_number` | nullable |
| `notes` | text, nullable |
| `is_active` | boolean, default true |

Indexes: `is_active`, `name`. **Deletion:** deactivate — past order items keep resolving.

### `fiverr_accounts`, `fiverr_gigs`, `fiverr_gig_stats`

The business's own Fiverr seller profiles (there are several), confirmed directly, 2026-09-27 — not
to be confused with `customers`, who is the other side of a transaction. Recorded so an order can say
which of *our* profiles it came in on.

**`fiverr_accounts`**

| Field | Notes |
| --- | --- |
| `id` | uuid PK |
| `name` | varchar(160) |
| `email` | nullable |
| `paypal_email` | nullable |
| `paypal_password_encrypted` | text, nullable. AES-256-GCM ciphertext (`src/lib/crypto/secret-box.ts`, key from `CREDENTIALS_ENCRYPTION_KEY`) — **never** stored or selected as plaintext. List and detail queries return only a derived `has_paypal_password` boolean; reading the real value requires the separate `fiverr_accounts.credentials.view`-gated reveal action, which audits every call |
| `is_active` | boolean, default true |

Indexes: `is_active`, trigram GIN on `name` (`fiverr_accounts_name_trgm_idx`, for the order form's picker
and search). **Deletion:** deactivate — past orders keep resolving.

**`fiverr_gigs`**

| Field | Notes |
| --- | --- |
| `id` | uuid PK |
| `fiverr_account_id` | FK → fiverr_accounts, `ON DELETE CASCADE` |
| `name` | varchar(160) |
| `is_active` | boolean, default true |

Indexes: `fiverr_account_id`, trigram GIN on `name`.

**`fiverr_gig_stats`** — one manually-entered row per gig per day (confirmed directly, 2026-09-27:
"everything will be entered manually daily"). Feeds the two-line (impressions, clicks) chart on the
Gigs page.

| Field | Notes |
| --- | --- |
| `id` | uuid PK |
| `gig_id` | FK → fiverr_gigs, `ON DELETE CASCADE` |
| `stat_date` | date |
| `impressions`, `clicks` | integer, default 0 |
| `created_by_id` | FK → users, `ON DELETE RESTRICT` |

`@@unique(gig_id, stat_date)` — one entry per gig per day; a duplicate is refused with a message to
edit the existing row instead, the same rule as `daily_stats`. **Deletion:** none yet.

### `orders` (Phase 4)

The commercial container (specification Section 22).

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `order_number` | integer, unique, autoincrement | Plain sequential id — the specification asks for an internal number, not a formatted scheme |
| `source` | `OrderSource` enum (FIVERR / EXTERNAL), default EXTERNAL | Owner-directed simplification, post-Phase-10 (2026-09-27) — replaces the original generic four-value enum (DIRECT/WHOLESALE/MANUAL/OTHER). `source` naming "Fiverr" is a deliberate, confirmed exception to Section 23's "provider-agnostic" for this field only |
| `external_reference` | varchar(160), nullable | Plain text, e.g. a Fiverr order id — never a live Fiverr integration of any kind (the Absolute Fiverr Rule still holds — see docs/ORDERS.md §3) |
| `customer_id` | nullable, FK `ON DELETE SET NULL` | Buyer, which an order also optionally linked to, was removed entirely post-Phase-10 — see the note above the `customers` section |
| `order_date` | timestamptz, default now | |
| `deadline` | timestamptz, nullable | Required before Process Order |
| `status` | `OrderStatus` enum, default PENDING | See "Order state machine" below |
| `total_amount` | `numeric(14,2)`, default 0 | The whole order's price, entered directly by whoever creates or edits the order (owner-directed redesign, confirmed directly 2026-09-27, D12) — **no longer derived from items**, which carry no price of their own. Optional at creation, same looseness as the deadline before Process Order |
| `currency` | `char(3)`, default `'USD'` | docs/REQUIREMENTS.md D1 |
| `notes` | text, nullable | |
| `created_by_id` | FK → users, `ON DELETE RESTRICT` | Requested explicitly by the owner, independent of the general audit log |
| `delivered_at` | timestamptz, nullable (Phase 7) | Stamped every time the status transitions to `DELIVERED`, including re-delivery after `REVISION`. Revenue recognition (D4) reads this, not `status`, so a later status change never rewrites when revenue was actually recognised |
| `refunded` | boolean, default false (Phase 7) | Whole-order only, no partial refund to the customer (confirmed directly, 2026-09-17). Toggled independently of `status`; a refunded order still shows its recognized revenue history, just flagged |

Indexes: `status`, `deadline`, `customer_id`, `created_at`, `source`, `fiverr_account_id`.
**Deletion:** none yet — see "Deletion policy" below.

### `order_items` (Phase 4)

The unit of work (specification Section 24). Status is independent of the parent Order (Section 41)
— nothing here is bulk-written by a parent status change.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `order_id` | FK → orders, `ON DELETE CASCADE` | |
| `service_id` | FK → services, `ON DELETE RESTRICT` | |
| `category_id` | FK → categories, `ON DELETE RESTRICT` | Snapshotted from `service.category_id` at creation, so re-categorising the service later does not rewrite what this item was filed under |
| `worker_id` | FK → users, nullable, `ON DELETE SET NULL` | Exactly one of this and `outsourced_worker_id` is set — enforced in the service layer, not a DB constraint |
| `outsourced_worker_id` | FK → outsourced_workers, nullable, `ON DELETE SET NULL` | |
| `description`, `deadline` | both nullable | `description` also doubles as the free-text "note" alongside the metric fields below |
| `channel_link` | text, nullable (post-Phase-10, 2026-09-27) | The client's channel. Only meaningful when `service.metric_type` is set — required by the service layer in that case. Validated http(s)-only, same rule as `order_item_links.url`, and never fetched by the server |
| `target_count` | integer, nullable (post-Phase-10) | How many of the metric are wanted (e.g. "1000 subscribers"). Required by the service layer when `service.metric_type` is set |
| `current_count` | integer, nullable (post-Phase-10) | Where the channel stands right now. Optional even for a metric item — not always known at creation — and defaults to 0 |
| `worker_cost` | `numeric(14,2)`, nullable | Paid to whoever performs the work. Nullable: not resolved for salaried internal staff. Snapshotted at creation/edit — never recomputed from a worker's current rate |
| `worker_cost_currency` | `char(3)`, default `'USD'` | |
| `status` | `OrderItemStatus` enum, default PENDING | Subset of `OrderStatus` — see below |
| `finished_at` | timestamptz, nullable (Phase 9) | Stamped when the item reaches COMPLETED or CANCELLED (the two "earned" states, D5); cleared if a completed item is flagged back to REVISION. Reports and Finance's worker-cost range use this, not `updated_at` (which moves on any edit). Backfilled from `updated_at` for existing finished items |

Indexes: `order_id`, `(worker_id, status)`, `outsourced_worker_id`, `service_id`, `category_id`, `status`, `(status, finished_at)` (Phase 9 — worker and profit reports).
**Deletion:** hard delete, cascades with the order.

**No `selling_price` here any more (D12, post-Phase-10, confirmed directly 2026-09-27: "order price
should be taken for the whole order not for each item").** `orders.total_amount` is the single price
for the whole order; an Order Item has no price of its own. `Service.basePrice` still exists as a
reference figure but no longer feeds an Order Item's price automatically (`BuyerPricing`, the other
half of that old mechanism, was dropped entirely with Buyer — see the note above the `customers`
section).

### `order_item_links` (Phase 4)

A normalized URL on an Order Item (specification Sections 25, 27, 133, 134) — a table, not a text
field, so a URL substring or domain is a real index lookup, not a scan of a notes blob.

| Field | Notes |
| --- | --- |
| `id` | uuid PK |
| `order_item_id` | FK → order_items, `ON DELETE CASCADE` |
| `url` | text — exactly what the user typed, verbatim. The server never fetches it |
| `normalized_url` | text — lower-cased scheme/host, default port and one trailing slash dropped; path case and the query string preserved |
| `domain` | varchar(255) |
| `path` | text |
| `label` | varchar(80), nullable, free text |
| `created_by_id` | FK → users, nullable, `ON DELETE SET NULL` |

Indexes: `order_item_id`, `domain`, and a GIN `pg_trgm` index on `normalized_url` (substring/path
matching) — added by hand in the migration, since Prisma's schema DSL has no portable way to declare
a trigram index. **Deletion:** hard delete.

### `order_notes` (Phase 4)

Internal notes (specification Section 62) — distinct from `order_activity`.

| Field | Notes |
| --- | --- |
| `id` | uuid PK |
| `order_id` | FK → orders, `ON DELETE CASCADE` |
| `body` | text |
| `author_id` | FK → users, `ON DELETE RESTRICT` |

Index on `order_id`. **Deletion:** none built (no note-delete action) — a note is part of an order's
record once written.

### `order_activity` (Phase 4)

The operational feed on an order (specification Section 64) — distinct from `audit_logs` (the
security/compliance record) and from `order_notes`.

| Field | Notes |
| --- | --- |
| `id` | uuid PK |
| `order_id` | FK → orders, `ON DELETE CASCADE` |
| `actor_id` | FK → users, nullable, `ON DELETE SET NULL` |
| `actor_label` | varchar(160), nullable — denormalised snapshot, survives a rename or the actor row being nulled out |
| `action` | varchar(80) — machine-readable, e.g. `"order.status_changed"` |
| `summary` | text — human-readable, e.g. "Ahmed changed the item status from In Progress to Internal Review." |

Index on `(order_id, created_at)`. **Deletion: never** — same reasoning as `audit_logs`.

### `notification_outbox` (Phase 4, addition ahead of Phase 8)

Durable notification **intent**, written inside Process Order's transaction (specification Section
21 addition, justified in `docs/ARCHITECTURE.md` §8) — an unreachable email/WhatsApp provider must
never fail the order change itself.

| Field | Notes |
| --- | --- |
| `id` | uuid PK |
| `event_type` | varchar(80), e.g. `"order.processed"` |
| `payload` | jsonb |
| `status` | varchar(20), default `"PENDING"` |
| `sent_at`, `error` | both nullable |

Index on `(status, created_at)`. **No dispatcher drains this yet** — that is Phase 8. Writing it now
means Process Order's transaction shape does not change when the dispatcher is added.

### `daily_stats` (Phase 6)

Manually entered per user per calendar day (specification Sections 51-53) — **never** derived from
`orders`/`order_items`; no query in this codebase joins this table against Orders to "fill in" a
number, and none should ever be added.

| Field | Notes |
| --- | --- |
| `id` | uuid PK |
| `user_id` | FK → `users`, cascade delete |
| `stat_date` | `date`, not `timestamptz` — a calendar day, not an instant |
| `orders`, `completed`, `pending` | plain integers, whatever was typed |
| `revenue` / `revenue_currency` | `Decimal(14,2)` + `char(3)`, default `"USD"` — the standard money pair, no conversion |
| `notes` | nullable text |
| `created_by_id` | FK → `users`, restrict delete — usually an admin entering it FOR `user_id`, not the same person |

`@@unique([user_id, stat_date])` answers docs/REQUIREMENTS.md's D10 (a second entry for a day
already recorded is refused, not summed or silently overwritten — edit the existing row instead) and
was planned before this table existed (see the old "Index policy" note, now superseded by this
section). Index on `stat_date` alone supports the range queries behind the dashboard's Today/7/30/90-
day/custom views.

### Order state machine

`OrderStatus`: `PENDING`, `PROCESSING`, `IN_PROGRESS`, `INTERNAL_REVIEW`, `READY_FOR_DELIVERY`,
`DELIVERED`, `COMPLETED`, `REVISION`, `CANCELLED` (specification Section 39). `OrderItemStatus` is
the subset that means anything for one unit of work: `PENDING`, `IN_PROGRESS`, `INTERNAL_REVIEW`,
`REVISION`, `COMPLETED`, `CANCELLED`. The full transition tables, preconditions, and the Process
Order transaction are implemented in `src/lib/orders/state-machine.ts` and `src/lib/orders/service.ts`,
and documented in full in `docs/ORDERS.md` — this is the one place that decides whether a transition
is legal.

### `expense_categories` (Phase 7)

Configurable expense categories (specification Section 60 asks for this explicitly). Seeded with the
spec's examples (Software, Advertising, Infrastructure, Salaries, Office, Miscellaneous).

| Field | Notes |
| --- | --- |
| `id` | uuid PK |
| `name`, `slug` | both unique |
| `is_active` | default true — deactivated, not deleted, so past expenses keep resolving, same pattern as `categories`/`services` |

Index on `is_active`. **Deletion:** never — deactivate only.

### `expenses` (Phase 7)

A recorded cost (specification Section 60).

| Field | Notes |
| --- | --- |
| `id` | uuid PK |
| `amount` / `currency` | standard money pair, `char(3)` default `'USD'` |
| `category_id` | FK → `expense_categories`, `ON DELETE RESTRICT` |
| `date` | `date`, not `timestamptz` — a calendar day |
| `description`, `notes` | both nullable text |
| `order_id` | FK → `orders`, nullable, `ON DELETE SET NULL` — an expense may be attributed to a specific order (e.g. an outsourced worker's cost). Confirmed directly (2026-09-17): even when order-linked, an expense is reported **separately** from that order's revenue, never netted into one blended figure |
| `paid_by_id` | FK → `users`, nullable, `ON DELETE SET NULL` |
| `created_by_id` | FK → `users`, `ON DELETE RESTRICT` |

Indexes: `date`, `order_id`, `category_id`. **Deletion: none built** (D8 — edit in place; the audit
log keeps the history of any correction). No "Attachment" field yet — same Storage-bucket gap as
Order files (docs/ARCHITECTURE.md §12 point 12).

### `buyer_payments` — REMOVED, post-Phase-10 (2026-09-27)

Money received from a Buyer (specification Section 59) existed here through Phase 10 — admin picked
per payment which order it allocated to, or left it unallocated "on account" (docs/REQUIREMENTS.md
D6). Dropped entirely along with Buyer itself, owner-directed — see the note above the `customers`
section. This is real, irreversible data loss for any payment history that existed; nothing in
Finance's revenue/profit calculations depended on it, since those always read `Order.totalAmount`/
`deliveredAt` directly.

### `worker_payments` (Phase 7)

Money paid to a worker (specification Section 58) — a **lump sum**, not itemized per Order Item
(confirmed directly, 2026-09-17: the owner pays a worker periodically for everything completed since
the last payment). No order/order-item FK for this reason; "what's earned" is derived from
`OrderItem.workerCost` instead, at read time.

| Field | Notes |
| --- | --- |
| `id` | uuid PK |
| `worker_id` | FK → `users`, nullable, `ON DELETE RESTRICT` |
| `outsourced_worker_id` | FK → `outsourced_workers`, nullable, `ON DELETE RESTRICT` — exactly one of this and `worker_id` is set, enforced in the service layer, same XOR pattern as `OrderItem` |
| `amount` / `currency` | standard money pair |
| `payment_date` | `date` |
| `reference`, `notes` | both nullable |
| `created_by_id` | FK → `users`, `ON DELETE RESTRICT` |

Indexes: `worker_id`, `outsourced_worker_id`, `payment_date`. **Deletion:** hard delete (D8 — a wrong
entry is deleted and re-entered correctly; the audit log records the removal).

### No `financial_transactions` ledger table

`docs/DATABASE.md`'s own "Planned models" table (below, superseded by this note) once listed a
polymorphic `financial_transactions` table as "the financial source of truth." It was never built.
Instead, a Worker's earned/paid/outstanding is computed **at read time** by aggregating
`Order`/`OrderItem`/`WorkerPayment` directly (`src/lib/finance/queries.ts`) — no second table that
could drift from them. This is the same
"financial truth lives in a ledger, never a stored balance" principle the specification asks for
(Sections 57, 61); a dedicated transactions table would have been a second place the same fact could
go stale, not a requirement. Revenue is recognised when `Order.deliveredAt` is set (D4); a worker
earns an item's `workerCost` once that item reaches `COMPLETED`, or is `CANCELLED` with a manually
adjusted-down `workerCost` reflecting partial work done (D5) — see `finance.prisma`'s header comment
for the full reasoning, and `EARNED_ITEM_STATUSES`/`REVENUE_RECOGNIZED_STATUSES` in
`src/lib/finance/queries.ts`.

### `notifications` (Phase 8)

In-app notification (specification Section 67). Written synchronously — a database write, not a
provider call, so it needs no queue.

| Field | Notes |
| --- | --- |
| `id` | uuid PK |
| `recipient_id` | FK → `users`, `ON DELETE CASCADE` |
| `type` | `notification_event` enum — reused as the "Type" field Section 67 asks for |
| `title`, `message` | varchar(160) / text |
| `is_read`, `read_at` | boolean + nullable timestamp |
| `entity_type`, `entity_id`, `action_url` | all nullable — lets the notification centre link straight to what changed |

Index on `(recipient_id, is_read, created_at)`. **Deletion:** none built — a notification is cheap
enough to keep; no volume problem has appeared yet to justify pruning.

### `notification_templates` (Phase 8)

A reusable, validated message template (specification Section 70) — one per (event, channel).

| Field | Notes |
| --- | --- |
| `id` | uuid PK |
| `event`, `channel` | enums; `@@unique([event, channel])` |
| `name`, `subject` (email only), `body` | |
| `required_variables` | `text[]` — checked against `src/lib/notifications/events.ts`'s closed variable set and against what actually appears in `body`/`subject` before saving |
| `meta_template_name`, `meta_template_language` | WhatsApp only — Meta's own pre-approval is not something this application can grant |
| `is_active` | default true |

**Deletion:** hard delete allowed — unlike `Expense` (D8: edit in place, no delete, because
historical financial records must keep resolving), nothing depends on a template surviving
(`message_logs.template_id` is nullable with `ON DELETE SET NULL` specifically so a log outlives its
template being removed). Content configuration, not an audit trail.

### `notification_preferences` (Phase 8)

Per-user override of the system default (specification Section 74).

| Field | Notes |
| --- | --- |
| `id` | uuid PK |
| `user_id` | FK → `users`, `ON DELETE CASCADE` |
| `event`, `channel` | enums; `@@unique([user_id, event, channel])` |
| `enabled` | boolean |

A row's **absence** means "use the default" (`src/lib/notifications/events.ts`'s
`DEFAULT_NOTIFICATION_PREFERENCES`) — never a duplicated copy of the defaults in the database.
Self-service only: a user manages their own row, no permission key needed (same reasoning as Daily
Statistics' self-view). **Deletion:** none needed — `enabled: true` is functionally equivalent to no
row for most events, but the row is kept rather than deleted on "reset to default" to keep the upsert
logic simple.

### `message_logs` (Phase 8)

Every outbound message, one row per attempt (specification Section 71). **Empty today, by design** —
no dispatcher exists yet to write to it (see `notification_outbox` below and
docs/NOTIFICATIONS.md §7).

| Field | Notes |
| --- | --- |
| `id` | uuid PK |
| `recipient_id` | FK → `users`, nullable, `ON DELETE SET NULL` |
| `recipient_label` | denormalized snapshot — the real recipient is often NOT a `User` (an `OutsourcedWorker`, a Customer, a plain email/phone), same pattern as `OrderActivity.actor_label` |
| `channel`, `event` | enums |
| `template_id` | FK → `notification_templates`, nullable, `ON DELETE SET NULL` |
| `provider_message_id` | nullable — the provider's own id, once one exists |
| `status` | `message_status` enum: `QUEUED → SENDING → SENT → DELIVERED`, or `FAILED` |
| `error` | nullable |
| `created_at`, `sent_at`, `delivered_at` | |

Indexes: `(status, created_at)`, `recipient_id`, `event`. **Deletion:** none built — same reasoning as
`order_activity`/`audit_logs`; a delivery record should survive.

### `notification_outbox` (Phase 4, formalized this phase)

Unchanged in shape since Phase 4 — see that section above — except `event_type` moved from a free-text
`varchar(80)` to the new `notification_event` enum (migration `20260918141857_add_messaging`
hand-remapped the two existing values, `"order.processed"` → `ORDER_PROCESSED` and
`"order_item.stop_work_requested"` → `ORDER_ITEM_STOP_WORK_REQUESTED`, rather than dropping the
column's data — see docs/DEVELOPMENT.md's Gotchas). **Still no dispatcher drains it** — rows
accumulate as `PENDING` until docs/NOTIFICATIONS.md §7's queue is built.

---

## Deletion policy

Decided per entity, not applied blanket (specification Section 139).

| Entity | Policy | Why |
| --- | --- | --- |
| `users` | **Deactivate** | Historical orders, payments and audit rows must survive |
| `roles` | Hard delete, blocked for `is_system` | A deleted role is a configuration change, not history. Assignments cascade |
| `permissions` | Hard delete (via catalog removal) | Definitions, not records |
| join tables | Hard delete | The audit log records that the grant existed and when it was removed |
| `audit_logs` | **Never deleted** | It is the record |
| `customers` | Hard delete | No active/inactive status is specified for Customer (Section 49) |
| `categories` | Hard delete, blocked while it has services | A category name is configuration, not history |
| `services` | **Deactivate**; hard delete blocked while any order item still references it | A service no longer offered stays resolvable for past orders |
| `daily_stats` | Hard delete | A correction (specification Section 53's "Delete daily stats"); no soft-delete state is specified for this entity |
| `orders` | None yet built | Financial and operational history — a delete path is not yet needed by any real workflow; `refunded` (Phase 7) covers the "this order didn't happen as billed" case without removing the row |
| `expense_categories` | Deactivate | Mirrors `categories`/`services` — past expenses keep resolving |
| `expenses` | **None built** — edit in place | D8 (answered 2026-09-17): corrections are made by editing the record directly; the audit log keeps the history. Matches the pre-existing `finance.expenses.*` permission catalog shape, which never included a delete key |
| `worker_payments` | Hard delete | D8: a wrong entry is deleted and re-entered correctly; the audit log records the removal |
| `notifications` | None built | Cheap to keep; no volume problem has appeared to justify pruning |
| `notification_templates` | Hard delete | No historical record depends on a template surviving (`message_logs.template_id` is `SET NULL`) — content configuration, not an audit trail, unlike `expenses` |
| `notification_preferences` | None built | A per-user override row is cheap and small in number (bounded by event × channel) |
| `message_logs` | None built | Same reasoning as `order_activity`/`audit_logs` — a delivery record should survive |

---

## Migrations

```
prisma/migrations/
  20260910120000_init/                all Phase 1 tables, enums, indexes, FKs
  20260910120100_enable_rls/          RLS + REVOKE on the declared tables
  20260910123000_harden_public_schema/ schema-wide sweep (see below)
  20260915223956_add_crm_buyers_customers/ Phase 2 tables (originally including pricing_tiers)
  20260915224500_enable_rls_crm/      RLS + REVOKE on the four Phase 2 tables
  20260915234500_remove_pricing_tiers_add_catalog/ drops pricing_tiers; adds categories, services, buyer_pricing
  20260915234600_enable_rls_catalog/  RLS + REVOKE on the three new tables
  20260916025241_add_orders/          Phase 4 tables; hand-added pg_trgm GIN index (see below)
  20260916025400_enable_rls_orders/   RLS + REVOKE on the seven Phase 4 tables
  20260916223104_add_daily_statistics/ Phase 6 table — also (accidentally) dropped the trgm index above
  20260916223200_restore_order_item_links_trgm_index/ puts it back — see docs/DEVELOPMENT.md's gotcha
  20260916223300_enable_rls_daily_stats/ RLS + REVOKE on daily_stats
  20260917170005_add_finance/         Phase 7 tables: expense_categories, expenses, buyer_payments,
                                       worker_payments; Order.delivered_at/refunded — hand-edited to
                                       remove another accidental DROP INDEX on the trgm index (see below)
  20260917170200_enable_rls_finance/  RLS + REVOKE on the four Phase 7 tables
  20260918141857_add_messaging/       Phase 8 tables: notifications, notification_templates,
                                       notification_preferences, message_logs; converts
                                       notification_outbox.event_type from varchar to the new
                                       notification_event enum WITHOUT losing existing rows'
                                       values — hand-edited (see below)
  20260918142500_enable_rls_messaging/ RLS + REVOKE on the four Phase 8 tables
  20260918230633_add_search_indexes_and_item_finished_at/ Phase 9: order_items.finished_at (backfilled
                                       from updated_at for COMPLETED/CANCELLED items) + (status,
                                       finished_at) index; 17 pg_trgm GIN indexes for global search.
                                       No DROP INDEX in the generated SQL — see below
```

All seventeen are applied to the configured project, and `prisma migrate status` reports no drift.

`20260916025241_add_orders` hand-adds one statement Prisma's schema DSL cannot express: a `pg_trgm`
GIN index on `order_item_links.normalized_url` (specification Section 27's substring/domain search).
Because Prisma has no record of it, **every subsequent migration that diffs the schema will propose
dropping it** — which is exactly what `20260916223104_add_daily_statistics` did, silently, until
`20260916223200` put it back, and what `20260917170005_add_finance` and `20260918141857_add_messaging`
both proposed again (caught both times with `--create-only` before applying, and hand-edited out).
**Resolved in Phase 9** (`20260918230633_add_search_indexes_and_item_finished_at`): Prisma can
declare a trigram index in the schema (`@@index([col(ops: raw("gin_trgm_ops"))], type: Gin, map: ...)`,
no preview feature). The original index and the 17 new search indexes are now declared, and that
migration's generated SQL contained no `DROP INDEX` at all — the standing hazard is gone for indexes
declared this way. See docs/DEVELOPMENT.md's Gotchas.

`20260918141857_add_messaging` also hand-edits a second, unrelated problem in the same file: Prisma's
naive diff for changing `notification_outbox.event_type` from `varchar` to the new enum was
`DROP COLUMN` + `ADD COLUMN ... NOT NULL`, which would have destroyed the 22 `"order.processed"` and
7 `"order_item.stop_work_requested"` rows already in the table (verified against the live project
before editing). Rewritten by hand to add a new enum column, `UPDATE ... CASE` the old string values
across to their new enum equivalents, then drop the old column and rename — verified afterward with a
`groupBy` query that both values landed on the correct new enum members.

`20260915234500` exists because the pricing-tier concept was removed at the owner's explicit
direction shortly after Phase 2 shipped, before anything depended on it (see `crm.prisma`'s header
comment and docs/REQUIREMENTS.md D3). Rather than editing the already-applied
`20260915223956` migration — which would desync its checksum from what actually ran — this is a
normal forward migration: drop the table and the column that referenced it, in the same run that adds
the Phase 3 catalog. The six seeded tier rows carried no other data, so nothing of substance was lost.
`prisma migrate dev` refuses this destructive a diff non-interactively, so both this migration and the
RLS one that follows it were generated with `prisma migrate diff --script` and applied with
`migrate deploy`, same tooling as every other migration — just without the interactive prompt.

RLS-enable migrations needed their own explicit step even though `20260910123000_harden_public_schema`
had already revoked the default privileges that would otherwise auto-grant `anon`/`authenticated` on
new tables: RLS-enabled state has no "default" the way grants do, so it must be turned on per table,
every time a table is added, same as the original `20260910120100_enable_rls`.

The third migration exists because the second was **not enough**. It covered the seven tables the
schema declares, but Prisma creates `_prisma_migrations` itself, in `public`, where Supabase's
default privileges grant ALL to `anon` and `authenticated`. Verified against the live project: with
only the anon key, that table was readable and a `DELETE` returned HTTP 204. Destroying migration
history makes `migrate deploy` try to re-run everything.

The hardening migration therefore sweeps the whole schema rather than naming tables — RLS on every
table, `REVOKE ALL` from both API roles, and a `ALTER DEFAULT PRIVILEGES ... REVOKE` so future
tables are not auto-granted. Re-verified afterwards: `42501` on read and on delete.

**This list stops at Phase 9** (22 migrations are applied as of 2026-09-28; `prisma migrate status`
reports no drift). Later ones, in order: `20260919120000_harden_api_surface` (Phase 10 — moves
`pg_trgm` into an `extensions` schema, revokes future-function auto-grants);
`20260927120000_add_fiverr_accounts_and_gigs`/`20260927120500_enable_rls_fiverr` (Fiverr accounts/
gigs); `20260927190000_order_item_redesign` (D12 — drops `order_items.selling_price`/
`selling_price_currency`, adds the metric fields, adds `services.metric_type`); and
`20260928000000_remove_buyer_and_simplify_order_source` (drops `buyers`/`buyer_contacts`/
`buyer_pricing`/`buyer_payments` and their permission-catalog keys, and hand-patches the
auto-generated `OrderSource` enum cast to backfill existing rows by whether they already had a
`fiverr_account_id`, since the new two-value enum shares no labels with the old one).

Apply with `pnpm db:migrate` (development) or `pnpm db:migrate:deploy` (production), then
`pnpm db:seed`.

Migrations run over `DIRECT_URL` (a real session), never the transaction pooler. Never run
`prisma db push` or `migrate reset` against a populated or unknown database.

---

## Row Level Security

Enabled on **all thirty** tables in `public` with **no permissive policies**, plus `REVOKE ALL`
from `anon` and `authenticated`: the seven Phase 1 tables, `_prisma_migrations`, the three Phase 2
CRM tables, the three Phase 3 catalog tables, the seven Phase 4 Orders tables, the one Phase 6
`daily_stats` table, the four Phase 7 Finance tables (`expense_categories`, `expenses`,
`buyer_payments`, `worker_payments`), and the four Phase 8 Messaging tables (`notifications`,
`notification_templates`, `notification_preferences`, `message_logs`).

No permissive policy exists for `notifications` either, even though a future Supabase Realtime
subscription (deferred this phase, docs/NOTIFICATIONS.md §9) would need one scoped to
`recipient_id = auth.uid()` — added when Realtime is actually wired up and can be reviewed with it,
not ahead of the feature that needs it.

Verified from outside the application: both the anon key and the publishable key receive `42501
permission denied` for every table, and zero table grants remain for either role. Re-verified after
every phase that added a table (Phase 2: `buyers`, `buyer_contacts`, `customers`; Phase 3:
`categories`, `services`, `buyer_pricing`; Phase 4: all seven Orders tables; Phase 6: `daily_stats`;
Phase 7: all four Finance tables, via anon-key curl against each PostgREST endpoint; Phase 8: all
four Messaging tables, same method); also confirmed `pricing_tiers` no longer exists at all
(`PGRST205`, not `42501`).

`FORCE ROW LEVEL SECURITY` is deliberately **not** used: it would apply RLS to the table owner,
which is how Prisma connects, and lock the application out of its own database.

Full reasoning and the two-sided test plan: `docs/PERMISSIONS.md` §5.

---

## Planned models

Shape is decided; tables are not created. Field inventories live in the specification sections
noted.

Everything from the original Section 21 entity list is now built except `order_files` (needs a
Storage bucket) — the one model left in this table. Finance (§56–61, Phase 7) and Messaging (§65–74,
Phase 8) are both now built — see their model sections above — without, respectively, a
`financial_transactions` ledger table (see "No `financial_transactions` ledger table" above) and a
working Redis/BullMQ queue (see the `notification_outbox` section above and
docs/NOTIFICATIONS.md §7); neither omission is forgotten scope.

| Model | Purpose | Key relationships | Spec |
| --- | --- | --- | --- |
| `order_files` | Metadata only; bytes in Supabase Storage | order and/or item | §63 |

### Two planned decisions worth stating early

**`order_item_links` is a table, not a text field.** Specification Section 27 requires finding an
order by a URL inside one of its items, with domain and substring matching. That is a `pg_trgm` GIN
index on `normalized_url` plus a B-tree on `domain` — impossible against a notes blob.
Normalization lowercases scheme and host and drops a default port and one trailing slash; it
**preserves path case and the query string**, because those are frequently meaningful. The original
`url` is always kept verbatim. User-supplied URLs are never fetched by the server.

**`notification_outbox` is an addition to the Section 21 list.** Process Order must record
notification intent durably inside the same transaction as the business change. Calling Redis or a
provider inside that transaction would make order processing fail when a message queue is down.
The outbox row commits with the order; a dispatcher drains it afterwards.

**Order Item worker cost is snapshotted, not computed on read.** Worker cost (paid to whoever performs
the work) is its own stored field on the Order Item, copied there **at creation time** from whatever
the resolved rate is then, so a later change to a worker's rate never rewrites what an existing order
already recorded as paid. This was confirmed directly by the owner and is the same reasoning as
`docs/DATABASE.md`'s general stance against computing financial truth on read.

**Superseded, post-Phase-10 (2026-09-27, D12): an Order Item's "Selling price" no longer exists.**
Specification Section 24's original design gave the item its own selling price, snapshotted the same
way as worker cost above. The owner's later, directly-confirmed instruction ("order price should be
taken for the whole order not for each item") moved price to `orders.total_amount` entirely — see the
`order_items` and `orders` sections above.

**An Order Item's worker is internal staff or an outsourced third party, and these are not the same
kind of record — decided and built in Phase 4.** The owner's actual workflow: some work is done
in-house by a `User` holding a Worker-ish role (Phase 1's RBAC already supports this — no schema
change needed there); other work is outsourced to a third party who has no application account, no
login, and no need for one — just a name and a cost to track per Order Item. Modelling an outsourced
worker as a `User` (requiring an email, an auth identity, RBAC) would be wrong for someone who is a
cost-tracking record, not an actor in the system. The Order Item's worker reference therefore points
at ONE of two different things: `OrderItem.workerId` (nullable FK to `users`) or
`OrderItem.outsourcedWorkerId` (nullable FK to the lightweight `outsourced_workers` table — name,
contact, notes, no auth, no roles), exactly one set, enforced in the service layer. Phase 5 built the
internal-worker-facing side of this split: the Worker Dashboard, actions and profile
(`src/lib/workers/queries.ts`, `/workers`) all read `OrderItem.workerId`, never
`outsourcedWorkerId` — an outsourced worker has no profile to view because they are not a user of
the system.

**Orders come from Fiverr, entered manually — this is not a Fiverr integration.** The owner's
business takes orders on Fiverr and re-enters them here to track the work; specification Section 23's
generic `source` field (DIRECT / WHOLESALE / MANUAL / OTHER) already covers this without naming
Fiverr anywhere in the schema or code — a Fiverr-sourced order is simply `source = MANUAL`. This is
consistent with, not an exception to, the specification's Absolute Fiverr Rule (Section 2: no Fiverr
API, auth, sync, or scraping) — nothing here calls or depends on Fiverr; a human reads an order off
Fiverr and types it in, same as any other manually-entered order.

**`orders.created_by` and an update history are required, not optional additions.** The owner asked
for this explicitly, independent of the general audit log: every Order needs a `created_by_id` (FK to
`users`, mirroring `User.createdById`'s pattern), and its field-level change history should be visible
on the order itself (via `order_activity`, not only the cross-entity `audit_logs`), the same way
`docs/PERMISSIONS.md` distinguishes the two for the identity domain.

---

## Trigram search indexes (Phase 9)

Global search (specification Section 76) runs case-insensitive `contains` (`ILIKE '%term%'`) on text
columns, which a normal B-tree cannot serve. `pg_trgm` GIN indexes do, all **declared in the
Prisma schema** (`@@index([col(ops: raw("gin_trgm_ops"))], type: Gin, map: "<table>_<col>_trgm_idx")`)
so `migrate dev` no longer proposes dropping them. As of Phase 9 (this table is not kept current for
tables added afterward, e.g. `fiverr_accounts`/`fiverr_gigs` — check `prisma/schema/*.prisma` directly
for the exact current set):

| Table | Columns |
| --- | --- |
| `customers` | `name`, `email`, `phone` |
| `users` | `full_name`, `email`, `phone` |
| `outsourced_workers` | `name`, `phone` |
| `services`, `categories` | `name` |
| `orders` | `external_reference` |
| `order_item_links` | `normalized_url` (Phase 4 — the original, now declared too) |

Verified with `EXPLAIN` under `SET LOCAL enable_seqscan = off`: each planner picks a `Bitmap Index Scan`
on its trigram index (on tables this small Postgres would otherwise choose a sequential scan, which is
correct at this size — the indexes are for when the data grows). Cost: extra write work and storage on
these tables; negligible here, and the only indexes added speculatively rather than against an existing
query — search is the query.

## Index policy

Indexes are added **against real queries, in the phase that introduces them**, and justified here.
Every index costs write throughput and storage. Current indexes are listed per model above; this
section no longer carries a "planned candidates" list — the ones once named here (`orders(status,
deadline)`, `orders(buyer_id, created_at DESC)`, `order_items(worker_id, status)`, the
`order_item_links` trigram and domain indexes, `daily_stats(user_id, stat_date)`) all shipped with
Phases 4 and 6. Add a new row here, against a real query, when the next phase needs one — do not
add one speculatively.
