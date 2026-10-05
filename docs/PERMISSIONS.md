# Permissions

How authorization works, end to end.

Status: the resolution engine, the catalog, scopes, server enforcement and the effective-access view
are **implemented**, and RLS is **applied on all 30 tables** and verified against the live project.
Everything about data exposure — what was found and how to re-check — is in `docs/SECURITY.md`.

---

## 1. The model

```
User ──< user_roles >── Role ──< role_permissions >── Permission
  │                                                        │
  └──────────────< user_permissions (ALLOW|DENY) >─────────┘
```

- A **Role** is an editable collection of permissions. Nothing about a role is hard-coded.
- A **User** may hold any number of roles.
- A **direct user permission** attaches one permission to one user with an explicit effect,
  overriding their roles.

Tables are defined in `prisma/schema/identity.prisma` and documented in `docs/DATABASE.md`.

---

## 2. Precedence

Implemented once, in `src/lib/permissions/resolve.ts`. For a user `u` and key `k`:

| Order | Condition | Result | Reported source |
| --- | --- | --- | --- |
| 0 | `u.isActive = false`, or no application profile | **deny everything** | `INACTIVE` |
| 1 | `user_permissions(u, k).effect = DENY` | **deny** | `DIRECT_DENY` |
| 2 | `user_permissions(u, k).effect = ALLOW` | **allow** | `DIRECT_ALLOW` |
| 3 | any role of `u` grants `k` | **allow** | `ROLE` |
| 4 | none of the above | **deny** | `NONE` |

Rule 0 is an addition to specification Section 11. A deactivated user keeps their `user_roles` rows,
so without it deactivation would not revoke anything. Deactivation must fail closed.

**Super Admin is not special.** It is a seeded role that has been granted every permission, and it
is resolved by rule 3 exactly like a custom role. A unit test greps the authorization modules and
fails if any of them contains a role-name string literal, so this cannot regress quietly.

### Worked example (specification Section 12)

Ahmed holds *Senior Worker* and *Reviewer*, plus two overrides:

| Permission | Effective | Source |
| --- | --- | --- |
| `orders.view` | allow | ROLE — via Senior Worker, Reviewer |
| `orders.edit` | allow | ROLE — via Senior Worker |
| `orders.assign` | allow | DIRECT ALLOW |
| `finance.view` | **deny** | DIRECT DENY — beats the Reviewer role's grant |
| `daily_stats.view` | allow | DIRECT ALLOW |
| `users.delete` | deny | NONE |

This table is exactly what `/settings/users/[id]` renders, including the "via" role names.

---

## 3. Scopes — a separate axis

A permission answers *may this person do this?*. It does **not** answer *to which records?*.

Record visibility is a second decision, expressed with a companion key:

| Key | Meaning |
| --- | --- |
| `orders.view` | the actor's own / assigned orders |
| `orders.view.all` | every order |

`resolveScope(permissions, "orders.view")` returns `NONE`, `ASSIGNED` or `ALL`. Query functions
translate that into a `WHERE` clause; a scope is never accepted from the client.

