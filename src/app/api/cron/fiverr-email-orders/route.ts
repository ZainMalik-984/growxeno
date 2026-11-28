import { timingSafeEqual } from "node:crypto";

import { revalidatePath } from "next/cache";

import { getCronSecret } from "@/lib/env";
import { decryptSecret } from "@/lib/crypto/secret-box";
import { prisma } from "@/lib/db/prisma";
import { fetchFiverrEmailsFromGmail } from "@/lib/fiverr-email/imap";
import { parseFiverrOrderEmail } from "@/lib/fiverr-email/parser";
import { createOrderFromEmail } from "@/lib/fiverr-email/processor";

/**
 * Cron job: poll Gmail for Fiverr order notification emails and auto-create Orders.
 *
 * Runs every 10 minutes (vercel.json). Processes every active FiverrAccount
 * that has emailMonitoringEnabled = true and a saved Gmail App Password.
 *
 * Deduplication: each processed Gmail message ID is recorded in FiverrEmailLog.
 * An email is skipped if its ID is already in that table, so it doesn't matter
 * whether the user has read the email in Gmail — duplicates are impossible.
 */

export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.fiverrAccount.findMany({
    where: {
      isActive: true,
      emailMonitoringEnabled: true,
      gmailAppPasswordEncrypted: { not: null },
      email: { not: null },
    },
    select: {
      id: true,
      name: true,
      email: true,
      gmailAppPasswordEncrypted: true,
      emailMonitoringSince: true,
    },
  });

  const summary: Array<{ account: string; fetched: number; created: number; skipped: number; errors: number }> = [];

  for (const account of accounts) {
    if (!account.email || !account.gmailAppPasswordEncrypted) continue;

    let appPassword: string;
    try {
      appPassword = decryptSecret(account.gmailAppPasswordEncrypted);
    } catch {
      console.error(`[fiverr-cron] Failed to decrypt app password for account ${account.name}`);
      continue;
    }

    const since = account.emailMonitoringSince ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

    let emails: Awaited<ReturnType<typeof fetchFiverrEmailsFromGmail>>;
    try {
      emails = await fetchFiverrEmailsFromGmail(account.email, appPassword, since);
    } catch (err) {
      console.error(`[fiverr-cron] IMAP error for ${account.name}:`, err);
      summary.push({ account: account.name, fetched: 0, created: 0, skipped: 0, errors: 1 });
      continue;
    }

    let created = 0, skipped = 0, errors = 0;

    for (const email of emails) {
      // Skip if already processed.
      const alreadyLogged = await prisma.fiverrEmailLog.findUnique({
        where: { fiverrAccountId_gmailMessageId: { fiverrAccountId: account.id, gmailMessageId: email.messageId } },
        select: { id: true },
      });
      if (alreadyLogged) {
        skipped++;
        continue;
      }

      const parsed = parseFiverrOrderEmail(email.subject, email.html, email.text, email.date);

      if (!parsed) {
        // Not an order email (promo, tip, etc.) — log it as skipped so we don't re-check.
        await prisma.fiverrEmailLog.create({
          data: { fiverrAccountId: account.id, gmailMessageId: email.messageId, result: "skipped" },
        });
        skipped++;
        continue;
      }

      try {
        const result = await createOrderFromEmail(parsed, account.id);
        const logResult = result.status === "created" ? "created" : "duplicate";
        await prisma.fiverrEmailLog.create({
          data: {
            fiverrAccountId: account.id,
            gmailMessageId: email.messageId,
            result: logResult,
            orderId: result.status === "created" ? result.orderId : null,
          },
        });
        if (result.status === "created") {
          console.log(`[fiverr-cron] Created order #${result.orderNumber} (${parsed.orderId}) for ${account.name}`);
          created++;
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`[fiverr-cron] Error creating order for ${parsed.orderId}:`, err);
        await prisma.fiverrEmailLog.create({
          data: { fiverrAccountId: account.id, gmailMessageId: email.messageId, result: "error" },
        }).catch(() => {});
        errors++;
      }
    }

    summary.push({ account: account.name, fetched: emails.length, created, skipped, errors });
  }

  if (summary.some((s) => s.created > 0)) revalidatePath("/orders");

  return Response.json({ ok: true, accounts: summary });
}
