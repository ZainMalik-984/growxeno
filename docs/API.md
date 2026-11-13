# Application interfaces

Every server interface that exists **today**. This document tracks implementation; when an interface
changes, this file changes with it — and a unit test (`tests/unit/api-doc.test.ts`) fails if a Server
Action exists that is not listed here.

The application exposes **no general-purpose REST or GraphQL API**. Data leaves the server in exactly
three ways: server-rendered pages, **Server Actions** (every mutation, plus a few reads for pickers),
and **five Route Handlers** (below). The Supabase-generated APIs (PostgREST, GraphQL, Storage,
Realtime) are closed to the browser key by RLS and are audited by `pnpm security:audit` — see
`docs/SECURITY.md`.

**Common behaviour for every Server Action**

1. Input is parsed with Zod. A parse failure returns `{ ok: false, error: "Invalid request." }` —
   deliberately terse, so the shape of the schema is not a probing tool.
2. Authorization uses `authorizeAction(key)` (or `authorizeAuthenticatedAction()` for an action that is
   self-scoped by construction), which resolves identity from the **verified Supabase session**. A
   submitted user id is never trusted.
3. The service runs the change, its guards and its audit row in **one transaction**.
4. Affected paths are revalidated.

| Result | Meaning |
| --- | --- |
| `{ ok: true, message }` | Applied. `message` is user-facing. |
| `{ ok: false, error }` | Refused. `error` is user-facing and non-revealing. |

---

## Route Handlers

| Route | Method | Who may call it | Returns |
| --- | --- | --- | --- |
| `/search?q=` | GET | any signed-in, active user; **each result category is filtered by the permission that governs viewing it** (`orders.view` with its assigned-only scope, `customers.view`, `employees.view.all`, `outsourced_workers.view`, `services.view`, `categories.view`) | JSON `{ results }`, at most 5 hits per category, `Cache-Control: private, no-store`. Term must be 2–80 characters |
| `/daily-stats/export` | GET | `daily_stats.export`, scoped like the list (own rows unless `daily_stats.view.all`) | CSV |
| `/api/cron/youtube-stats` | GET | the scheduler only: `Authorization: Bearer $CRON_SECRET` (compared in constant time; refused when `CRON_SECRET` is unset). Public to the proxy, so a cron job without a session reaches it | JSON `{ checked, failed, skipped? }` — refreshes YouTube stats on items older than the interval in Settings (2026-11-10) |
| `/api/item-updates/[updateId]/[index]` | GET | a signed-in user who can see the order item the update was posted on (`orders.view.all`, or the item's own worker) | the screenshot (WebP) from the private `item-updates` bucket, `Cache-Control: private`. 404 when it doesn't exist **or** the viewer may not see it, so it never confirms an image exists (2026-11-11) |
| `/auth/callback` | GET | anyone holding an emailed one-time link | redirect only — verifies the token, then redirects to a same-site path (`safeRedirectPath` rejects `//host`, `/\host`, control characters). Returns no data |

An anonymous request to any of them (except the cron route, which checks its own secret) is redirected
to `/login` by the proxy and refused again by the handler itself.

---

## Server Actions

93 actions across 15 files. "Requires" is the permission key checked before any data is touched.
A key ending `.all` widens *which records*, not *whether* — see `docs/PERMISSIONS.md` §3.

### Authentication — `src/lib/auth/actions.ts`

| Action | Requires |
| --- | --- |
| `signIn` | public by nature (login flow) |
| `signOut` | public by nature (login flow) |
| `requestPasswordResetAction` | public by nature (login flow) |
| `updatePasswordAction` | a valid session from the emailed link |

### Access control (users, roles, permissions) — `src/lib/access/actions.ts`

| Action | Requires |
| --- | --- |
| `assignRoleAction` | `users.edit` (only a role whose permissions the actor already holds, 2026-11-04) |
| `removeRoleAction` | `users.edit` |
| `setDirectPermissionAction` | `users.edit` |
| `clearDirectPermissionAction` | `users.edit` |
| `setRolePermissionAction` | `roles.edit` |
| `setUserActiveAction` | `users.edit` |
| `updateEmployeeProfileAction` | `users.edit` — name, display name, job title, phone, WhatsApp, roles, active status and commission % in one save; not your own roles/status/commission; can only give a role whose permissions you hold; lockout-guarded. Email is read-only |
| `createRoleAction` | `roles.create` |
| `updateRoleAction` | `roles.edit` |
| `duplicateRoleAction` | `roles.create` |
| `deleteRoleAction` | `roles.delete` |
| `createUserAction` | `users.create` |

Buyer's actions (`createBuyerAction`, `updateBuyerAction`, `setBuyerActiveAction`,
`deleteBuyerAction`, `addBuyerContactAction`, `updateBuyerContactAction`,
`removeBuyerContactAction`, `setBuyerServicePriceAction`, `clearBuyerServicePriceAction`) were
removed entirely along with `src/lib/buyers/*`, post-Phase-10 (2026-09-28, owner-directed) — see
`docs/DATABASE.md`'s "Buyer — REMOVED entirely" note.

