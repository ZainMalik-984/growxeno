# Orders

> **Status: IMPLEMENTED (2026-09-16, extended 2026-09-16 with Phase 5's Worker Dashboard/Actions/
> Profile), except order files.**
> `prisma/schema/orders.prisma`, `src/lib/orders/*`, `src/lib/workers/*`, `/orders`, `/orders/new`,
> `/orders/[id]`, `/workers`, `/workers/[id]`. The state machine and search design below were written
> before the code (specification Section 159) and matched it as built — this document is no longer a
> forecast, it describes what runs. Order files (§63) are the one exception: no Supabase Storage
> bucket is configured in this project, so uploads are not built — see docs/REQUIREMENTS.md's Phase
> 4 entry for that gap specifically, and §9/§11 below for the interim substitute.
>
> Five things changed from what this document originally said, all at the owner's explicit
> direction, recorded here so the reasoning survives: Order Item `workerCost` is a snapshot taken at
> creation/edit, never recomputed from a current worker rate; an Order Item's worker is either an
> internal `User` or a distinct, login-less `OutsourcedWorker` record; post-Phase-10 (2026-09-27,
> D12), an Order Item no longer has a `sellingPrice` of its own at all — the whole order's price is
> `Order.totalAmount`, entered directly, not derived from items; `source` is now a two-value enum,
> `FIVERR`/`EXTERNAL` (2026-09-28), replacing the original generic four-value one; and Buyer, which
> an order used to optionally reference, was removed from the system entirely (2026-09-28) — see
> `prisma/schema/orders.prisma`'s and `prisma/schema/crm.prisma`'s doc comments for all five.

---

## 1. Order vs Order Item

Two records, deliberately.

- An **Order** is the commercial container: an optional customer, which of the business's own
  Fiverr accounts it came in on (only when the source is Fiverr), a source, a deadline, a status,
  and its whole price (post-Phase-10, D12 — one number for the whole order, not summed from items).
- An **Order Item** is the unit of work: its own service, category, **worker**, deadline, worker cost,
  status, description/note, and — for a service tagged with a metric type — a channel link and
  target/current count. It has no price of its own.

One order may contain items handled by different people, finishing at different times.

**Their statuses are independent** (specification Section 41). A parent status change must never
bulk-write item statuses. Item completion may make an order transition *available*; it never
performs one silently.

```
Order #10482 — IN_PROGRESS
├── UX Design       Ahmed  COMPLETED    due today 16:00
└── Development     Bilal  IN_PROGRESS  due today 14:00
```

## 2. Fields

**Order** (§22): internal order number, source, customer (optional), which Fiverr account (only when
source = FIVERR, post-Phase-10), order date, deadline, status, total amount (the whole order's
price, entered directly — D12), notes, created-by, timestamps, plus optional generic external
reference fields.

**Order Item** (§24, redesigned post-Phase-10 D12): order, service, category, worker, description/note,
item deadline, channel link + target/current count (only when the service has a metric type), worker
cost, status, links, files, timestamps. No price of its own.

Money is `Decimal(14,2)`. Deadlines are `timestamptz`; day-boundary filters ("due today") resolve in
the business timezone, on the server.

## 3. Source

