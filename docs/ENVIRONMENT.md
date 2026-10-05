# Environment variables

Template: `.env.example`. Copy it to `.env.local` for development.

**No real secret is ever committed.** `.gitignore` excludes `.env*` and re-includes only
`.env.example`.

How the application behaves when something is missing: it treats the feature as **unconfigured** and
fails closed. Validation is lazy — checked at the point of use, not at import — so `next build`,
`vitest` and `eslint` all succeed on a machine with no credentials, while anything that actually
needs one produces a `ConfigurationError` naming the variable. Nothing is ever silently faked.

---

## Required now (Phase 1)

| Variable | Required | Used by | Where to get it |
| --- | :---: | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | browser + server; Supabase Auth | Supabase → Settings → API Keys |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | browser + server | Supabase → Settings → API Keys |
| `SUPABASE_SECRET_KEY` | for user provisioning | **server only** | Supabase → Settings → API Keys |
| `DATABASE_URL` | yes | Prisma at runtime | Supabase → Connect |
| `DIRECT_URL` | yes | Prisma Migrate, seed | Supabase → Connect |
| `NEXT_PUBLIC_APP_URL` | no | auth redirects, message links | your own URL; defaults to `http://localhost:3000` |
| `SEED_ADMIN_EMAIL` | no | `pnpm db:seed` | you choose |
| `SEED_ADMIN_PASSWORD` | no | `pnpm db:seed` | you choose — use a strong one and change it after first sign-in |
| `SEED_ADMIN_NAME` | no | `pnpm db:seed` | defaults to "Super Admin" |
| `E2E_BASE_URL` | no | Playwright | set to test an already-running instance |
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | no | Playwright | authenticated suite; falls back to `SEED_ADMIN_*` |
| `E2E_WORKER_EMAIL` | no | Playwright | a second, non-admin user for the write-path tests |
| `SUPABASE_ANON_KEY` | no | RLS verification only | legacy anon key; proves the public role reads nothing |
| `CREDENTIALS_ENCRYPTION_KEY` | for saving a Fiverr account's PayPal password (post-Phase-10) | `src/lib/crypto/secret-box.ts` — AES-256-GCM at rest | generate with `openssl rand -base64 32`; must decode to exactly 32 bytes, or encryption fails closed rather than storing plaintext |

### Reaching the database at all

Supabase gives you a **direct** host (`db.<ref>.supabase.co`) and a **pooler** host
(`aws-<n>-<region>.pooler.supabase.com`, user `postgres.<ref>`).

The direct host is **IPv6-only** unless the project has the IPv4 add-on. On an IPv4-only network it
fails with `P1001: Can't reach database server`, which reads like an outage but is a routing problem.
Use the pooler for both URLs in that case.

Passwords must be percent-encoded inside a connection URL — `^` → `%5E`, `*` → `%2A`, `@` → `%40`.

### The two database URLs are not interchangeable

| | `DATABASE_URL` | `DIRECT_URL` |
| --- | --- | --- |
| Used by | the running application | Prisma Migrate and the seed |
| Connection | transaction pooler (`:6543`, `?pgbouncer=true`) in serverless | direct or session pooler (`:5432`) |
| Why | short-lived serverless connections need pooling | migrations need a real session; a transaction pooler cannot run them |

For a plain local PostgreSQL, both may be the same value.

`prisma.config.ts` reads `DIRECT_URL` (falling back to `DATABASE_URL`); the runtime driver adapter
reads `DATABASE_URL`.

### Key safety

`SUPABASE_SECRET_KEY` **bypasses Row Level Security entirely** and can act as any user.

- Never prefix it with `NEXT_PUBLIC_`.
- Only `src/lib/supabase/admin.ts` reads it, and that module is `server-only`.
- Never log it, never put it in an error message, never send it to any third-party service.

`NEXT_PUBLIC_*` variables are compiled into the browser bundle. Anything secret must not carry that
prefix.

The specification mentions `SUPABASE_SERVICE_ROLE_KEY`; this project uses the newer publishable/
secret key names, as recommended in `docs/ACCOUNTS_AND_CREDENTIALS.md`. The security requirement is
identical: the privileged key stays server-side.

---

## Not yet used

These belong to later phases. Leave them unset — an unconfigured integration reports that it cannot
send rather than pretending it did.

### Phase 8 — Communication

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Transactional email |
| `EMAIL_FROM` | Sender address on a verified domain |
| `WHATSAPP_ACCESS_TOKEN` | Meta system-user token |
| `WHATSAPP_PHONE_NUMBER_ID` | Sending number |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WABA id |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Webhook verification |
| `WHATSAPP_APP_SECRET` | Meta app secret — verifies the `X-Hub-Signature-256` header on incoming webhooks, so a forged callback is rejected |
| `REDIS_URL` | BullMQ connection (a `rediss://` TCP URL), for the app and the worker |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Upstash's HTTP API. **Not used by BullMQ**, which needs `REDIS_URL`; present in `.env.local` but unread by any code today |

None of these is read by any code yet — the queue and dispatcher are not built (docs/NOTIFICATIONS.md §7).
All are **server-only secrets**: never prefix them `NEXT_PUBLIC_`. `pnpm security:secrets` checks that none
appears in the browser bundle, a committable file, or git history.
Note that Supabase Auth's own emails (password reset, verification) are configured **separately**, in
Supabase's SMTP settings. Setting `RESEND_API_KEY` here does not configure them.

### Monitoring

None. Error-reporting and analytics services are out of scope (owner decision, 2026-09-21), so no
monitoring variables exist. Business data stays in PostgreSQL.

---

## Which environment needs what

| Variable | Local | Vercel (app) | Queue worker |
| --- | :---: | :---: | :---: |
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | ✓ | ✓ |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✓ | ✓ | — |
| `SUPABASE_SECRET_KEY` | ✓ | ✓ | ✓ |
| `DATABASE_URL` | ✓ | ✓ | ✓ |
| `DIRECT_URL` | ✓ | migrations only | — |
| `REDIS_URL` (Phase 8, not yet read) | ✓ | ✓ | ✓ |
| provider credentials (Phase 8) | optional | ✓ | ✓ |

---

## Verifying configuration

```bash
node -v                  # must be >= 22.12 — see docs/DEVELOPMENT.md
pnpm db:migrate:status   # can Prisma reach the database over DIRECT_URL?
pnpm db:seed             # says exactly which variables it is missing, and skips rather than failing
pnpm dev                 # /login states plainly if Supabase or the database is unconfigured
```

To confirm RLS from outside the application, query PostgREST with the publishable key — every
application table must answer `42501 permission denied`:

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/users?select=*&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
```