### Customers — `src/lib/customers/actions.ts`

| Action | Requires |
| --- | --- |
| `createCustomerAction` | `customers.create` |
| `updateCustomerAction` | `customers.edit` |
| `deleteCustomerAction` | `customers.delete` |
| `searchCustomersAction` | `customers.view` |

### Categories — `src/lib/categories/actions.ts`

| Action | Requires |
| --- | --- |
| `createCategoryAction` | `categories.create` |
| `updateCategoryAction` | `categories.edit` |
| `deleteCategoryAction` | `categories.delete` (also removes its image file) |
| `setCategoryImageAction` | `categories.edit` — FormData `categoryId` + `file`; PNG/JPEG/WebP by content, original ≤ 8 MB; compressed to WebP ≤ 800×800 (metadata stripped) and uploaded to Storage bucket `category-images` |
| `removeCategoryImageAction` | `categories.edit` |
| `setCategoryActiveAction` | `categories.edit` — deactivating switches off all its active services (marked `deactivatedByCategory`); reactivating brings back exactly those |

### Services — `src/lib/services/actions.ts`

| Action | Requires |
| --- | --- |
| `createServiceAction` | `services.create` |
| `updateServiceAction` | `services.edit` |
| `setServiceActiveAction` | `services.edit` |
| `deleteServiceAction` | `services.delete` |

### Orders and order items — `src/lib/orders/actions.ts`

| Action | Requires |
| --- | --- |
| `createOrderAction` | `orders.create` |
| `updateOrderAction` | `orders.edit` |
| `changeOrderStatusAction` | `orders.change_status` **and** `orders.view.all` (2026-11-03: workers hold `orders.change_status` only for their own items) |
| `addOrderItemAction` | `orders.create` |
| `updateOrderItemAction` | `orders.edit` (never changes the item deadline) |
| `setOrderItemDeadlineAction` | `orders.edit` — sets an item's worker deadline by hand, or `deadline: null` to follow the order again |
| `removeOrderItemAction` | `orders.edit` |
| `assignOrderItemWorkerAction` | `orders.assign` — when a worker is newly set, also emails them the task (Resend) per their "Send new tasks by" setting and returns `delivery` (email result + a prefilled `wa.me` link for the admin to send) |
| `getAssignmentMessageAction` | `orders.assign` — "Message worker": the prefilled WhatsApp link again; `resendEmail: true` sends the email once more (logged in `message_logs`) |
| `changeOrderItemStatusAction` | `orders.change_status`; marking done reads YouTube first, and a worker can mark a YouTube subscribers/views/likes/comments item done only once the count reaches the target |
| `acceptItemDeliveryAction` | `orders.change_status` + `orders.view.all` — accepts a done item's delivery, which puts its pay in the worker's balance; notifies the worker |
| `updateOrderItemProgressAction` | `orders.change_status` — narrowed further in the service to the assigned worker (their own item only) or `orders.view.all` |
| `cancelOrderItemWithAdjustedCostAction` | `orders.change_status` |
| `rejectTaskAction` | `orders.change_status`, then only the item's assigned worker, and only before accepting: unassigns the task (no worker, no cost), notifies the team with the optional reason (2026-11-12) |
| `reassignRemainderAction` | `orders.assign` and `orders.create` — a worker said they can't continue (open "WITHDRAW" request): in one transaction marks their item completed with its target cut to what was delivered (cancelled if nothing was), paid for that part, creates a new item with the same service, link, links and deadline starting where the old one stopped, assigns it to another active worker, closes the request and notifies everyone on the order; then emails / prepares WhatsApp for the new worker (2026-11-11) |
| `addOrderItemLinkAction` | `orders.edit`, `orders.files.upload` |
| `removeOrderItemLinkAction` | `orders.edit` |
| `addOrderNoteAction` | `orders.comment` |

### Fiverr accounts and gigs — `src/lib/fiverr-accounts/actions.ts`

