# Notifications

> **Status: PARTIALLY IMPLEMENTED (Phase 8, 2026-09-18).**
> In-app notifications, preferences, templates, and message log storage are real and working. Actual
> email/WhatsApp dispatch is NOT — no Redis instance exists in this project (a local Homebrew install
> was attempted and aborted after it started compiling LLVM/Rust from source, since no bottles exist
> for this macOS version; the owner chose to defer the queue rather than spend 30-90+ minutes
> compiling a toolchain or wait on a hosted Redis account). See §7 for the full account and what
> changes the moment Redis exists.
>
> `notification_outbox` (specification Section 21 addition) landed in Phase 4, before this phase,
> because Process Order needed a durable place to record notification intent inside its own
> transaction. It is still written today; nothing has drained it into a real send yet.

---

## 1. Principle

A business mutation must never depend on a provider — or on Redis — being reachable.

```
Server Action
   └─ transaction ──┬─ business change
                    ├─ audit_logs
                    ├─ notifications        (in-app — written now, no queue needed)
                    └─ notification_outbox   (intent for email/WhatsApp — written now)
                          │  commit
                          ▼
                    dispatcher ──> BullMQ (Redis) ──> worker ──> provider   ⟵ NOT BUILT (§7)
                                                          │
                                                          └──> message_logs
```

In-app notifications need no queue at all — writing a `Notification` row is a database write, not a
network call to a third party, so it happens synchronously inside the same transaction as the
business change (`emitNotificationEvent()` in `src/lib/notifications/service.ts`). Only the
email/WhatsApp half of this diagram is actually blocked on Redis.

## 2. Events — IMPLEMENTED

`NotificationEvent` (`prisma/schema/messaging.prisma`): `ORDER_CREATED`, `ORDER_ASSIGNED`,
`ORDER_PROCESSED`, `ORDER_STARTED`, `ORDER_COMPLETED`, `ORDER_REVISED`, `DEADLINE_24H`,
`DEADLINE_6H`, `DEADLINE_TODAY`, `ORDER_OVERDUE`, `PAYMENT_DUE`, plus one addition beyond
specification Section 65's list: `ORDER_ITEM_STOP_WORK_REQUESTED` (Phase 7's cancel-with-adjustment
workflow, formalized into this enum this phase).

