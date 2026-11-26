# Fiverr Order Email → App Order Automation

When a new order is placed on Fiverr, Fiverr sends an email notification to the Gmail address registered on that account. This feature forwards that email to Resend, which triggers a webhook that automatically creates an Order in the app.

## How it works

```
Fiverr order placed
  → Fiverr emails seller@gmail.com
  → Gmail auto-forwards to fiverr-orders@growxeno.com
  → Resend inbound route receives the email
  → Resend POSTs parsed email to /api/webhooks/fiverr-orders
  → App creates Order linked to the matching Fiverr account
```

The order is created with:
- **Source**: Fiverr
- **Status**: Pending
- **Fiverr Account**: matched automatically from the Gmail address
- **External Reference**: Fiverr's order ID (e.g. FO9876543210)
- **Notes**: buyer name and gig title from the email

---

## Setup (one-time)

### Step 1 — Resend inbound route

1. Go to [resend.com](https://resend.com) → **Inbound**
2. Create a new route:
   - **Email address**: `fiverr-orders@growxeno.com` (or any address on your verified Resend domain)
   - **Webhook URL**: `https://app.growxeno.com/api/webhooks/fiverr-orders`
3. Copy the **signing secret** shown for the route.
4. Add it to your environment: `RESEND_INBOUND_SECRET=whsec_...`

### Step 2 — Gmail forwarding (once per Fiverr account)

For each Fiverr account that has a Gmail address saved in the app:

1. Sign in to that Gmail account.
2. Open **Settings** (gear icon) → **See all settings** → **Filters and Blocked Addresses**.
3. Click **Create a new filter**.
4. In the **From** field enter: `donotreply@fiverr.com`
5. Click **Create filter**.
6. Check **Forward it to**: `fiverr-orders@growxeno.com`
   - If the address isn't in the list, click **Add forwarding address** first and confirm it.
7. Also check **Skip the Inbox (Archive it)** if you don't want Fiverr order emails cluttering the Gmail inbox.
8. Click **Create filter**.

> The app identifies which Fiverr account the order belongs to by matching the original recipient Gmail address against the email stored on the account. Make sure the **email** field on each Fiverr account in the app matches the Gmail address exactly.

### Step 3 — Verify

Place a test order (or forward a past Fiverr order notification manually) and check that a new Pending order appears under **Orders** in the app within a few seconds.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Order not created after Fiverr email received | Gmail forwarding rule not set up, or `RESEND_INBOUND_SECRET` missing |
| Order created with no linked Fiverr account | The Fiverr account's **email** field in the app doesn't match the Gmail address |
| Duplicate order | Should not happen — the app deduplicates on Fiverr's order ID. If it does, check for multiple active Resend routes. |
| Non-order Fiverr emails creating orders | The email subject didn't match "new order". Check server logs for the parsed subject. |
