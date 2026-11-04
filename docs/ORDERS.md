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

> **Superseded 2026-11-03 (owner-directed rework).** The text below this box describes the old statuses
> and is kept for history. Current behaviour (`src/lib/orders/state-machine.ts`):
>
> - **Items:** Pending (no worker, or not yet accepted) → Processing (the worker clicks Accept; no separate
>   Start) → Done (the worker; counts as complete straight away) → Refill (only an admin sends a done item
>   back) → Done again. An admin can cancel any item. Reassigning an unfinished item puts it back to Pending
>   and restarts its "assigned … ago" clock (`OrderItem.assignedAt`).
> - **Orders, calculated from the items** (`deriveOrderStatus`, run after every item change; cancelled items
>   ignored): every item done → Completed; some done → Partially Completed; every item accepted → Processing;
>   every item has a worker → Assigned; otherwise Pending. Nobody sets these by hand.
> - **Orders, set by an admin** (`orders.change_status` + `orders.view.all`): Completed → Delivered
>   (revenue recognized, `deliveredAt`) → Finalized, and Refunded / Cancelled (reason required) from any
>   status. Once set, the order stops following its items.
> - **Process Order (§5) is removed.** The deadline it required is now required before assigning a worker.
>   `orders.process` stays in the permission catalog but no longer gates anything.
> - The separate refund flag/toggle is replaced by the Refunded / Cancelled status.

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

## 12. Progress tracking

Owner-directed, confirmed directly (2026-10-05).

- **Creating a metric item**: the Add Item dialog (`order-items-panel.tsx`) asks for "Starting
  count" (where the metric stands right now) and "how many more" are wanted, not an absolute target.
  The target is computed client-side — `targetCount = starting + additional` — before calling
  `addOrderItemAction`, matching the example given directly: "a video has 1000 views, and customer
  wants 5000 more so i'll enter 1000 as starting count, and 5000 as required, it'll automatically set
  target to 6000." Editing an existing item still sets an absolute target/current directly — the
  starting/required framing only makes sense once, at creation. The entered starting count is ALSO
  snapshotted into `OrderItem.startingCount` (added for this feature), fixed at creation and never
  touched again by an edit or a progress update — see the next point for why.
- **Updating progress**: `updateOrderItemProgressAction` → `updateOrderItemProgress`
  (`src/lib/orders/service.ts`) writes `currentCount` alone — a deliberately narrower sibling of the
  full item edit. Gated by `orders.change_status` and then, in the service, to the item's assigned
  worker (their own item only) or `orders.view.all` — exactly the same authorization shape as
  `changeOrderItemStatus`. Not capped at the target: over-delivery is a real state worth showing
  ("6200 / 6000"), it just can't inflate the order-level aggregate past 100% (next point).  The
  item row on the order detail page (`order-items-panel.tsx`) exposes this as an inline "Update"
  control next to the item's progress line, to whoever may already change that item's status.
- **Orders list aggregate** (`/orders`, `orders-table.tsx`): each row shows a progress bar and
  percentage representing ACTUAL WORK DONE since creation, not the count the item already had
  before any work started — corrected directly after an earlier version got this wrong (2026-10-05):
  "the progress on orders page should not consider the count of item at the time of the order it
  should show the actual work progress." Concretely (`aggregateProgress`,
  `src/lib/orders/progress.ts`), for each metric item: `required = targetCount - startingCount` (how
  many more were actually asked for) and `done = currentCount - startingCount` (how many have
  actually been delivered since), each clamped to `[0, required]`; the order's percentage is the sum
  of `done` over the sum of `required` across every visible metric item. In the worked example
  above, sitting at 1000 (the starting count, no work done yet) against a target of 6000 reads as
  **0%**, not ~17% (1000/6000) — the bar only moves once `currentCount` moves past the 1000
  baseline. An item created before `startingCount` existed treats it as 0, which reproduces the
  simple current/target ratio for that legacy row rather than hiding it. An item whose required
  amount is 0, or an order with no metric items at all, shows no bar. Expanding a row (the dropdown)
  lists each visible item's own absolute numbers ("1600 / 6000") rather than the delta — the raw
  count is still the useful fact at the per-item level; only the order-level aggregate needed the
  delta fix. Redaction runs BEFORE the aggregate is computed (`redactOrderListItems`,
  `src/lib/orders/visibility.ts`, mirroring `redactOrderDetail`) — a restricted Worker's bar and
  dropdown both reflect only their own item(s), never another worker's assignment or progress.