| Action | Requires |
| --- | --- |
| `createFiverrAccountAction` | `fiverr_accounts.manage` |
| `updateFiverrAccountAction` | `fiverr_accounts.manage` |
| `setFiverrAccountActiveAction` | `fiverr_accounts.manage` |
| `revealFiverrPaypalPasswordAction` | `fiverr_accounts.credentials.view` — narrower than, and separate from, `fiverr_accounts.view`; every call writes its own audit row |
| `createGigAction` | `fiverr_accounts.manage` |
| `updateGigAction` | `fiverr_accounts.manage` |
| `setGigActiveAction` | `fiverr_accounts.manage` |
| `createGigStatAction` | `fiverr_accounts.manage` |
| `updateGigStatAction` | `fiverr_accounts.manage` |

The PayPal password is stored AES-256-GCM-encrypted (`src/lib/crypto/secret-box.ts`, key from
`CREDENTIALS_ENCRYPTION_KEY`) and is never included in a list or detail query — only a derived
`hasPaypalPassword` boolean. Reading the plaintext back requires the separate reveal action above.

### Outsourced workers — `src/lib/outsourced-workers/actions.ts`

| Action | Requires |
| --- | --- |
| `createOutsourcedWorkerAction` | `outsourced_workers.create` |
| `updateOutsourcedWorkerAction` | `outsourced_workers.edit` |
| `setOutsourcedWorkerActiveAction` | `outsourced_workers.edit` |
| `setServiceRateAction` | `outsourced_workers.edit` |
| `clearServiceRateAction` | `outsourced_workers.edit` |
| `inviteOutsourcedWorkerToLoginAction` | `outsourced_workers.edit` — emails the branded invitation through Resend; the profile stays inactive ("Invite pending") until they set a password (2026-11-12) |
| `resendOutsourcedWorkerInviteAction` | `outsourced_workers.edit` — a new invitation link for a worker who hasn't set a password yet (2026-11-12) |

### Daily statistics — `src/lib/daily-stats/actions.ts`

| Action | Requires |
| --- | --- |
| `createDailyStatAction` | `daily_stats.create` |
| `updateDailyStatAction` | `daily_stats.edit` |
| `deleteDailyStatAction` | `daily_stats.delete` |
| `bulkUpsertDailyStatsAction` | `daily_stats.create` |
| `copyPreviousDayAction` | `daily_stats.create` |

### Finance — `src/lib/finance/actions.ts`

| Action | Requires |
| --- | --- |
| `createExpenseCategoryAction` | `finance.expenses.create` |
| `setExpenseCategoryActiveAction` | `finance.expenses.edit` |
| `createExpenseAction` | `finance.expenses.create` |
| `updateExpenseAction` | `finance.expenses.edit` |
| `createWorkerPaymentAction` | `finance.worker_payments.manage` |
| `updateWorkerPaymentAction` | `finance.worker_payments.manage` |
| `deleteWorkerPaymentAction` | `finance.worker_payments.manage` |

`createBuyerPaymentAction`/`updateBuyerPaymentAction`/`deleteBuyerPaymentAction` were removed with
Buyer, post-Phase-10 (2026-09-28). `setOrderRefundedAction` (removed 2026-11-03: refunds are now the "Refunded / Cancelled" order status) had moved off `finance.buyer_payments.manage`
onto the new `finance.revenue.manage` (docs/PERMISSIONS.md) at the same time.

### Notifications, preferences and templates — `src/lib/notifications/actions.ts`

| Action | Requires |
| --- | --- |
| `markNotificationReadAction` | signed-in user only (self-scoped) |
| `markAllNotificationsReadAction` | signed-in user only (self-scoped) |
| `setNotificationPreferenceAction` | signed-in user only (self-scoped) |
| `createTemplateAction` | `templates.manage` |
| `updateTemplateAction` | `templates.manage` |
| `setTemplateActiveAction` | `templates.manage` |
| `deleteTemplateAction` | `templates.manage` |

### Application settings — `src/lib/settings/actions.ts`

| Action | Requires |
| --- | --- |
| `saveWorkerDeadlineSettingsAction` | `settings.edit` — saves the worker-deadline gap and rules, then recalculates the automatic deadlines of open orders' items |
| `saveFiverrFeeSettingsAction` | `settings.edit` — the % Fiverr keeps from each Fiverr order, used for employee commission |
| `saveYoutubeStatsSettingsAction` | `settings.edit` — turns the automatic YouTube stats refresh on/off and sets its interval (1–168 hours) |
| `saveSiteContactAction` | `settings.edit` — email, phone and WhatsApp shown on the public home page; regenerates `/` |

### YouTube stats — `src/lib/youtube/actions.ts`

Reads public stats from the YouTube Data API v3 (`YOUTUBE_API_KEY`). Only the channel/video id parsed
from the link is sent to Google; the link itself is never fetched by the server.