Scope keys currently in the catalog: `orders.view.all`, `daily_stats.view.all`,
`workers.stats.view.all`, `workers.view.all` (added Phase 5 — an internal worker's own profile at
`/workers/[id]` is visible with plain `workers.view`; the `/workers` roster and every other
worker's profile need `.all`). The seeded **Worker** role holds `orders.view` and deliberately
**not** `orders.view.all` — that is the difference between "can open the orders page" and "can read
every order in the business".

When adding a module, follow this convention rather than inventing a second mechanism.

---

## 4. Where authorization is enforced

Navigation filtering is **UX only**. Hiding a sidebar link changes nothing about what a crafted
request reaches. Each of these enforces independently:

| Surface | Helper | Failure behaviour |
| --- | --- | --- |
| Server Component | `requirePermission(key)` | redirect to `/login` or `/forbidden?permission=…` |
| Server Component (several keys) | `requireAllPermissions([...])` | as above |
| Server Component needing a scope | `requireScope(key)` | as above, plus returns `ALL`/`ASSIGNED` |
| Server Action, Route Handler | `authorizeAction(key)` | returns `{ok:false, reason, message}` |
| Storage access, exports, jobs | `authorizeAction(key)` | same |
| Server Action, self-scoped only (Phase 8) | `authorizeAuthenticatedAction()` | returns `{ok:false, reason, message}` — no permission key, just signed-in and active; the action itself must scope every write to `actor.user.id` and never accept a target user id |

`getCurrentActor()` resolves identity from the **verified Supabase session** (`auth.getUser()`,
which revalidates the token — not `getSession()`, which trusts the cookie). A submitted user id or
a hidden form field is never an input to authorization.

Next.js warns that a Server Action is a POST to its page route, and that a proxy matcher change can
silently remove coverage. That is exactly why `src/proxy.ts` is treated as session hygiene and
every action re-checks for itself.

---

## 5. Row Level Security

**Prisma does not inherit the user's JWT.** It connects as the database owner, which is not subject
to RLS. Nothing a request contains can change that.

| Path | Enforced by |
| --- | --- |
| Next.js server → Prisma → PostgreSQL | **Server authorization only.** RLS does not apply. |
| Browser → Supabase client (publishable key) → PostgREST | **RLS.** |
| Supabase Storage | Storage policies + server-issued signed URLs (Phase 4) |
| Server → Supabase Admin API (secret key) | Bypasses everything; server-only |

Migration `20260910120100_enable_rls` enables RLS on all seven Phase 1 tables **with no permissive
policies**, and revokes the `anon`/`authenticated` grants. The publishable key therefore reads
nothing at all. The application never queries business tables from the browser, so RLS here is
defense-in-depth, not the primary control.

It deliberately does **not** use `FORCE ROW LEVEL SECURITY`, which would apply RLS to the owner and
lock the application out of its own database.

**Both halves are tested** (Phase 10): `pnpm security:audit` checks the anon-key side against the live
project (RLS on every table, no policies or grants, no callable functions, nothing readable through
PostgREST, GraphQL or Storage), and `tests/e2e/worker-boundaries.spec.ts` plus `tests/unit/api-doc.test.ts`
check the server-authorization side.

A dedicated least-privilege runtime role, separate from the migration role, is **proposed** and
requires creating database roles in the Supabase project.

---

## 6. Caching and invalidation

Permissions are resolved **once per request**, memoised with React `cache()` keyed by the
authenticated user. There is **no cross-request cache**: a stale permission cache is a security
defect, and one indexed query per request is cheap.

Consequences, stated plainly:

- A role change takes effect on the user's **next request**.
- Deactivation takes effect on the next request, and rule 0 denies everything from that point.
- There is nothing to invalidate, so there is no invalidation bug to have.

Adding a cross-request cache later requires an explicit invalidation path on role change, role
permission change, direct override change, and deactivation.

---

## 7. Safety rules

Both are enforced in `src/lib/access/service.ts`, inside the transaction, and both are audited.

**No self-modification of access.** A user cannot change their own roles or their own direct
permissions, and cannot deactivate themselves — even holding `users.edit`. Otherwise "edit users"
silently means "grant yourself anything". Administrators change each other's access.

**No administrative lockout.** Any change that would leave zero *active* users holding `users.edit`,
or zero holding `roles.edit`, is rejected and the transaction rolls back. The check applies full
precedence, so a direct DENY correctly disqualifies a user from counting.

System roles (`is_system = true`) are protected from deletion. Their **permissions remain fully
editable** — the protection is against removing the last administrator, not against configuring the
role.

---

## 8. The catalog

Defined in `src/lib/permissions/catalog.ts`, which is the single source of truth. `pnpm db:seed`
upserts it into the `permissions` table; the seed is idempotent and is the supported way to sync
after adding a key.

`/settings/permissions` shows the catalog and flags **drift** — keys that exist in code but have not
been seeded, which would otherwise be silently ungranted.

78 keys across 15 modules. All keys listed in specification Section 8 that the owner has not directed
removed are present verbatim, and a unit test asserts it — see "Buyer removed" below for what that
exception covers. Nine keys are documented additions:

| Added key | Why |
| --- | --- |
| `orders.view.all` | Scope: separates "open orders" from "see every order" |
| `daily_stats.view.all` | Scope: a worker sees their own statistics |
| `workers.stats.view.all` | Scope: a worker sees their own performance |
| `audit.view` | The cross-entity activity feed in the Overview section. Order-scoped history stays `orders.activity.view` |
| `fiverr_accounts.view` | Not in the specification: the business's own Fiverr seller profiles, added 2026-09-27 so an order can record which profile it came in on |
| `fiverr_accounts.manage` | Create/edit accounts and gigs, and enter daily gig stats |
| `fiverr_accounts.credentials.view` | Deliberately separate from `.view` — reveal a stored PayPal password, not just see that the account exists. Every reveal is audited |
| `finance.revenue.manage` | ADDED post-Phase-10 (2026-09-28), replacing `finance.buyer_payments.manage` for `Order.refunded` once Buyer (and `finance.buyer_payments.*` with it) was removed — see "Buyer removed" below |

**Buyer removed entirely, post-Phase-10 (2026-09-28) — owner-directed, confirmed directly: "Remove
the Buyer category from order and from system."** The whole `buyers` module (`buyers.view`/`create`/
`edit`/`delete`/`pricing.view`/`pricing.manage`/`payments.view`/`payments.manage` — 8 keys, all
verbatim from specification Section 8) is gone, along with `finance.buyer_payments.view`/`.manage`
and `reports.buyers`. A real migration deleted these 11 rows from the live `permissions` table too
(not just the code catalog), which cascade-deleted any role/user grant of them. This is a deliberate
departure from literal Section 8 conformance — `tests/unit/permission-catalog.test.ts`'s "every spec
key exists" check was updated to say so explicitly, rather than silently dropping the assertion.

