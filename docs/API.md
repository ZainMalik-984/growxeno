# Application interfaces

Every server interface that exists **today**. This document tracks implementation; when an interface
changes, this file changes with it — and a unit test (`tests/unit/api-doc.test.ts`) fails if a Server
Action exists that is not listed here.

The application exposes **no general-purpose REST or GraphQL API**. Data leaves the server in exactly
three ways: server-rendered pages, **Server Actions** (every mutation, plus a few reads for pickers),
and **three Route Handlers** (below). The Supabase-generated APIs (PostgREST, GraphQL, Storage,
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
| `/search?q=` | GET | any signed-in, active user; **each result category is filtered by the permission that governs viewing it** (`orders.view` with its assigned-only scope, `customers.view`, `workers.view.all`, `services.view`, `categories.view`) | JSON `{ results }`, at most 5 hits per category, `Cache-Control: private, no-store`. Term must be 2–80 characters |
| `/daily-stats/export` | GET | `daily_stats.export`, scoped like the list (own rows unless `daily_stats.view.all`) | CSV |
| `/auth/callback` | GET | anyone holding an emailed one-time link | redirect only — verifies the token, then redirects to a same-site path (`safeRedirectPath` rejects `//host`, `/\host`, control characters). Returns no data |

An anonymous request to any of them is redirected to `/login` by the proxy and refused again by the
handler itself.

---

## Server Actions

71 actions across 11 files. "Requires" is the permission key checked before any data is touched.
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
| `assignRoleAction` | `users.edit` |
| `removeRoleAction` | `users.edit` |
| `setDirectPermissionAction` | `users.edit` |
| `clearDirectPermissionAction` | `users.edit` |
| `setRolePermissionAction` | `roles.edit` |
| `setUserActiveAction` | `users.edit` |
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
| `deleteCategoryAction` | `categories.delete` |

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
| `changeOrderStatusAction` | `orders.change_status` |
| `processOrderAction` | `orders.process` |
| `addOrderItemAction` | `orders.create` |
| `updateOrderItemAction` | `orders.edit` |
| `removeOrderItemAction` | `orders.edit` |
| `assignOrderItemWorkerAction` | `orders.assign` |
| `changeOrderItemStatusAction` | `orders.change_status` |
| `cancelOrderItemWithAdjustedCostAction` | `orders.change_status` |
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
| `createOutsourcedWorkerAction` | `workers.create` |
| `updateOutsourcedWorkerAction` | `workers.edit` |
| `setOutsourcedWorkerActiveAction` | `workers.edit` |

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
| `setOrderRefundedAction` | `finance.revenue.manage` |

`createBuyerPaymentAction`/`updateBuyerPaymentAction`/`deleteBuyerPaymentAction` were removed with
Buyer, post-Phase-10 (2026-09-28). `setOrderRefundedAction` moved off `finance.buyer_payments.manage`
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