| Action | Requires |
| --- | --- |
| `lookupYoutubeLinkAction` | signed in, plus `orders.create` or `orders.edit` — previews a link while an item is filled in (title, channel/video id, counts, Studio link). Saves nothing |
| `refreshOrderItemStatsAction` | `orders.view`, narrowed in the service to items the actor can see (`orders.view.all`, or their own item). Saves a reading to the item's history; a second press within 30 s reuses the last reading |

### Website inquiries — `src/lib/inquiries/actions.ts`

| Action | Requires |
| --- | --- |
| `submitInquiryAction` | **public, no sign-in** — the home page contact form. Validated (`inquirySchema`), honeypot field, at most 3 per visitor per 10 minutes (keyed hash of the IP) |
| `setInquiryStatusAction` | `inquiries.manage` — New / Contacted / Closed |

### Order item updates — `src/lib/order-updates/actions.ts`

A chat-style thread on each order item (2026-11-11): text, an optional new count, and up to four
screenshots, stored in the private `item-updates` Storage bucket and served by `GET /api/item-updates/[updateId]/[index]` after the same access check.

| Action | Requires |
| --- | --- |
| `getItemUpdatesAction` | `orders.view`, narrowed in the service to items the actor can see (`orders.view.all`, or their own item). Returns the thread; image addresses point at `/api/item-updates/…` |
| `postItemUpdateAction` | `orders.view`, then per item: the team (`orders.view.all`) may post and set the count on any item; the assigned worker (with `orders.change_status`) may post on their own item unless cancelled, and set the count once accepted. FormData; screenshots checked by their bytes, compressed to WebP, metadata stripped. With `answersRequestId` (team only, needs text or a screenshot) it answers a screenshot request and closes it; a request already answered is refused |
| `requestScreenshotsAction` | `orders.view`, then only the item's assigned worker (with `orders.change_status`, item not cancelled). Optional message; one open request per item. Notifies the team (2026-11-11) |
| `requestWithdrawAction` | `orders.view`, then only the item's assigned worker (with `orders.change_status`) on a pending, processing or refill item. Optional reason; one open request per item; nothing on the item changes until the team acts. Notifies the team (2026-11-11) |
| `keepWithWorkerAction` | `orders.assign` — closes a "can't continue" request without changes (the worker carries on) and tells them |

---

## Server-side helpers

`src/lib/auth/authorize.ts` — the only authorization entry points.

| Function | Context | On failure |
| --- | --- | --- |
| `requireActor()` | Server Component | redirect `/login`, or `/account-inactive` |
| `requirePermission(key)` | Server Component | redirect `/forbidden?permission=…` |
| `requireAllPermissions(keys)` | Server Component | redirect to the first missing key |
| `requireScope(key)` | Server Component | as above; returns `ALL` or `ASSIGNED` |
| `authorizeAction(key)` | Action / Route Handler | `{ ok: false, reason, message }` |
| `authorizeAuthenticatedAction()` | Self-scoped action only | as above — signed-in and active, no permission key; the action must scope every write to `actor.user.id` |

`src/lib/auth/session.ts` — `getCurrentActor()`, memoised per request with React `cache()`. Uses
`supabase.auth.getUser()`, which revalidates the token; **not** `getSession()`, which trusts the cookie.
The identity is matched to a profile by the Supabase user id, never by email.

**What a page may send to the browser.** `orderVisibility()` / `redactOrderDetail()`
(`src/lib/orders/visibility.ts`) remove, on the server, anything the actor may not see — other workers'
items, prices, costs and the customer — *before* it reaches a client component. Hiding a value in the
UI is not enough: it would still be in the page payload.

---

## Data access

Every domain has a `queries.ts` of read functions. They perform **no** authorization: the caller
checks first. Every one selects explicit columns, and lists are paginated or capped
(`docs/ARCHITECTURE.md` §9). Reports use database aggregates only (`docs/ARCHITECTURE.md` §12, point 25).

---

## Request proxy — `src/proxy.ts`

Next.js 16 renamed `middleware.ts` to `proxy.ts`.

Responsibilities: refresh the Supabase session cookie (written `HttpOnly`, `SameSite=Lax`, and
`Secure` in production), and redirect obviously-unauthenticated visitors to `/login`.

**It is not an authorization boundary.** A Server Action is a POST to its page route, and a matcher
change can silently remove proxy coverage, so every page and action enforces its own permission.

---

## Not built

| Interface | Why |
| --- | --- |
| Order file upload and signed-URL issuance | No Supabase Storage bucket exists yet |
| Email / WhatsApp compose and send; the Meta WhatsApp **webhook** | No queue or provider is configured. The webhook, when built, needs signature verification (`WHATSAPP_APP_SECRET`) and replay protection |
| Report exports | Declined by the owner |
