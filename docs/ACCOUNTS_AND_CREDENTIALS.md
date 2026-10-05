# Accounts and Credentials Setup Guide

## Internal Business Operations Platform and Optional In-App AI Agent

Start with **GitHub and Supabase**. Add hosting, email, WhatsApp, and monitoring as you implement those parts.

The original development specification names the business-platform providers below. An **AI agent running inside your deployed Next.js application** is a separate runtime integration and also needs an AI-provider API account. An AI tool used only to help write the application does not automatically become a runtime dependency.

> **Configuration note:** Environment-variable names in this guide are suggested names for your application, not values already configured in your repository. No actual credentials are included.

## 1. Accounts and Credentials Checklist

| Account / service | What you need | Credentials or access to collect |
| --- | --- | --- |
| **GitHub** | An account or organization with a repository for the application. | Repository access through SSH or an appropriately scoped personal access token. This is development/deployment access, not a credential your business app normally needs at runtime. [GitHub documentation](https://docs.github.com/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line) |
| **Supabase** | A project providing PostgreSQL, authentication, and file storage. | Project URL, publishable API key, backend secret key for administrative operations, and database connection strings for Prisma. See Section 2. [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys) |
| **Vercel** | An account/team and project connected to your GitHub repository, following the recommended hosting setup. | GitHub integration authorization and the application's environment variables. A `VERCEL_TOKEN` is needed only for deployment automation that uses token authentication, not ordinary Git-connected deployment. [Vercel GitHub integration](https://vercel.com/docs/git/vercel-for-github) |
| **Domain / DNS provider** | Access to the DNS settings of the domain you will use for sending email. | Permission to add the DNS records supplied by Resend. An existing domain can be used; a sending subdomain keeps this configuration separate. [Resend and Supabase setup](https://resend.com/docs/knowledge-base/getting-started-with-resend-and-supabase) |
| **Resend** | An account, verified sending domain, and sender address. | `RESEND_API_KEY` and a sender setting such as `EMAIL_FROM`. Also configure Resend as Supabase Auth's SMTP provider for account emails. [Resend and Supabase setup](https://resend.com/docs/knowledge-base/getting-started-with-resend-and-supabase) |
| **Meta / WhatsApp Business Platform** | Meta developer access, a Meta app, a business portfolio, a WhatsApp Business Account, and a business phone number. | System-user access token, WhatsApp Business Account ID, phone number ID, Meta app ID/app secret, and a webhook verification token. [Meta getting started](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started.md/) |
| **Redis and background-worker hosting** | A Redis-compatible service and somewhere to run the BullMQ worker continuously. These can be provided by the same hosting company. | A Redis connection string, commonly `REDIS_URL`, plus deployment access for the worker. Render is one possible host; it is an implementation option, not a provider mandated by the specification. [BullMQ connections](https://docs.bullmq.io/guide/connections) |

You do **not** need separate database, authentication, and storage accounts: the specification puts all three under **Supabase**.

**Specification references:** `Pasted markdown(5).md`, Section 16 (Supabase) and Section 143 (Deployment).

## 2. Supabase: Collect These First

These are the main values that unblock the foundation work:

| Suggested variable | What it contains | Where to obtain it |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project's API URL. | Project's **Connect** dialog. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The public application key used with Supabase Auth and access policies. | **Settings -> API Keys**. |
| `SUPABASE_SECRET_KEY` | A privileged server-only key, used where administrative access is required. | **Settings -> API Keys**. |
| `DATABASE_URL` | The PostgreSQL connection string used by Prisma at runtime. | **Connect**, choosing the connection mode appropriate to the deployment. |
| `DIRECT_URL` | A connection string suitable for migrations, usually a direct or session-pooler connection. | **Connect**. Configure Prisma's migration commands to use it. |

Supabase documents the API-key locations and separate runtime/migration connections in its setup guides. **Database connection strings contain database credentials; they are not interchangeable with Supabase API keys.**

References: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys) and [Using Prisma with Supabase](https://supabase.com/docs/guides/database/prisma).

### Legacy and New API Keys

The original specification refers to `SUPABASE_SERVICE_ROLE_KEY`. The guidance summarized in the preceding conversation recommends the newer **publishable** and **secret** keys for a new implementation instead of the legacy `anon` and `service_role` keys.

The backend secret still bypasses Row Level Security and must remain server-side.

Reference: [Migrating to new Supabase API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).

**Specification reference:** `Pasted markdown(5).md`, Section 15 (Security).

## 3. Email: There Are Two Configurations

Your application's assignment notifications and reminders use **Resend's API**. Supabase's authentication emails, such as password resets, need their own email-provider configuration.

Adding `RESEND_API_KEY` to Next.js alone does **not** configure Supabase Auth.

You can use the same Resend account for both.

Reference: [Getting started with Resend and Supabase](https://resend.com/docs/knowledge-base/getting-started-with-resend-and-supabase).

### Application Email Settings

```dotenv
RESEND_API_KEY=
EMAIL_FROM=
```

### Supabase Auth SMTP Settings

Configure the following in Supabase's SMTP settings:

```text
SMTP host:     smtp.resend.com
SMTP port:     465
SMTP username: resend
SMTP password: your Resend API key

Sender email:  an address on your verified sending domain
Sender name:   your application or business name
```

Reference: [Send emails with Supabase SMTP and Resend](https://resend.com/docs/send-with-supabase-smtp).

### Required Email Template Change (Password Reset and Invitations)

The application's password-reset and invite-a-user flows (specification Section 14, Section 4) verify
the emailed link at `/auth/callback`, a Route Handler that calls Supabase's `verifyOtp` directly. This
is the current Supabase-recommended pattern for Next.js App Router and needs one manual, one-time
change in the Supabase dashboard — it cannot be applied from this repository:

In **Authentication → Email Templates**, edit the **Confirm signup**, **Invite user**, and **Reset
password** templates so their link points at:

```text
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type={{ .Type }}&next={{ .RedirectTo }}
```

instead of Supabase's default link. Until this is done, the code path works (it is typechecked and
covered by tests up to this point) but no email actually points at it, so no link ever resolves.

Reference: [Supabase Next.js server-side auth guide](https://supabase.com/docs/guides/auth/server-side/nextjs) — the "Redirecting to server-side email link consumer" step.

## 4. WhatsApp: Save These Specific Values

Use the official **Meta WhatsApp Business Platform** integration.

Suggested configuration:

```dotenv
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_PHONE_NUMBER_ID=

META_APP_ID=
META_APP_SECRET=

WHATSAPP_WEBHOOK_VERIFY_TOKEN=
```

### Access Token and Phone Number ID

The **phone number ID** is Meta's identifier, not simply the phone number written with a country code.

Use a **system-user access token** for deployed messaging rather than relying on the temporary starter token from API setup.

Reference: [Meta WhatsApp getting started](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started.md/).

### Webhook Configuration

The **webhook verification token** is a secret string you choose and configure in both your application and Meta's dashboard. It is different from the access token.

The **Meta app secret** is used to verify webhook payload signatures.

You also need a publicly reachable **HTTPS webhook endpoint** to receive message-status updates.

Reference: [Create a WhatsApp webhook endpoint](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint.md/).

## 5. For an AI Agent Running Inside Next.js

Add an **AI-provider API account** when implementing the in-app agent runtime.

For **OpenAI**, this means an API project, an API key, and API billing configured for paid usage:

```dotenv
OPENAI_API_KEY=
```

Keep the key on your Next.js server and make model requests from server-side code. OpenAI's SDK supports reading this environment variable.

**ChatGPT subscription billing and API billing are separate.**

Reference: [OpenAI API quickstart](https://developers.openai.com/api/docs/quickstart).

This is additional to the business-platform services in the specification. The specification itself does not select an AI provider.

## 6. What You Do Not Need to Add

### No Separate Prisma-Hosted Database

Prisma connects to your **Supabase PostgreSQL** database. A separate Prisma-hosted database is not necessary for this architecture.

Reference: [Using Prisma with Supabase](https://supabase.com/docs/guides/database/prisma).

### No Separate BullMQ Service Requirement

BullMQ uses your configured **Redis connection**. The important infrastructure is Redis plus the worker process.

Reference: [BullMQ connections](https://docs.bullmq.io/guide/connections).

### No Stripe or PayPal Integration in the Current Scope

The current requirements cover **recording Worker payments** and maintaining their financial history. Online payment collection would be an additional integration, with additional credentials. (Section 59's Buyer Payments were recorded the same way from Phase 7 through 2026-09-27, but `BuyerPayment` was removed entirely along with Buyer, post-Phase-10, owner-directed — see `docs/DATABASE.md`'s "Buyer — REMOVED entirely" note.)

**Specification references:** `Pasted markdown(5).md`, Section 58 (Worker Payments) and Section 59 (Buyer Payments — moot since 2026-09-28).

### No Fiverr Credentials

No Fiverr credentials are needed or permitted by this specification. The platform must not integrate with Fiverr.

**Specification reference:** `Pasted markdown(5).md`, Section 2 (Absolute Fiverr Rule).

### Workers and Admins Need Application Accounts

Workers and Admins need **accounts inside your application**, not logins to Supabase, Vercel, or the other infrastructure dashboards.

The specification calls for manually managed application users with Supabase authentication.

**Specification references:** `Pasted markdown(5).md`, Section 4 (Users) and Section 14 (Authentication).

## 7. Recommended Starting Point

Create the **GitHub repository** and a **development Supabase project**, then configure **Resend and DNS** before testing real account emails.

Add the remaining services as their modules are built:

- **Vercel** for the recommended application hosting setup.
- **Redis and worker hosting** for queued notifications and background processing.
- **Meta WhatsApp Business Platform** for WhatsApp messaging.
- **An AI-provider API account** when the in-app AI agent is implemented.

## 8. Credential Safety

Keep actual credentials in **ignored local environment files** and your deployment platform's **secret/environment settings**, not in the system prompt or source control.

In Next.js, values prefixed with `NEXT_PUBLIC_` can be included in browser JavaScript. Never use that prefix for:

- Database passwords or connection strings.
- Supabase backend secret keys.
- Messaging access tokens or app secrets.
- AI-provider API keys.

Reference: [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables).

The specification also requires `.env.example` and documentation of every environment variable in `docs/ENVIRONMENT.md`, including its purpose, whether it is required, where it is obtained, and which environment uses it. Example files must not contain real secrets.

**Specification reference:** `Pasted markdown(5).md`, Section 142 (Environment Variables).

---

## Source Basis

This file organizes the accounts-and-credentials guidance from the preceding conversation. It preserves the distinction between the providers selected in the original development specification and implementation options discussed afterward, including Render as a possible worker host and OpenAI as a possible AI provider.

Product requirements are attributed to the uploaded `Pasted markdown(5).md`, titled **Complete Source-of-Truth Development Prompt: Production-Grade Internal Business Operations Management System**. Provider documentation links are retained from the preceding guidance. This file-creation step did not perform a new verification of provider documentation or configure any accounts.
