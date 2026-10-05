# Deployment

> **Status: not deployed.** No hosting, database, domain or provider account has been provisioned by
> this project, and nothing here has been executed. This is the intended procedure.

## Topology

```
GitHub ──> Vercel (Next.js app)  ──┐
                                   ├──> Supabase: PostgreSQL + Auth + Storage
Render/Fly/Railway (queue worker) ─┘         │
        │                                    │
        └──> Redis ──> Resend, Meta WhatsApp │
                                              (no third-party monitoring)
```

The application and the queue worker are **separate deployments sharing one database**. That is not
optional — see §4.

## 1. Supabase

1. Create the project; choose a region near your users.
2. Collect from Settings → API Keys: project URL, publishable key, secret key.
3. Collect from Connect: the transaction-pooler string (`DATABASE_URL`) and the direct/session
   string (`DIRECT_URL`). These are **not** interchangeable.
4. Configure Auth: disable public sign-up — users are created inside the application
   (specification Section 4); set the site URL and redirect URLs; configure SMTP (Resend) so
   password-reset and verification emails work. Supabase Auth's email is configured **separately**
   from the application's `RESEND_API_KEY`.
5. Apply migrations from a trusted machine or CI:
   ```bash
   pnpm db:migrate:deploy     # uses DIRECT_URL
   pnpm db:seed               # idempotent
   ```
6. Verify RLS: with the publishable key, `select * from users` must return **zero rows**. If it
   returns data, stop and fix it before going further.

**Never** run `prisma migrate reset` or `prisma db push` against production.

## 2. Vercel

1. Import the GitHub repository. Framework preset: Next.js. Build `pnpm build`, install
   `pnpm install`.
2. Environment variables per `docs/ENVIRONMENT.md`. `SUPABASE_SECRET_KEY` must **not** carry the
   `NEXT_PUBLIC_` prefix, and must be set for Production and Preview separately.
3. `DATABASE_URL` must be the **transaction pooler** — serverless functions open many short-lived
   connections and will exhaust a direct connection limit.
4. Set `NEXT_PUBLIC_APP_URL` to the production URL.
5. Add the custom domain and let Vercel manage TLS.

**Preview deployments must not point at the production database.** Use a separate Supabase project
or branch.

## 3. Domain and email (Phase 8)

Add the DNS records Resend supplies (SPF, DKIM, and a return-path) for the sending domain. A
dedicated sending subdomain keeps this isolated from your main mail. Verify before enabling email.

## 4. Queue worker (Phase 8)

**A serverless function is not a queue worker.** It does not run when no request is in flight and is
killed when the response ends. BullMQ consumers need a persistent process.

Host on Render, Fly.io, Railway or any container platform, as a *worker* service (no public port):

| | |
| --- | --- |
| Command | `node dist/worker.js` (built separately from the Next.js app) |
| Env | `DATABASE_URL`, `REDIS_URL`, `SUPABASE_SECRET_KEY`, provider credentials. **Not** the publishable key |
| Scaling | start at one instance; jobs are idempotent, so more instances are safe |
| Redis | same region as the worker; enable persistence so queued jobs survive a restart |
| Shutdown | handle `SIGTERM`: stop accepting jobs, let in-flight jobs finish, close the Redis connection. Without this a deploy can lose or double-run a job |
| Recovery | the outbox is the safety net — a job lost in Redis is still an uncommitted outbox row and gets re-dispatched |
| Monitoring | alert on queue depth and on the failed-job count |

Scheduled work (deadline reminders) uses BullMQ repeatable jobs owned by the worker, not a cron that
hits an HTTP endpoint.

## 5. Security configuration (Phase 10)

Do these before the first real user. None is code; see `docs/SECURITY.md` §5.

1. **Supabase → Authentication → Sign In / Providers: turn OFF "Allow new users to sign up".** Users are
   created by administrators. `pnpm security:audit` reports it as a FAIL while it is on.
2. **Site URL and Redirect URLs** (Authentication → URL Configuration): the production origin only, plus
   `http://localhost:3000/**` for development.
3. **Enable MFA** for administrator accounts.
4. **Rotate the seeded Super Admin password**; delete `SETUP_LOG.md`.
5. After deploying, check the response headers on the live URL (`curl -I`): `Content-Security-Policy`,
   `X-Frame-Options: DENY`, `Strict-Transport-Security`, no `X-Powered-By`.
6. Run `pnpm security:audit` against the production project after every migration.

The app sets its own security headers (`next.config.ts`), so the host adds none of them; HSTS is sent
only when `NODE_ENV=production`.

## 5b. Monitoring

No error-reporting or analytics service is used (out of scope, owner decision 2026-09-21). Errors
reach the host's log; `src/app/error.tsx` shows users only a digest, never a stack trace.

## 6. Backups and recovery

Supabase takes automated backups; confirm the retention period matches what the business needs, as
it varies by plan. Point-in-time recovery is a paid feature — decide explicitly whether you need it.

Untested backups are not backups: restore into a scratch project at least once and record how long
it took.

Storage objects are **not** covered by database backups. Plan separately for file retention.

Before any risky migration: take a manual snapshot, confirm it completed, and know the rollback.

## 7. Release checklist

- [ ] `pnpm verify` passes (typecheck, lint, tests, build)
- [ ] `pnpm test:e2e` passes against a staging deployment
- [ ] Migrations reviewed and applied with `db:migrate:deploy`
- [ ] `pnpm db:migrate:status` reports no drift
- [ ] Seed run; permission catalog shows no drift at `/settings/permissions`
- [ ] RLS verified: publishable key returns zero rows
- [ ] No secret carries a `NEXT_PUBLIC_` prefix
- [ ] At least two active users hold `users.edit` and `roles.edit` (lockout insurance)
- [ ] Worker deployed and draining the queue (Phase 8)
- [ ] `docs/REQUIREMENTS.md` evidence updated