## 13. Assignment and rate-based cost (2026-10-08)

Owner-directed, confirmed directly. Supersedes part of §10/§11 below: assignment is now
**External-Worker-only**.

- **Who can be assigned**: "employees wont be assigned a order item its assigned to
  oursourced(external) only" — an Employee (renamed from "Worker", see `docs/PERMISSIONS.md`) is a
  salaried manager who creates and assigns orders, never themselves the assignee. `OrderItem.workerId`
  (the old internal-assignment path) is deprecated — kept for history, never set by any assignment
  going forward; `outsourcedWorkerId` is the only live path. `OrderItem.assignedById` separately
  records which Employee performed the assignment ("put key assigned_by in order_item") — an
  accountability fact, not a work-execution one.
- **Rate-based cost**: each External Worker has a `ServiceRate` per service — set from
  `/outsourced-workers/[id]`'s "Rates" section (`outsourced_workers.edit`). Assigning them to an Order
  Item (`assignOrderItemWorker`, `src/lib/orders/service.ts`) looks it up and computes
  `OrderItem.workerCost` automatically via the pure `computeAssignmentCost` (`src/lib/orders/rate.ts`,
  unit-tested in `tests/unit/order-rate.test.ts`): for a metric service, `rate × required` (target
  minus starting — the same basis §12 uses, never charging for units the channel already had); for a
  non-metric service, the rate flatly ("it'll be flat rate"). Worked example: "subscriber service by
  Zia charges are 3.5pkr for 1 subscriber... the cost would be 500*3.5=1750." No rate configured:
  cost is left blank, never blocks the assignment.
- **Cost stays a plain, editable value**: "when filled automatically it should still show as input on
  screen with the calculated amount and anyone putting the item there should be able to change the
  amount for it." The assign control on the item row (`order-items-panel.tsx`) combines worker-picker
  and cost input into one editor — picking a worker auto-fills cost (computed client-side with the
  same `computeAssignmentCost`, from rates passed down with the picker list), and the admin can
  overwrite it before saving. This replaced the old split UX (a separate "Assigned to" dropdown plus
  a worker-cost field hidden in the Edit dialog) — cost no longer has any place in Add/Edit Item at
  all, only in assignment.
- **Visibility**: the cost input is gated on `orders.assign` alone, not the broader `showCosts`
  (`visibility.costs`) — an Employee doing the assigning needs to see/set what they just typed,
  independent of whether they hold `finance.worker_payments.view`/`finance.profit.view`/`orders.edit`.
  The read-only cost display elsewhere on the row stays gated by `visibility.costs` as before.

## 14. External Worker login (2026-10-08)

Owner-directed, confirmed directly: "External or outsourced workers should be able to login and have
there own dashboard" — a reversal of the original "login-less" design for `OutsourcedWorker`.

- **Linking, not merging**: `OutsourcedWorker.userId` (nullable, unique) optionally points at a
  `User` row. `OutsourcedWorker` stays the business-fact record (name, rates, contact details);
  `User` stays the login identity; the FK is the only bridge — per "keep the External Workers
  separate from employees," they are never the same row.
- **Onboarding**: `inviteOutsourcedWorkerToLogin` (`src/lib/outsourced-workers/service.ts`) mirrors
  `createUser`'s shape exactly — invite via Supabase Auth first (the person sets their own password
  from the emailed link), then create the `User` row, assign the seeded "External Worker" role, and
  link `OutsourcedWorker.userId`, all in one transaction; the orphaned auth identity is removed if
  the DB step fails. Surfaced as an "Invite to log in" control in a new "Portal access" section on
  `/outsourced-workers/[id]` (`outsourced_workers.edit`), requiring an email on file first.