Emitted only from `src/lib/orders/service.ts` (the one place that calls `emitNotificationEvent()`),
never from a component — one notification service, not notification logic scattered per feature
(Section 66's explicit rule). Wired in so far: `ORDER_ASSIGNED` (assigning an internal worker),
`ORDER_PROCESSED` + `ORDER_STARTED` per activated item (Process Order), `ORDER_REVISED` (order moves
to Revision), `ORDER_COMPLETED` (order moves to Completed, notifies the order's creator).

**Not wired to anything yet:** `ORDER_CREATED` (no obvious personal recipient — nothing here models
"notify all admins"), `DEADLINE_24H`/`DEADLINE_6H`/`DEADLINE_TODAY`/`ORDER_OVERDUE` (these need a
recurring scheduled check, which needs the same queue/scheduler decision as §7), `PAYMENT_DUE` (no
"payment due date" field exists on `Order` — inventing one wasn't asked for and would be
fabrication). Wiring any of these in later is mechanical once a scheduler exists; nothing about their
absence today requires a schema change.

## 3. Channels — PARTIALLY IMPLEMENTED

In-app (real), email/Resend (interface only — §7), WhatsApp/Meta (interface only — §7).

Providers sit behind interfaces so the order domain never imports a provider SDK type
(`src/lib/notifications/providers/types.ts`):

```ts
interface EmailProvider    { sendTemplate(input: EmailMessage): Promise<ProviderReceipt> }
interface WhatsAppProvider { sendTemplate(input: WhatsAppMessage): Promise<ProviderReceipt> }
```

**No WhatsApp Web or browser automation, ever** (specification Section 69).

**Missing credentials mean unconfigured, not successful** (implemented): `getEmailProvider()` /
`getWhatsAppProvider()` (`src/lib/notifications/providers/index.ts`) currently always resolve to
`UnconfiguredEmailProvider` / `UnconfiguredWhatsAppProvider`, which report `{ ok: false }` with a
clear reason — never a fabricated success. This is not a stub awaiting credentials alone: there is
also no queue to dispatch through yet (§7), so a real Resend/Meta client would be untestable code
sitting on a shelf. Swapping in a real implementation is a one-line change in that factory once both
prerequisites exist — no calling code changes.

## 4. Preferences — IMPLEMENTED

Per event, per channel, with a system default (`src/lib/notifications/events.ts`'s
`DEFAULT_NOTIFICATION_PREFERENCES`) and a per-user override (`NotificationPreference`, self-service —
`/notifications`, no permission key needed). A missing preference row means "use the default," never
a second copy of the defaults duplicated into the database.

Specification Section 74's worked example, matched exactly:

| Event | Email | WhatsApp | In-app |
| --- | --- | --- | --- |
| Order assigned | on | on | on |
| Order completed | on | off | on |
| Deadline 6h | off | on | on |

Every other event defaults to in-app on, email/WhatsApp off — reasonable defaults for events the
example table doesn't cover, not guesses about what SHOULD eventually be on once dispatch exists.

## 5. Templates and variables — IMPLEMENTED

Templates are database rows (`NotificationTemplate`, one per (event, channel) —
`/communication/templates`, `templates.view`/`templates.manage`), never a string literal scattered
through the code.

Variables (`TEMPLATE_VARIABLES` in `src/lib/notifications/events.ts`): `{{worker_name}}`,
`{{order_id}}`, `{{order_number}}`, `{{service}}`, `{{category}}`, `{{deadline}}`,
`{{customer_name}}`, `{{amount}}`, `{{hours_remaining}}`. Specification Section 70's original list
also had `{{buyer_name}}`; dropped post-Phase-10 (2026-09-28) when Buyer was removed entirely — there
is no buyer name left for any dispatch to supply.

Each template declares which variables it requires. **Validated at save time**
(`validateTemplateVariables()`): an unknown `{{placeholder}}` in the body/subject is refused, and a
declared-but-unused required variable is refused too — a template bug either way. **Validated again
at render time** (`renderTemplate()`): a required variable with no value throws rather than sending a
message reading "Hello {{worker_name}}" — this function exists and is unit-tested, but nothing calls
it yet, since nothing dispatches a real message (§7).

WhatsApp additionally requires templates pre-approved by Meta; the local template stores the
Meta-approved name and language (`metaTemplateName`/`metaTemplateLanguage`), and the approval state
itself is not something this application can grant — same reasoning as the email-template Supabase
dashboard step from Phase 1.

Unlike `Expense` (docs/REQUIREMENTS.md D8 — edit in place, no delete, because historical financial
records must keep resolving), a template supports hard delete: nothing depends on a template
surviving (`MessageLog.templateId` is nullable with `onDelete: SetNull` specifically so a log
outlives its template being removed) — content configuration, not an audit trail.

## 6. Message log — IMPLEMENTED (schema + viewer), empty by design

`MessageLog`: recipient (a `User` FK where one exists, plus a denormalized label/contact for
recipients who are not — an `OutsourcedWorker`, a Customer, previously also a Buyer contact before
Buyer was removed entirely, post-Phase-10 — the same pattern as `OrderActivity.actorLabel`), channel,
template, event, provider message id, created/sent/delivered timestamps, status, error. Viewer at
`/communication/message-logs`, `message_logs.view`.

`QUEUED → SENDING → SENT → DELIVERED`, or `FAILED` (`MessageStatus` enum).

**`SENT` means the provider accepted it. `DELIVERED` means the provider confirmed delivery.** These
are different facts and the UI must not conflate them.

**The table is empty, and will stay empty, until §7 is built.** Nothing writes a `MessageLog` row yet
— there is no dispatcher to write one. The viewer shows this plainly (an empty state naming why)
rather than fabricating a demonstration row.

## 7. Queue — NOT BUILT this phase (the one real gap)

Specification Section 72 requires Redis + BullMQ. **Neither exists in this project.** What happened
this session: a local Homebrew Redis install was attempted so the dispatcher could be built AND
actually tested end-to-end; it turned out this Mac is on a macOS version new enough that Homebrew has
no precompiled bottle for Redis or its dependency `openssl@3`, so `brew install redis` started
compiling LLVM, Rust, and other toolchain pieces from source — a 30-90+ minute, heavy CPU/disk
operation just to obtain one binary. The owner chose to defer the queue rather than pay that cost (or
wait on creating a hosted Redis account) and build everything else in this document that doesn't need
it instead.

**Consequence:** `notification_outbox` rows accumulate (`status: "PENDING"` forever), in-app
notifications work fully, and email/WhatsApp/deadline-reminders never fire. This is the same
"missing configuration must not stop independent work, but cannot be silently assumed" treatment
already given to the missing Storage bucket (Order files) and the unconfigured SMTP templates
(invitation email) — not a new pattern invented for this gap.

**What building this later actually involves** (unchanged from the original design, recorded here so
it is not re-designed from scratch):

- Redis, reachable via `REDIS_URL` — either a local instance (dev) or a hosted one (Upstash, etc. —
  production either way).
- BullMQ queues: `email`, `whatsapp`, `notifications`, `deadline-reminders`, `reports`.
- Jobs **idempotent**, keyed by the `notification_outbox` row id, so a retry cannot send twice.
- Retries **bounded** with exponential backoff (5 attempts).
- A delayed job **rechecks state before acting** — a deadline reminder for an order completed in the
  meantime must not be sent.
- Failures preserved for authorized inspection (`message_logs.view`), not discarded.
- A dispatcher that reads `notification_outbox`, resolves the matching `NotificationTemplate`, calls
  `renderTemplate()`, calls `getEmailProvider()`/`getWhatsAppProvider()` (swapped from Unconfigured to
  real implementations once credentials exist), and writes the resulting `MessageLog` row.

## 8. Worker hosting — NOT BUILT (blocked on §7)

Consumers must run as a **separate long-running Node process**, not in a request handler.

A serverless function is not a queue worker: it is not running when no request is in flight, and it
is killed when the response ends. Vercel hosts the application; the worker needs a host that runs a
persistent process (Render, Fly.io, Railway, a container). See `docs/DEPLOYMENT.md`.

The worker needs `DATABASE_URL`, `REDIS_URL` and the provider credentials — and **not** the
publishable key.

## 9. In-app notifications — IMPLEMENTED, without Realtime

Recipient, title, message, type (reuses `NotificationEvent`), read/unread, created time, optional
entity reference and action URL (`Notification` model). A notification centre at `/notifications`
plus a bell in the app header (`src/components/layout/notification-bell.tsx`) showing an unread
count.

**Not real Supabase Realtime.** The original design named "a single narrow subscription filtered to
the current recipient" as the one justified use of Realtime. Building that properly needs a new,
reviewed RLS policy scoped to `recipient_id = auth.uid()` — a real, permanent security-relevant
change (docs/ARCHITECTURE.md §4: "Any future direct-from-browser access must add an explicit,
reviewed policy") — plus enabling Realtime replication on the table. Given the queue was already
deferred this session, adding a new permissive RLS policy under the same time pressure without
separate review was judged not worth the risk. Instead: the bell and count are server-rendered fresh
on every navigation (`(app)/layout.tsx` fetches them alongside the actor), and mark-read actions call
`router.refresh()`. The practical gap: a notification does not appear live without a page
navigation — deliberate, not overlooked, and the smallest piece of this document still marked
NOT_STARTED.
