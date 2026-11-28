"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/authorize";
import { listGigStatsForRange } from "./queries";
import {
  bulkUpsertGigStats,
  clearGmailAppPassword,
  createFiverrAccount,
  createGig,
  createGigStat,
  deleteGigStatsForRange,
  removeGigThumbnail,
  revealFiverrPaypalPassword,
  revealGmailAppPassword,
  setEmailMonitoring,
  setFiverrAccountActive,
  setGigActive,
  setGigThumbnail,
  setGmailAppPassword,
  updateFiverrAccount,
  updateGig,
  updateGigStat,
} from "./service";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const uuid = z.uuid("Invalid identifier.");
const dateOnly = z.iso.date("Enter a valid date.");
const toDate = (dateOnlyString: string) => new Date(`${dateOnlyString}T00:00:00.000Z`);

// ---------------------------------------------------------------------------
// Fiverr accounts
// ---------------------------------------------------------------------------

const accountInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(160),
  email: z.email("Enter a valid email address.").optional().or(z.literal("")),
  paypalEmail: z.email("Enter a valid PayPal email address.").optional().or(z.literal("")),
  // Absent = leave unchanged; "" = clear; anything else = new password to encrypt.
  paypalPassword: z.string().max(500).optional(),
});

export type CreateFiverrAccountActionResult = { ok: true; message: string; accountId: string } | { ok: false; error: string };