- **The seeded "External Worker" role** holds only `orders.view`, `orders.change_status`,
  `orders.comment` — no `.all`, no `finance.*`, no `customers.view`, no `fiverr_accounts.*`, no
  `employees.*`. A starting point, widenable later like every other seeded role.
- **Login is the same `/login` page and session handling as everyone else** — no second auth
  system. `Actor.outsourcedWorkerId` (`src/lib/auth/session.ts`) is resolved alongside the existing
  permission grants, in the same `Promise.all` (filtering through the `user` relation by
  `authUserId` compiles to one JOIN, so this adds zero latency on the critical path, only one more
  concurrent query) — `null` for everyone except a linked External Worker.
- **"Is this actor the assignee?" is now answered in exactly one place**: `isAssignedToIdentity`/
  `assignedItemWhere` (`src/lib/orders/assignment.ts`, pure, unit-tested in
  `tests/unit/order-assignment.test.ts`) — checks the deprecated `workerId` path AND the live
  `outsourcedWorkerId` path. Every "assigned to me" check in the codebase (`listOrders`'s scope
  filter, `redactOrderDetail`/`redactOrderListItems`, `changeOrderItemStatus`/
  `cancelOrderItemWithAdjustedCost`/`updateOrderItemProgress`'s worker-only gate, `getMyWorkSummary`,
  global search's order scope, the item panel's own-item check) goes through this helper now,
  instead of a direct `item.workerId === actor.user.id` comparison repeated ad hoc.
- **The Dashboard needed no new code.** Its existing permission-driven conditional rendering already
  produces the right experience: an External Worker's narrow role means most sections hide
  themselves, leaving "Your work" (now resolved via their `outsourcedWorkerId`) as effectively their
  whole dashboard — the same mechanism that already worked for Employees.