**Phase 7 (Finance) added zero new keys, at the time.** Every `finance.*` key it used (`finance.view`,
`finance.revenue.view`, `finance.expenses.view`/`create`/`edit`, `finance.profit.view`,
`finance.worker_payments.view`/`manage`, plus the now-removed `finance.buyer_payments.view`/`manage`)
was already present in the catalog since Phase 1, unused until this phase. `Order.refunded` was
originally gated on `finance.buyer_payments.manage` (the closest existing key at the time for "money
owed to/from a buyer"); it now uses the dedicated `finance.revenue.manage` added above.

**Phase 8 (Notifications) also added zero new keys.** `communications.view`, `email.send`,
`whatsapp.send`, `templates.view`/`manage`, `message_logs.view` were all already present in the
catalog since Phase 1, unused until this phase — `email.send`/`whatsapp.send` remain unused in code,
reserved for the compose tools that need a real provider and queue first (docs/NOTIFICATIONS.md §7).
Viewing and managing your OWN in-app notifications and notification preferences needs no permission
key at all — every authenticated, active user may always see and act on their own inbox
(`authorizeAuthenticatedAction()` in `src/lib/auth/authorize.ts`, a new authorization entry point
alongside `requirePermission`/`authorizeAction` for actions that are self-scoped by construction and
never accept a target user id), the same reasoning as Daily Statistics' and Worker Earnings' self-view.

**Phase 9 (Reports, Global search) also added zero new keys, at the time.** `reports.view`/`sales`/
`orders`/`workers`/`customers`/`profit` existed since Phase 1, plus the now-removed `reports.buyers`;
`reports.export` remains unused (no exports were built). A report that shows money additionally
requires the matching finance key (`finance.revenue.view`, `finance.profit.view`,
`finance.worker_payments.view`) — Sales and Profit refuse the page without it, the others hide the
money columns — so a report can never reveal what Finance would not. Global search needs no key of
its own: each result category is gated by the permission that governs viewing it (`orders.view` with
its assigned-only scope, `customers.view`, `workers.view.all` for staff and `workers.view` for
outsourced workers, `services.view`, `categories.view`); a category the actor cannot view is not queried.

**Phase 10 changed what two existing keys mean — no new keys.** (1) `workers.view` is *only* "my own
profile"; the outsourced-worker pages, their search results and their sidebar entry now need
`workers.view.all`, because an outsourced worker's name, phone and notes were readable by every Worker.
(2) `orders.view` (even with `.all`) no longer implies seeing money or parties: `orderVisibility()`
(`src/lib/orders/visibility.ts`) shows item prices to `orders.edit`/`orders.create`/`finance.revenue.view`,
worker costs to `orders.edit`/`finance.worker_payments.view`/`finance.profit.view`, and the customer to
`orders.edit`/`customers.view`. A Worker assigned to one item sees only that item.

### Adding a permission

1. Add the entry to `PERMISSION_CATALOG`.
2. `pnpm db:seed`.
3. Grant it to the roles that need it.
4. Use it: `requirePermission("your.key")`. TypeScript checks the key against the catalog.

---

## 9. Permission matrix — seeded roles

`✓` granted at seed time. Roles are editable afterwards; this is a starting point, not a constraint.

| Module | Super Admin | Admin | Worker |
| --- | :---: | :---: | :---: |
| `orders.view` | ✓ | ✓ | ✓ |
| `orders.view.all` | ✓ | ✓ | — |
| `orders.create` / `edit` / `delete` | ✓ | ✓ | — |
| `orders.assign` / `process` | ✓ | ✓ | — |
| `orders.change_status` | ✓ | ✓ | ✓ |
| `orders.comment` | ✓ | ✓ | ✓ |
| `orders.files.view` / `files.upload` | ✓ | ✓ | ✓ |
| `orders.activity.view` | ✓ | ✓ | ✓ |
| `orders.export` | ✓ | ✓ | — |
| `customers.*` | ✓ | ✓ | — |
| `fiverr_accounts.view` / `manage` / `credentials.view` | ✓ | ✓ | — |
| `workers.view` / `create` / `edit` / `assign` | ✓ | ✓ | — |
| `workers.delete` | ✓ | ✓ | — |
| `workers.stats.view` | ✓ | ✓ | ✓ |
| `workers.stats.view.all` | ✓ | ✓ | — |
| `workers.payments.*` | ✓ | ✓ | — |
| `daily_stats.view` | ✓ | ✓ | ✓ |
| `daily_stats.view.all` | ✓ | ✓ | — |
| `daily_stats.create` / `edit` / `delete` / `export` | ✓ | ✓ | — |
| `services.*`, `categories.*` | ✓ | ✓ | — |
| `finance.*` | ✓ | ✓ | — |
| `reports.*` | ✓ | ✓ | — |
| `communications.*`, `email.send`, `whatsapp.send`, `templates.*`, `message_logs.view` | ✓ | ✓ | — |
| `users.view` / `create` / `edit` | ✓ | ✓ | — |
| `users.delete` | ✓ | — | — |
| `roles.view` | ✓ | ✓ | — |
| `roles.create` / `edit` / `delete` | ✓ | — | — |
| `permissions.view` | ✓ | ✓ | — |
| `settings.view` | ✓ | ✓ | — |
| `settings.edit` | ✓ | — | — |
| `audit.view` | ✓ | ✓ | — |

A Worker therefore sees only: Dashboard, and (once Phase 4 lands) their assigned orders, their own
statistics and their own performance. They have **no** financial access of any kind.

---

## 10. Testing

Covered now (`tests/unit/`, 41 tests passing):

- every precedence rule, including DENY over multiple roles
- DENY winning over a conflicting ALLOW on the same key
- multi-role union and "via which role" reporting
- deactivated users denied despite roles and direct allows
- scope resolution, including a DENY on a `.all` key narrowing an admin
- navigation filtering, empty-section removal, and that every nav permission key exists
- the mechanical "no role-name branch" check

Still to run (needs infrastructure): RLS allow/deny, sign-in, unauthorized record access at the
query level, and the Section 124 end-to-end workflow.