A plain enum field: `FIVERR` | `EXTERNAL` (post-Phase-10, 2026-09-28, owner-directed, confirmed
directly: "currently there are only two sources for order Fiverr and External" — replacing the
original generic four-value `DIRECT`/`WHOLESALE`/`MANUAL`/`OTHER` enum). `fiverrAccountId` is
required by the service layer when `source = FIVERR` (confirmed directly: "fiverr account should be
taken if source is Fiverr"), and forced to `null` — never asked for on the form — when
`source = EXTERNAL`.

**There is still no live Fiverr integration** and none may be added: no API, auth, sync, scraping,
webhooks, import or marketplace automation. Naming a source value "Fiverr" is a deliberate, confirmed
exception to Section 2's "generic, provider-agnostic" instruction for this one field only — an
externally-originated order is still recorded manually, and any external reference still goes in a
generic reference field, never a provider-specific module beyond this.

**This is distinct from tracking the business's OWN Fiverr seller accounts (post-Phase-10,
2026-09-27, confirmed directly).** `FiverrAccount`/`FiverrGig`/`FiverrGigStat` are plain,
manually-maintained records — name, email, PayPal credentials, gig names, daily impressions/clicks
typed in by a human — that let `Order.fiverrAccountId` say *which of our own profiles* an order came
in on. Nothing here calls Fiverr, authenticates against it, or reads anything from it; it is exactly
the same category of fact as `externalReference` (a human re-typing what they saw on Fiverr's site),
just structured as a linkable record instead of free text because there are multiple accounts to
choose between. The rule this section states is unchanged: no code anywhere talks to Fiverr.

## 4. Statuses

`PENDING`, `PROCESSING`, `IN_PROGRESS`, `INTERNAL_REVIEW`, `READY_FOR_DELIVERY`, `DELIVERED`,
`COMPLETED`, `REVISION`, `CANCELLED`.

### Allowed transitions

The map lives in **one** exported constant, `src/lib/orders/state-machine.ts`. Nothing else decides
whether a transition is legal.

| From | May move to |
| --- | --- |
| `PENDING` | `PROCESSING`, `CANCELLED` |
| `PROCESSING` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `INTERNAL_REVIEW`, `REVISION`, `CANCELLED` |
| `INTERNAL_REVIEW` | `READY_FOR_DELIVERY`, `REVISION`, `CANCELLED` |
| `READY_FOR_DELIVERY` | `DELIVERED`, `REVISION`, `CANCELLED` |
| `DELIVERED` | `COMPLETED`, `REVISION` |
| `REVISION` | `IN_PROGRESS`, `CANCELLED` |
| `COMPLETED` | — terminal (order level; see the Item statuses note below for the item-level exception) |
| `CANCELLED` | — terminal |

Arbitrary jumps are rejected. Every transition needs `orders.change_status`; `PENDING → PROCESSING`
additionally needs `orders.process`.

### Preconditions

| Transition | Requires |
| --- | --- |
| `PENDING → PROCESSING` | at least one item; every item has a service and a worker; deadlines present |
| `IN_PROGRESS → INTERNAL_REVIEW` | every **required** item is `COMPLETED` (see D11) |
| `READY_FOR_DELIVERY → DELIVERED` | recorded by a user holding `orders.change_status` |
| `DELIVERED → COMPLETED` | no open revision |
| `* → CANCELLED` | reason required; recorded in activity |

> **Open decision D11:** which items count as "required" for completion. §41 says "all required
> items" without defining required. Until answered, Phase 4 will treat *every non-cancelled item*
> as required and surface the assumption in the UI.

### Item statuses

Items use the same enum, restricted to the subset that means anything for a unit of work:
`PENDING`, `IN_PROGRESS`, `INTERNAL_REVIEW`, `REVISION`, `COMPLETED`, `CANCELLED`.

A worker with `orders.change_status` may move **their own** item along
`PENDING → IN_PROGRESS → INTERNAL_REVIEW`, and `REVISION → IN_PROGRESS`. They may not mark an order
delivered or completed.

**`COMPLETED → REVISION` is an admin-only escape hatch (Phase 7).** Work verified as done can still
fail afterward — the owner's example: 1,000 subscribers delivered, then some unsubscribe, and the
same worker must redo the shortfall. `ITEM_TRANSITIONS.COMPLETED` (the broad/admin map) allows
`→ REVISION`; `WORKER_ITEM_TRANSITIONS.COMPLETED` stays `[]` — a worker can never self-reopen their
own completed item. The admin flags it and adds a note (`OrderNote`, surfaced to the worker outside
this system, e.g. WhatsApp — no in-app messaging integration exists yet).

## 5. Process Order

Authorized by `orders.process`. Specification Section 42, in order:

1. Validate the order and its items.
2. Validate assignments (every item has a worker and a deadline).
3. **Begin transaction.**
4. Change the order status to `PROCESSING`.
5. Activate assigned items (`PENDING → IN_PROGRESS` where appropriate).
6. Write `order_activity` rows.
7. Write `audit_logs` rows.
8. Write `notification_outbox` rows — *intent*, not delivery.
9. Update timestamps.
10. **Commit.**
11. Return a clear result to the UI.

**No provider or queue call happens inside the transaction.** Email, WhatsApp and Redis are all
reachable-or-not at any moment; an order must not fail to process because a message queue is down.
A dispatcher drains the outbox afterwards. This is why `notification_outbox` exists before Phase 8.

## 6. Revision, cancellation, completion

- **Revision** returns the order to `REVISION` and the affected items to `REVISION`, with a reason.
  Items not under revision keep their status. An admin may also send a single `COMPLETED` item back
  to `REVISION` directly (Phase 7 — see the Item statuses note above), independent of the order.
- **Cancellation** is terminal and requires a reason. Financial consequences (D5, answered
  2026-09-17): a cancelled item earns its worker `workerCost` only if that field is non-zero, which
  the admin sets when cancelling an item an outsourced worker had already started —
  `cancelOrderItemWithAdjustedCost()` requires a note whenever this happens and writes a
  stop-work notification. See `docs/REQUIREMENTS.md` D5 and Phase 7 section for the full mechanism.
- **Completion** is terminal at the order level. Revenue recognition (D4, answered 2026-09-17): on
  **delivery**, not completion — `Order.deliveredAt`, stamped on every `→ DELIVERED` transition. A
  later `DELIVERED → COMPLETED` or `DELIVERED → REVISION` move does not change when revenue was
  first recognised. See `docs/REQUIREMENTS.md` D4.

## 7. Links

Multiple links per item, in `order_item_links` — **a table, not a notes field**, because §27
requires finding an order by a URL inside an item.

| Column | Purpose |
| --- | --- |
| `url` | exactly what the user typed, preserved verbatim |
| `normalized_url` | matching key |
| `domain` | domain filter (B-tree) |
| `path` | path-fragment matching |
| `label` | "Reference", "Delivery", "Repository" |

**Normalization** lowercases the scheme and host, drops a default port (`:80`/`:443`) and a single
trailing slash. It **preserves path case and the query string** — both are frequently meaningful, and
destroying them would break the search this table exists for.

Matching modes: full URL, substring, domain, path fragment. Substring and path matching use a
`pg_trgm` GIN index on `normalized_url`.

**The server never fetches a user-supplied URL.**

## 8. Search and filtering

All server-side, in PostgreSQL. Never "fetch everything and filter in JavaScript".

Searchable (§26): order id and number, customer name, worker name, service, category, contact email
and phone, external reference, item description, **item links**, notes. (Buyer name was searchable
too, until Buyer was removed entirely, post-Phase-10.)

Filters (§28): status, customer, worker, service, category, source, deadline, order date, created
date, assigned/unassigned, overdue, due today, due this week, has links, link/domain, payment status,
amount range, free text. (A Buyer filter existed until the same removal.)

**Combined item-level predicates match the same item.** `service = UX Design AND worker = Ahmed`
returns orders having *one item* satisfying both — implemented as a single correlated `EXISTS`, not
as independent joins that would match two different items. This is a real semantic choice; it is
recorded here so it is not changed by accident.

State lives in the URL (§30), validated with Zod. Page size is bounded server-side (default 25, max
100). Sorting always ends with `id` so pages are deterministic. Search inputs are debounced 300 ms.

Pagination is offset-based for operator list pages and keyset-based for exports.

## 9. Files, notes, activity

- **Files**: bytes in Supabase Storage, metadata in PostgreSQL. Upload size and MIME type validated;
  retrieval authorized and served through a short-lived signed URL. Attachable at order or item
  level. **Not built** — no Storage bucket is configured (docs/ARCHITECTURE.md §12 point 12). Until
  it is, `orders.files.upload` is exercised through Order Item Links (§7) instead: a worker holding
  it may add (never remove) a link on an item they are assigned to, as the interim way to hand off a
  deliverable — see `addOrderItemLink` in `src/lib/orders/service.ts`.
- **Notes**: internal, searchable, distinct from activity.
- **Activity**: the operational feed on an order. Distinct again from `audit_logs`, which is the
  security record. Three different things; do not merge them.

## 10. Permissions

| Action | Permission |
| --- | --- |
| See orders | `orders.view` (+ `orders.view.all` for every order, else assigned only) |
| Create / edit / delete | `orders.create` / `orders.edit` / `orders.delete` |
| Assign a worker | `orders.assign` |
| Process | `orders.process` |
| Change status | `orders.change_status` |
| Add a note | `orders.comment` |
| View files / add a link to your own item | `orders.files.view` / `orders.files.upload` |
| Add or remove a link on any item | `orders.edit` |
| View activity | `orders.activity.view` |
| Export | `orders.export` |

A worker without `orders.view.all` sees only orders containing an item assigned to them, enforced in
the query, not in the UI.

## 11. Worker Dashboard, Actions, Profile (Phase 5)

Specification Sections 43–45. See `src/lib/workers/queries.ts` for the item-level query shape shared
by both surfaces below.

- **Dashboard** (`/dashboard`, "Your work"): shown to anyone holding `orders.view`, not only a
  Worker-role user — an Admin can be assigned items too. Item-level counts (new / active / due
  today / overdue), an attention list capped at 8 rows (soonest deadline first, nulls last), and the
  5 most recently completed items.
- **Actions**: "Start Work" and "Mark work complete" are the existing item status transitions
  (`WORKER_ITEM_TRANSITIONS` in `state-machine.ts`) — no new code, just spec-mapped labels. "Add
  Note" is `orders.comment`. "Upload Files" is Order Item Links, per §9 above. "Request Revision" is
  deliberately **not** a worker-triggerable status transition — `REVISION` stays reviewer/admin-only
  (`WORKER_ITEM_TRANSITIONS` excludes it), a decision already made in Phase 4 and left standing; a
  worker who needs a revision says so via a note instead.
- **Profile** (`/workers/[id]`, `workers.view` for your own, `workers.view.all` for anyone's, and
  `/workers` roster): name, roles, categories/services actually worked on (distinct
  `OrderItem.categoryId` for that worker), active/pending/completed work (the same query as the
  dashboard), and this worker's own `OrderActivity` rows. Performance, daily statistics and payments
  are named in the specification but have no real data source yet (Phases 6/7) — the page says so
  rather than showing a fabricated number.