- **Verified live** with a throwaway External Worker login
  (`scripts/e2e-external-worker-fixture.ts`): sees only their own order/item on the dashboard, orders
  list and order detail (another item's cost, service name and assignee name all absent), can change
  their own item's status, has no assign control, no management/finance nav, and is forbidden from
  `/finance`, `/employees`, `/settings/users`, `/outsourced-workers`.

## 15. Jira-style board (2026-10-09)

Owner-directed, confirmed directly: "Board should be complete with drag and drop, in the orders page
there should be option to view board or list."

- **`/orders?view=board`** — a List/Board tab pair as plain links (URL state, same pattern as every
  other filter on this page — linkable, shareable, survives a refresh), not a client-side toggle.
- **Columns = the 6 `OrderItemStatus` values; cards = Order Items, not whole orders** — a single
  order can have cards in several columns at once. Data comes from `listBoardItems`
  (`src/lib/orders/queries.ts`), a flat cross-order query capped at `BOARD_ITEM_LIMIT` (300) — "a
  cap, not a page," since the columns themselves are the natural grouping a list view's pagination
  would otherwise provide.
- **Visibility**: an actor with `orders.view.all` sees everything; an External Worker sees only
  their own assigned items (`assignedItemWhere`); an Employee without `.view.all` sees items on
  orders THEY CREATED (`Order.createdById`) — confirmed directly, since Employees are never
  themselves assigned an item (§13). Both folded into one `boardItemWhere` helper
  (`src/lib/orders/assignment.ts`, unit-tested), applied before the query runs, same "redact at the
  source" discipline as everywhere else in this file.
- **Drag-and-drop**: `@dnd-kit/core` (no `@dnd-kit/sortable` — columns don't reorder, only
  cross-column moves happen). Drop legality reuses `canTransitionItem` client-side (optimistic move,
  reverted on server rejection) and calls the exact same `changeOrderItemStatusAction` the list
  view's "Move to" dropdown already uses — no new Server Action. Cancelling an item assigned to an
  External Worker redirects to that order's guided adjusted-cost flow (§6) instead of a bare drag,
  matching the dropdown's identical existing rule.
- **Two real bugs caught during live verification**: a `setState`-in-effect pattern for resyncing
  optimistic state after `router.refresh()` (fixed via React's "adjust state during render"
  pattern), and a genuine axe `nested-interactive` violation — the card's "Order #" link was nested
  inside the draggable region (which carries `role="button"`/`tabIndex` from dnd-kit), an ambiguous
  keyboard/screen-reader activation target. Fixed by making the link a sibling of the draggable
  region, not a child, while keeping both inside one visually-unified card.

## 16. Order creation simplification (2026-10-09)

Owner-directed, confirmed directly: order creation should be "simple and clean no much hurdles."

- **Optional first item, in the same submit** — `/orders/new` now has a "First item (optional)"
  section (service picker, and the same starting-count/required-count fields as §12's Add Item
  dialog when the service is metric-tracked). Leaving the service unselected still creates a bare
  order shell exactly as before — nothing is mandatory, this just collapses the common case (order
  **and** its first item) from "create order → navigate → open a modal → fill it again" into one
  submit. Implemented client-side as `createOrderAction` followed by `addOrderItemAction` when a
  service was chosen; if the item step fails after the order already exists, the order is still
  created and the admin lands on it with a toast explaining the item needs adding manually — a
  partial failure never loses the order itself.
- **The Fiverr-account-required-for-FIVERR-source check is unified into one schema-level rule** —
  `requireFiverrAccountForFiverrSource`, a `superRefine` on the shared `orderInputSchema`
  (`src/lib/orders/actions.ts`), applied at both `createOrderAction` and `updateOrderAction`.
  Previously duplicated as a client-side disabled-submit-button condition (which just left the
  button inertly unclickable with no explanation) plus the service-layer check (kept, as defense in
  depth for any other caller of `createOrder`/`updateOrder`). The client no longer pre-computes this
  at all — submitting without an account now returns the same clear, friendly error every other
  validation failure on this form already shows.
- **Deadline strings are now format-validated** (`deadlineSchema`, a `.refine()` using
  `Date.parse`, applied to both the order-level and item-level deadline fields) — previously a
  malformed string went straight through to `new Date(...)` in the service layer, silently becoming
  `Invalid Date` instead of a caught, friendly validation error.
- **Verified live**: submitting a FIVERR order with no account shows the exact error message without
  navigating away; creating an order with a first item (metric service, starting + required counts)
  in one submit lands directly on the order detail page already showing the item with its correctly
  computed target — no separate "Add item" step needed.

## 17. Performance pass (2026-10-13)

Owner-directed, confirmed directly: "every API is optimized for speed and resources as its taking
very long to update anything." Honest account of what this did and did not fix — this project's
`docs/AI_CONTEXT.md` already notes this Supabase region's round-trip latency is variable (tens of ms
to multiple seconds), and nothing below changes that per-round-trip cost. The only lever available
is **how many** round trips a mutation makes.

- **The planned mechanical `Promise.all` sweep over `logActivity`/`recordAudit`/`emitNotificationEvent`
  was tried, measured, and abandoned** — it does not help, and the measurement is worth recording so
  nobody re-attempts it expecting a win. Every one of those calls runs on the SAME interactive
  transaction's connection (Prisma's driver adapter binds one `pg.PoolClient` for the life of
  `runTransaction`/`$transaction`), and Postgres processes queries on one connection strictly one at
  a time — `Promise.all` does not pipeline them. A warmed-up, interleaved benchmark against this
  project's real database (`sequential` vs `Promise.all` for 2 and 3 independent writes on the same
  `tx`) showed no consistent difference; an earlier non-interleaved run of the same comparison showed
  an apparent ~40% win for `Promise.all`, which turned out to be cold-connection bias from running
  the sequential case first, not a real effect. `Promise.all` **does** still genuinely help when
  queries run on the bare `prisma` client OUTSIDE a transaction — different queries there can land on
  different pooled connections — which is exactly how `getCurrentActor()` (`src/lib/auth/session.ts`)
  already combines its profile/permissions/outsourced-worker lookups, unchanged by this phase.
