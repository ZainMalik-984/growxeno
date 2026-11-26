import { createHmac, timingSafeEqual } from "node:crypto";

import { revalidatePath } from "next/cache";

import { getResendInboundSecret } from "@/lib/env";
import { parseFiverrOrderEmail } from "@/lib/fiverr-email/parser";
import { createOrderFromEmail } from "@/lib/fiverr-email/processor";
import { prisma } from "@/lib/db/prisma";

/**
 * Resend inbound email webhook for Fiverr order notifications.
 *
 * Setup:
 *   1. In Resend dashboard: Inbound → New route → address: fiverr-orders@growxeno.com
 *      → Webhook URL: https://<domain>/api/webhooks/fiverr-orders
 *   2. Copy the signing secret → RESEND_INBOUND_SECRET in env
 *   3. In Gmail for each Fiverr account: create a filter
 *      From: donotreply@fiverr.com → Forward to: fiverr-orders@growxeno.com
 *
 * See docs/FIVERR_EMAIL_SETUP.md for the step-by-step guide.
 *
 * Always returns 200 — Resend retries on non-2xx responses, which would cause
 * duplicate orders. Errors are logged server-side only.
 */

export const maxDuration = 60;

/**
 * Verify the svix webhook signature Resend attaches to every inbound delivery.
 *
 * Algorithm (https://docs.svix.com/receiving/verifying-payloads/how):
 *   1. Secret = base64-decode(secret stripped of "whsec_" prefix)
 *   2. Message = `${svix-id}.${svix-timestamp}.${raw body}`
 *   3. HMAC-SHA256(secret, message) → base64
 *   4. Compare against each "v1,<sig>" entry in svix-signature header
 */
function verifySvixSignature(
  secret: string,
  msgId: string,
  msgTimestamp: string,
  body: string,
  signatures: string,
): boolean {
  const rawSecret = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice(6), "base64")
    : Buffer.from(secret, "base64");

  const message = `${msgId}.${msgTimestamp}.${body}`;
  const expected = createHmac("sha256", rawSecret).update(message).digest("base64");

  return signatures.split(" ").some((sig) => {
    const actual = sig.startsWith("v1,") ? sig.slice(3) : sig;
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  });
}

/** Extract the original Fiverr account email from Gmail's forwarding headers. */
function extractOriginalRecipient(headers: Record<string, string>): string | null {
  // Gmail adds X-Forwarded-To when auto-forwarding. Resend exposes raw headers.
  const fwd =
    headers["x-forwarded-to"] ??
    headers["x-original-to"] ??
    headers["delivered-to"];

  if (!fwd) return null;

  // May contain a comma-separated list; take the first address.
  const first = fwd.split(",")[0]?.trim() ?? "";
  // Strip angle brackets if present: <seller@gmail.com>
  return first.replace(/^<|>$/g, "").toLowerCase() || null;
}

export async function POST(request: Request): Promise<Response> {
  const secret = getResendInboundSecret();
  if (!secret) {
    console.error("[fiverr-orders webhook] RESEND_INBOUND_SECRET not configured — rejecting");
    return Response.json({ error: "Webhook not configured" }, { status: 401 });
  }

  const rawBody = await request.text();

  // Verify signature
  const msgId = request.headers.get("svix-id") ?? "";
  const msgTimestamp = request.headers.get("svix-timestamp") ?? "";
  const msgSig = request.headers.get("svix-signature") ?? "";

  if (!msgId || !msgTimestamp || !msgSig) {
    console.error("[fiverr-orders webhook] Missing svix headers — rejecting");
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!verifySvixSignature(secret, msgId, msgTimestamp, rawBody, msgSig)) {
    console.error("[fiverr-orders webhook] Signature mismatch — rejecting");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Parse payload
  let payload: {
    from?: string;
    to?: string;
    subject?: string;
    html?: string;
    text?: string;
    headers?: Record<string, string>;
    date?: string;
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error("[fiverr-orders webhook] Invalid JSON body");
    return new Response(null, { status: 200 });
  }

  const subject = payload.subject ?? "";
  const html = payload.html ?? "";
  const text = payload.text ?? "";
  const headers = payload.headers ?? {};
  const date = payload.date ? new Date(payload.date) : new Date();

  // Parse the email — returns null for non-order emails (promos, reviews, etc.)
  const parsed = parseFiverrOrderEmail(subject, html, text, date);
  if (!parsed) {
    // Not a new-order notification — ignore silently.
    return new Response(null, { status: 200 });
  }

  // Identify the Fiverr account from the original recipient address.
  const originalEmail = extractOriginalRecipient(headers);
  if (!originalEmail) {
    console.warn(
      `[fiverr-orders webhook] Could not determine original recipient for order ${parsed.orderId}`,
    );
    return new Response(null, { status: 200 });
  }

  const account = await prisma.fiverrAccount.findFirst({
    where: { email: { equals: originalEmail, mode: "insensitive" } },
    select: { id: true, name: true },
  });

  if (!account) {
    console.warn(
      `[fiverr-orders webhook] No FiverrAccount found for email ${originalEmail} (order ${parsed.orderId})`,
    );
    return new Response(null, { status: 200 });
  }

  try {
    const result = await createOrderFromEmail(parsed, account.id);

    if (result.status === "created") {
      console.log(
        `[fiverr-orders webhook] Created order #${result.orderNumber} ` +
          `(${parsed.orderId}) for account "${account.name}"`,
      );
      revalidatePath("/orders");
    } else {
      console.log(
        `[fiverr-orders webhook] Skipped duplicate order ${parsed.orderId}`,
      );
    }
  } catch (err) {
    console.error(`[fiverr-orders webhook] Error creating order ${parsed.orderId}:`, err);
  }

  return new Response(null, { status: 200 });
}