export async function createFiverrAccountAction(input: unknown): Promise<CreateFiverrAccountActionResult> {
  const parsed = accountInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await createFiverrAccount(auth.actor, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/fiverr-accounts");
  return { ok: true, message: "Fiverr account added.", accountId: result.data.id };
}

export async function updateFiverrAccountAction(input: unknown): Promise<ActionResult> {
  const parsed = accountInputSchema.extend({ accountId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const { accountId, ...rest } = parsed.data;
  const result = await updateFiverrAccount(auth.actor, accountId, rest);
  if (result.ok) {
    revalidatePath(`/fiverr-accounts/${accountId}`);
    revalidatePath("/fiverr-accounts");
  }
  return result.ok ? { ok: true, message: "Fiverr account updated." } : { ok: false, error: result.error };
}

export async function setFiverrAccountActiveAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ accountId: uuid, isActive: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await setFiverrAccountActive(auth.actor, parsed.data.accountId, parsed.data.isActive);
  if (result.ok) {
    revalidatePath(`/fiverr-accounts/${parsed.data.accountId}`);
    revalidatePath("/fiverr-accounts");
  }
  return result.ok
    ? { ok: true, message: parsed.data.isActive ? "Account reactivated." : "Account deactivated." }
    : { ok: false, error: result.error };
}

export type RevealPasswordActionResult = { ok: true; password: string } | { ok: false; error: string };

export async function revealFiverrPaypalPasswordAction(input: unknown): Promise<RevealPasswordActionResult> {
  const parsed = z.object({ accountId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.credentials.view");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await revealFiverrPaypalPassword(auth.actor, parsed.data.accountId);
  return result.ok ? { ok: true, password: result.data.password } : { ok: false, error: result.error };
}

// ---------------------------------------------------------------------------
// Gigs
// ---------------------------------------------------------------------------

const gigInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(160),
});

export type CreateGigActionResult = { ok: true; message: string; gigId: string } | { ok: false; error: string };

export async function createGigAction(input: unknown): Promise<CreateGigActionResult> {
  const parsed = gigInputSchema.extend({ accountId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await createGig(auth.actor, parsed.data.accountId, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/fiverr-accounts/${parsed.data.accountId}`);
  revalidatePath("/fiverr-accounts/gigs");
  return { ok: true, message: "Gig added.", gigId: result.data.id };
}

export async function updateGigAction(input: unknown): Promise<ActionResult> {
  const parsed = gigInputSchema.extend({ gigId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await updateGig(auth.actor, parsed.data.gigId, parsed.data);
  if (result.ok) {
    revalidatePath("/fiverr-accounts/gigs");
    revalidatePath("/fiverr-accounts");
  }
  return result.ok ? { ok: true, message: "Gig updated." } : { ok: false, error: result.error };
}

export async function setGigActiveAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ gigId: uuid, isActive: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await setGigActive(auth.actor, parsed.data.gigId, parsed.data.isActive);
  if (result.ok) {
    revalidatePath("/fiverr-accounts/gigs");
    revalidatePath("/fiverr-accounts");
  }
  return result.ok
    ? { ok: true, message: parsed.data.isActive ? "Gig reactivated." : "Gig deactivated." }
    : { ok: false, error: result.error };
}

// ---------------------------------------------------------------------------
// Gig daily stats
// ---------------------------------------------------------------------------

const gigStatInputSchema = z.object({
  gigId: uuid,
  statDate: dateOnly,
  impressions: z.coerce.number().int().min(0, "Cannot be negative.").max(1_000_000_000),
  clicks: z.coerce.number().int().min(0, "Cannot be negative.").max(1_000_000_000),
  orders: z.coerce.number().int().min(0, "Cannot be negative.").max(1_000_000_000),
});

export async function createGigStatAction(input: unknown): Promise<ActionResult> {
  const parsed = gigStatInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.view");
  if (!auth.ok) return { ok: false, error: auth.message };
  if (!auth.actor.permissions.has("fiverr_accounts.manage") && !auth.actor.permissions.has("fiverr_accounts.stats.manage"))
    return { ok: false, error: "You don't have permission to manage gig stats." };

  const result = await createGigStat(auth.actor, parsed.data.gigId, {
    statDate: toDate(parsed.data.statDate),
    impressions: parsed.data.impressions,
    clicks: parsed.data.clicks,
    orders: parsed.data.orders,
  });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/fiverr-accounts/gigs");
  return { ok: true, message: "Stats recorded." };
}

export async function updateGigStatAction(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      statId: uuid,
      impressions: z.coerce.number().int().min(0, "Cannot be negative.").max(1_000_000_000),
      clicks: z.coerce.number().int().min(0, "Cannot be negative.").max(1_000_000_000),
      orders: z.coerce.number().int().min(0, "Cannot be negative.").max(1_000_000_000),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.view");
  if (!auth.ok) return { ok: false, error: auth.message };
  if (!auth.actor.permissions.has("fiverr_accounts.manage") && !auth.actor.permissions.has("fiverr_accounts.stats.manage"))
    return { ok: false, error: "You don't have permission to manage gig stats." };

  const result = await updateGigStat(auth.actor, parsed.data.statId, { impressions: parsed.data.impressions, clicks: parsed.data.clicks, orders: parsed.data.orders });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/fiverr-accounts/gigs");
  return { ok: true, message: "Stats updated." };
}

// ---------------------------------------------------------------------------
// Gig thumbnail image
// ---------------------------------------------------------------------------

export async function setGigThumbnailAction(formData: FormData): Promise<ActionResult> {
  const gigId = formData.get("gigId");
  const file = formData.get("file");
  const parsed = z.object({ gigId: uuid }).safeParse({ gigId });
  if (!parsed.success || !(file instanceof File)) return { ok: false, error: "Choose an image to upload." };

  const auth = await authorizeAction("fiverr_accounts.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await setGigThumbnail(auth.actor, parsed.data.gigId, file);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/fiverr-accounts`);
  return { ok: true, message: "Thumbnail saved." };
}

export async function removeGigThumbnailAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ gigId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await removeGigThumbnail(auth.actor, parsed.data.gigId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/fiverr-accounts`);
  return { ok: true, message: "Thumbnail removed." };
}

export type GigStatsRangeResult = { ok: true; stats: Array<{ date: string; impressions: number; clicks: number; orders: number; id: string }> } | { ok: false; error: string };

export async function getGigStatsForRangeAction(input: unknown): Promise<GigStatsRangeResult> {
  const parsed = z.object({ gigId: uuid, from: dateOnly, to: dateOnly }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.view");
  if (!auth.ok) return { ok: false, error: auth.message };

  const stats = await listGigStatsForRange(parsed.data.gigId, new Date(`${parsed.data.from}T00:00:00.000Z`), new Date(`${parsed.data.to}T00:00:00.000Z`));
  return { ok: true, stats };
}

const bulkStatEntrySchema = z.object({
  statDate: dateOnly,
  impressions: z.coerce.number().int().min(0, "Cannot be negative.").max(1_000_000_000),
  clicks: z.coerce.number().int().min(0, "Cannot be negative.").max(1_000_000_000),
  orders: z.coerce.number().int().min(0, "Cannot be negative.").max(1_000_000_000),
});

export type DeleteGigStatsRangeResult = { ok: true; message: string; deleted: number } | { ok: false; error: string };

export async function deleteGigStatsForRangeAction(input: unknown): Promise<DeleteGigStatsRangeResult> {
  const parsed = z.object({ gigId: uuid, from: dateOnly, to: dateOnly }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.view");
  if (!auth.ok) return { ok: false, error: auth.message };
  if (!auth.actor.permissions.has("fiverr_accounts.manage"))
    return { ok: false, error: "Only admins can delete stats." };

  const result = await deleteGigStatsForRange(
    auth.actor,
    parsed.data.gigId,
    new Date(`${parsed.data.from}T00:00:00.000Z`),
    new Date(`${parsed.data.to}T00:00:00.000Z`),
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/fiverr-accounts/gigs");
  return { ok: true, message: `${result.data.deleted} stat${result.data.deleted !== 1 ? "s" : ""} deleted.`, deleted: result.data.deleted };
}

export type BulkUpsertGigStatsResult = { ok: true; message: string; created: number; updated: number } | { ok: false; error: string };

export async function bulkUpsertGigStatsAction(input: unknown): Promise<BulkUpsertGigStatsResult> {
  const parsed = z.object({ gigId: uuid, entries: z.array(bulkStatEntrySchema).min(1).max(366) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.view");
  if (!auth.ok) return { ok: false, error: auth.message };
  if (!auth.actor.permissions.has("fiverr_accounts.manage") && !auth.actor.permissions.has("fiverr_accounts.stats.manage"))
    return { ok: false, error: "You don't have permission to manage gig stats." };

  const entries = parsed.data.entries.map((e) => ({
    statDate: toDate(e.statDate),
    impressions: e.impressions,
    clicks: e.clicks,
    orders: e.orders,
  }));

  const result = await bulkUpsertGigStats(auth.actor, parsed.data.gigId, entries);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/fiverr-accounts/gigs");
  const { created, updated } = result.data;
  const parts = [];
  if (created > 0) parts.push(`${created} added`);
  if (updated > 0) parts.push(`${updated} updated`);
  return { ok: true, message: parts.join(", ") + ".", created, updated };
}

// ---------------------------------------------------------------------------
// Gmail App Password + email monitoring
// ---------------------------------------------------------------------------

export async function setGmailAppPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ accountId: uuid, appPassword: z.string().min(1, "Enter the App Password.") }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await setGmailAppPassword(auth.actor, parsed.data.accountId, parsed.data.appPassword);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/fiverr-accounts/${parsed.data.accountId}`);
  return { ok: true, message: "Gmail App Password saved." };
}

export type RevealGmailPasswordResult = { ok: true; password: string } | { ok: false; error: string };

export async function revealGmailAppPasswordAction(input: unknown): Promise<RevealGmailPasswordResult> {
  const parsed = z.object({ accountId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.credentials.view");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await revealGmailAppPassword(auth.actor, parsed.data.accountId);
  return result.ok ? { ok: true, password: result.data.password } : { ok: false, error: result.error };
}

export async function clearGmailAppPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ accountId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await clearGmailAppPassword(auth.actor, parsed.data.accountId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/fiverr-accounts/${parsed.data.accountId}`);
  return { ok: true, message: "Gmail App Password removed." };
}

export async function setEmailMonitoringAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ accountId: uuid, enabled: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const result = await setEmailMonitoring(auth.actor, parsed.data.accountId, parsed.data.enabled);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/fiverr-accounts/${parsed.data.accountId}`);
  return { ok: true, message: parsed.data.enabled ? "Email monitoring enabled." : "Email monitoring disabled." };
}

export type TestFetchResult =
  | {
      ok: true;
      emails: Array<{
        messageId: string;
        subject: string;
        date: string;
        textSnippet: string;
        parsed: {
          orderId: string;
          gigTitle: string;
          buyerName: string;
          amount: number;
          deliveryDays: number;
        } | null;
      }>;
    }
  | { ok: false; error: string };

export async function testFetchEmailsAction(input: unknown): Promise<TestFetchResult> {
  const parsed = z
    .object({ accountId: uuid, from: dateOnly, to: dateOnly })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const auth = await authorizeAction("fiverr_accounts.manage");
  if (!auth.ok) return { ok: false, error: auth.message };

  const { prisma: db } = await import("@/lib/db/prisma");
  const account = await db.fiverrAccount.findUnique({
    where: { id: parsed.data.accountId },
    select: { email: true, gmailAppPasswordEncrypted: true },
  });
  if (!account) return { ok: false, error: "Account not found." };
  if (!account.gmailAppPasswordEncrypted) return { ok: false, error: "No Gmail App Password is saved. Set one first." };
  if (!account.email) return { ok: false, error: "No email address is saved on this account." };

  const { decryptSecret } = await import("@/lib/crypto/secret-box");
  let appPassword: string;
  try {
    appPassword = decryptSecret(account.gmailAppPasswordEncrypted);
  } catch {
    return { ok: false, error: "Could not decrypt the saved password." };
  }

  const { fetchFiverrEmailsFromGmail } = await import("@/lib/fiverr-email/imap");
  const { parseFiverrOrderEmail } = await import("@/lib/fiverr-email/parser");

  const since = new Date(`${parsed.data.from}T00:00:00.000Z`);
  const before = new Date(`${parsed.data.to}T23:59:59.999Z`);

  let emails: Awaited<ReturnType<typeof fetchFiverrEmailsFromGmail>>;
  try {
    emails = await fetchFiverrEmailsFromGmail(account.email, appPassword, since, before);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `IMAP connection failed: ${msg}` };
  }

  return {
    ok: true,
    emails: emails.map((e) => {
      const p = parseFiverrOrderEmail(e.subject, e.html, e.text, e.date);
      return {
        messageId: e.messageId,
        subject: e.subject,
        date: e.date.toISOString(),
        textSnippet: e.text.slice(0, 300).replace(/\s+/g, " ").trim(),
        parsed: p
          ? { orderId: p.orderId, gigTitle: p.gigTitle, buyerName: p.buyerName, amount: p.amount, deliveryDays: p.deliveryDays }
          : null,
      };
    }),
  };
}