- **The real lever is fewer round trips, not reordered ones** — found and fixed three places that
  looped a DB write once per item instead of batching:
  - `emitNotificationEvent` (`src/lib/notifications/service.ts`) used to do one preference
    `findUnique` plus a conditional `create` per recipient. Rebuilt around a shared
    `emitNotificationEventsBatch` that does one `findMany` for every recipient's preference override
    and one `createMany` for the resulting `Notification` rows — 3 round trips for the whole call no
    matter how many recipients. A new `emitNotificationEvents` (plural) lets a caller batch several
    *distinct* events (not just one event's recipients) into that same 3 round trips, used by
    `processOrder` below.
  - `processOrder` (`src/lib/orders/service.ts`) used to `update` each activated item's status one
    at a time, then emit one `ORDER_STARTED` notification per item one at a time. Now one
    `orderItem.updateMany` for all activated items, and one `emitNotificationEvents` call carrying
    `ORDER_PROCESSED` plus every item's `ORDER_STARTED` entry together.
  - `createUser` (`src/lib/access/service.ts`) used to `create` each role grant in a loop; now one
    `userRole.createMany`.
  - `bulkUpsertDailyStats` and `copyPreviousDay` (`src/lib/daily-stats/service.ts`) used to `upsert`/
    `create` one row per entry. Prisma has no batch upsert, so bulk entry now does one `findMany` to
    split entries into "needs create" (one `createMany`) vs "needs update" (still one call each,
    since each row's new values differ — `updateMany` can't express that); copy-previous-day's rows
    are always fresh inserts, so that one collapsed to a single `createMany` outright.
- **`connection_limit` is now explicit** (`max: 10` on the `pg.Pool` config in
  `src/lib/db/prisma.ts`) — the same value node-postgres already defaulted to, but written down as a
  deliberate choice instead of relying on an undocumented library default (`DATABASE_URL` already
  points at Supabase's Supavisor pooler in transaction mode, which is the thing actually bounding
  how many real Postgres backends get used).
- **`getCurrentActor()`'s `outsourcedWorkerId` resolution** (added in §14) was confirmed to already
  be folded into its existing single `Promise.all` — no regression, no change needed.
- **Verified**: a rollback-only benchmark script against this project's real database (not committed
  — its conclusion is recorded above instead) settled the `Promise.all` question empirically rather
  than by assumption. The `userRole.createMany` change was checked the same way (a throwaway user and
  role grant inside a transaction that is rolled back, never committed) to confirm it grants exactly
  the requested roles. Live against the real app: the full order lifecycle E2E suite (processOrder's
  batched update+notification path), the daily-stats bulk-entry and copy-previous-day E2E test (both
  the create and update halves of the new split), and the 10/10 worker-boundaries suite, all passing
  with no regressions.

## 18. Worker deadlines (2026-11-03)

`OrderItem.deadline` is the assigned worker's deadline. Unless someone sets it by hand on the item
(`deadlineOverridden = true`), it is the order deadline minus a gap from Settings → System:

- the gap is chosen by lead time (order creation → order deadline): the rule "at least N days → X days early"
  with the largest N that fits, otherwise the default;
- the gap is never more than half the lead time;
- it is rewritten when the order deadline changes (`updateOrder`) and, for open orders, when the settings are
  saved (`syncWorkerDeadlines`, one bulk UPDATE).

Workers never receive the order's own deadline, source, reference, notes or creator (`redactOrderDetail`,
`orderDetails` flag). The rule lives in `src/lib/settings/worker-deadline.ts` (pure, unit-tested).
