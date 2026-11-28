import "server-only";

import { randomUUID } from "node:crypto";

import { recordAudit } from "@/lib/audit/record";
import type { Actor } from "@/lib/auth/session";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret-box";
import { prisma } from "@/lib/db/prisma";
import {
  runTransaction,
  ServiceRejection,
  serviceFailure as failure,
  type ServiceResult,
} from "@/lib/db/transaction";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sniffImage } from "@/lib/categories/images";
import { optimizeCategoryImage } from "@/lib/categories/optimize";
import { GIG_THUMBNAIL_BUCKET, GIG_THUMBNAIL_MAX_BYTES, gigThumbnailUrl, pathFromGigThumbnailUrl } from "./thumbnail";

export type { ServiceResult };

/**
 * Fiverr account and gig write operations (confirmed directly, 2026-09-27).
 *
 * The PayPal password, if given, is encrypted before it is ever written —
 * `paypalPasswordEncrypted` never holds plain text (src/lib/crypto/secret-box.ts).
 * `newValue`/`previousValue` on the audit row never includes it either, even
 * encrypted: an audit entry is not the place for a credential blob, encrypted
 * or not.
 */

export type FiverrAccountInput = {
  name: string;
  email?: string;
  paypalEmail?: string;
  /** Undefined = leave unchanged; empty string = clear it; otherwise a new password to encrypt. */
  paypalPassword?: string;
};

function normalize(input: FiverrAccountInput) {
  return {
    name: input.name.trim(),
    email: input.email?.trim() || null,
    paypalEmail: input.paypalEmail?.trim() || null,
  };
}

export async function createFiverrAccount(
  actor: Actor,
  input: FiverrAccountInput,
): Promise<ServiceResult<{ id: string }>> {
  const data = normalize(input);
  if (!data.name) return failure("Give the account a name.");

  let paypalPasswordEncrypted: string | null = null;
  if (input.paypalPassword) {
    try {
      paypalPasswordEncrypted = encryptSecret(input.paypalPassword);
    } catch (error) {
      return failure((error as Error).message);
    }
  }

  return runTransaction(async (tx) => {
    const account = await tx.fiverrAccount.create({
      data: { ...data, paypalPasswordEncrypted },
      select: { id: true },
    });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "fiverr_account.created",
      entityType: "FiverrAccount",
      entityId: account.id,
      summary: `Added Fiverr account ${data.name}`,
      newValue: { name: data.name, email: data.email, paypalEmail: data.paypalEmail },
    });

    return { id: account.id };
  });
}

export async function updateFiverrAccount(
  actor: Actor,
  accountId: string,
  input: FiverrAccountInput,
): Promise<ServiceResult> {
  const data = normalize(input);
  if (!data.name) return failure("Give the account a name.");

  let passwordUpdate: { paypalPasswordEncrypted?: string | null } = {};
  if (input.paypalPassword !== undefined) {
    if (input.paypalPassword === "") {
      passwordUpdate = { paypalPasswordEncrypted: null };
    } else {
      try {
        passwordUpdate = { paypalPasswordEncrypted: encryptSecret(input.paypalPassword) };
      } catch (error) {
        return failure((error as Error).message);
      }
    }
  }

  return runTransaction(async (tx) => {
    const existing = await tx.fiverrAccount.findUnique({ where: { id: accountId }, select: { name: true } });
    if (!existing) throw new ServiceRejection("That account no longer exists.");

    await tx.fiverrAccount.update({ where: { id: accountId }, data: { ...data, ...passwordUpdate } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "fiverr_account.updated",
      entityType: "FiverrAccount",
      entityId: accountId,
      summary: `Updated Fiverr account ${data.name}`,
      previousValue: { name: existing.name },
      newValue: { name: data.name, email: data.email, paypalEmail: data.paypalEmail },
    });
  });
}

export async function setFiverrAccountActive(actor: Actor, accountId: string, isActive: boolean): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const account = await tx.fiverrAccount.findUnique({ where: { id: accountId }, select: { name: true, isActive: true } });
    if (!account) throw new ServiceRejection("That account no longer exists.");
    if (account.isActive === isActive) {
      throw new ServiceRejection(`${account.name} is already ${isActive ? "active" : "inactive"}.`);
    }

    await tx.fiverrAccount.update({ where: { id: accountId }, data: { isActive } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: isActive ? "fiverr_account.reactivated" : "fiverr_account.deactivated",
      entityType: "FiverrAccount",
      entityId: accountId,
      summary: `${isActive ? "Reactivated" : "Deactivated"} Fiverr account ${account.name}`,
    });
  });
}

/**
 * Decrypts and returns the PayPal password for one reveal — the caller
 * (the action) must gate this on `fiverr_accounts.credentials.view` before
 * calling. Writes an audit row every time, since revealing a credential is
 * itself a sensitive event worth a trail, distinct from viewing the account.
 */
export async function revealFiverrPaypalPassword(actor: Actor, accountId: string): Promise<ServiceResult<{ password: string }>> {
  const account = await prisma.fiverrAccount.findUnique({
    where: { id: accountId },
    select: { name: true, paypalPasswordEncrypted: true },
  });
  if (!account) return failure("That account no longer exists.");
  if (!account.paypalPasswordEncrypted) return failure("No PayPal password is saved for this account.");

  let password: string;
  try {
    password = decryptSecret(account.paypalPasswordEncrypted);
  } catch {
    return failure("Could not decrypt the saved password.");
  }

  await recordAudit(prisma, {
    actorUserId: actor.user.id,
    actorEmail: actor.user.email,
    action: "fiverr_account.credentials_revealed",
    entityType: "FiverrAccount",
    entityId: accountId,
    summary: `${actor.user.fullName} revealed the PayPal password for ${account.name}`,
  });

  return { ok: true, data: { password } };
}

// ---------------------------------------------------------------------------
// Gmail App Password + email monitoring
// ---------------------------------------------------------------------------

export async function setGmailAppPassword(
  actor: Actor,
  accountId: string,
  appPassword: string,
): Promise<ServiceResult> {
  const account = await prisma.fiverrAccount.findUnique({ where: { id: accountId }, select: { name: true } });
  if (!account) return failure("That account no longer exists.");

  let encrypted: string;
  try {
    encrypted = encryptSecret(appPassword.trim());
  } catch (err) {
    return failure(err instanceof Error ? err.message : "Encryption failed.");
  }

  await prisma.fiverrAccount.update({ where: { id: accountId }, data: { gmailAppPasswordEncrypted: encrypted } });
  await recordAudit(prisma, {
    actorUserId: actor.user.id,
    actorEmail: actor.user.email,
    action: "fiverr_account.gmail_password_set",
    entityType: "FiverrAccount",
    entityId: accountId,
    summary: `${actor.user.fullName} set the Gmail App Password for ${account.name}`,
  });
  return { ok: true, data: undefined };
}

export async function revealGmailAppPassword(
  actor: Actor,
  accountId: string,
): Promise<ServiceResult<{ password: string }>> {
  const account = await prisma.fiverrAccount.findUnique({
    where: { id: accountId },
    select: { name: true, gmailAppPasswordEncrypted: true },
  });
  if (!account) return failure("That account no longer exists.");
  if (!account.gmailAppPasswordEncrypted) return failure("No Gmail App Password is saved for this account.");

  let password: string;
  try {
    password = decryptSecret(account.gmailAppPasswordEncrypted);
  } catch {
    return failure("Could not decrypt the saved password.");
  }

  await recordAudit(prisma, {
    actorUserId: actor.user.id,
    actorEmail: actor.user.email,
    action: "fiverr_account.gmail_password_revealed",
    entityType: "FiverrAccount",
    entityId: accountId,
    summary: `${actor.user.fullName} revealed the Gmail App Password for ${account.name}`,
  });
  return { ok: true, data: { password } };
}

export async function clearGmailAppPassword(actor: Actor, accountId: string): Promise<ServiceResult> {
  const account = await prisma.fiverrAccount.findUnique({ where: { id: accountId }, select: { name: true } });
  if (!account) return failure("That account no longer exists.");

  await prisma.fiverrAccount.update({
    where: { id: accountId },
    data: { gmailAppPasswordEncrypted: null, emailMonitoringEnabled: false },
  });
  await recordAudit(prisma, {
    actorUserId: actor.user.id,
    actorEmail: actor.user.email,
    action: "fiverr_account.gmail_password_cleared",
    entityType: "FiverrAccount",
    entityId: accountId,
    summary: `${actor.user.fullName} cleared the Gmail App Password for ${account.name}`,
  });
  return { ok: true, data: undefined };
}

export async function setEmailMonitoring(
  actor: Actor,
  accountId: string,
  enabled: boolean,
): Promise<ServiceResult> {
  const account = await prisma.fiverrAccount.findUnique({
    where: { id: accountId },
    select: { name: true, gmailAppPasswordEncrypted: true, emailMonitoringSince: true },
  });
  if (!account) return failure("That account no longer exists.");
  if (enabled && !account.gmailAppPasswordEncrypted) {
    return failure("Set a Gmail App Password before enabling monitoring.");
  }

  // Set emailMonitoringSince only the first time it is enabled.
  const emailMonitoringSince = enabled && !account.emailMonitoringSince ? new Date() : undefined;

  await prisma.fiverrAccount.update({
    where: { id: accountId },
    data: { emailMonitoringEnabled: enabled, ...(emailMonitoringSince ? { emailMonitoringSince } : {}) },
  });
  await recordAudit(prisma, {
    actorUserId: actor.user.id,
    actorEmail: actor.user.email,
    action: enabled ? "fiverr_account.monitoring_enabled" : "fiverr_account.monitoring_disabled",
    entityType: "FiverrAccount",
    entityId: accountId,
    summary: `${actor.user.fullName} ${enabled ? "enabled" : "disabled"} email monitoring for ${account.name}`,
  });
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Gigs
// ---------------------------------------------------------------------------

export type GigInput = { name: string };

export async function createGig(actor: Actor, fiverrAccountId: string, input: GigInput): Promise<ServiceResult<{ id: string }>> {
  const name = input.name.trim();
  if (!name) return failure("Give the gig a name.");

  return runTransaction(async (tx) => {
    const account = await tx.fiverrAccount.findUnique({ where: { id: fiverrAccountId }, select: { name: true } });
    if (!account) throw new ServiceRejection("That Fiverr account no longer exists.");

    const gig = await tx.fiverrGig.create({ data: { fiverrAccountId, name }, select: { id: true } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "fiverr_gig.created",
      entityType: "FiverrGig",
      entityId: gig.id,
      summary: `Added gig "${name}" to ${account.name}`,
      newValue: { name, fiverrAccountId },
    });

    return { id: gig.id };
  });
}

export async function updateGig(actor: Actor, gigId: string, input: GigInput): Promise<ServiceResult> {
  const name = input.name.trim();
  if (!name) return failure("Give the gig a name.");

  return runTransaction(async (tx) => {
    const existing = await tx.fiverrGig.findUnique({ where: { id: gigId }, select: { name: true } });
    if (!existing) throw new ServiceRejection("That gig no longer exists.");

    await tx.fiverrGig.update({ where: { id: gigId }, data: { name } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "fiverr_gig.updated",
      entityType: "FiverrGig",
      entityId: gigId,
      summary: `Renamed gig "${existing.name}" to "${name}"`,
      previousValue: { name: existing.name },
      newValue: { name },
    });
  });
}

export async function setGigActive(actor: Actor, gigId: string, isActive: boolean): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const gig = await tx.fiverrGig.findUnique({ where: { id: gigId }, select: { name: true, isActive: true } });
    if (!gig) throw new ServiceRejection("That gig no longer exists.");
    if (gig.isActive === isActive) throw new ServiceRejection(`${gig.name} is already ${isActive ? "active" : "inactive"}.`);

    await tx.fiverrGig.update({ where: { id: gigId }, data: { isActive } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: isActive ? "fiverr_gig.reactivated" : "fiverr_gig.deactivated",
      entityType: "FiverrGig",
      entityId: gigId,
      summary: `${isActive ? "Reactivated" : "Deactivated"} gig ${gig.name}`,
    });
  });
}

// ---------------------------------------------------------------------------
// Gig daily stats — same "reject a duplicate day" rule as DailyStat (D10)
// ---------------------------------------------------------------------------

export type GigStatInput = { statDate: Date; impressions: number; clicks: number; orders: number };

function validateStat(input: GigStatInput): string | undefined {
  if (input.impressions < 0 || input.clicks < 0 || input.orders < 0) return "Counts cannot be negative.";
}

export async function createGigStat(actor: Actor, gigId: string, input: GigStatInput): Promise<ServiceResult<{ id: string }>> {
  const problem = validateStat(input);
  if (problem) return failure(problem);

  return runTransaction(async (tx) => {
    const gig = await tx.fiverrGig.findUnique({ where: { id: gigId }, select: { name: true } });
    if (!gig) throw new ServiceRejection("That gig no longer exists.");

    const clash = await tx.fiverrGigStat.findUnique({
      where: { gigId_statDate: { gigId, statDate: input.statDate } },
      select: { id: true },
    });
    if (clash) throw new ServiceRejection(`${gig.name} already has an entry for this date — edit it instead.`);

    const stat = await tx.fiverrGigStat.create({
      data: { gigId, statDate: input.statDate, impressions: input.impressions, clicks: input.clicks, orders: input.orders, createdById: actor.user.id },
      select: { id: true },
    });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "fiverr_gig_stat.created",
      entityType: "FiverrGig",
      entityId: gigId,
      summary: `Recorded ${gig.name}'s stats for ${input.statDate.toISOString().slice(0, 10)}: ${input.impressions} impressions, ${input.clicks} clicks, ${input.orders} orders`,
      newValue: { statDate: input.statDate.toISOString().slice(0, 10), impressions: input.impressions, clicks: input.clicks, orders: input.orders },
    });

    return { id: stat.id };
  });
}

export async function updateGigStat(actor: Actor, statId: string, input: Omit<GigStatInput, "statDate">): Promise<ServiceResult> {
  const problem = validateStat({ ...input, statDate: new Date() });
  if (problem) return failure(problem);

  return runTransaction(async (tx) => {
    const existing = await tx.fiverrGigStat.findUnique({
      where: { id: statId },
      select: { impressions: true, clicks: true, orders: true, statDate: true, gig: { select: { name: true } } },
    });
    if (!existing) throw new ServiceRejection("That entry no longer exists.");

    await tx.fiverrGigStat.update({ where: { id: statId }, data: { impressions: input.impressions, clicks: input.clicks, orders: input.orders } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "fiverr_gig_stat.updated",
      entityType: "FiverrGig",
      entityId: statId,
      summary: `Edited ${existing.gig.name}'s stats for ${existing.statDate.toISOString().slice(0, 10)}`,
      previousValue: { impressions: existing.impressions, clicks: existing.clicks, orders: existing.orders },
      newValue: { impressions: input.impressions, clicks: input.clicks, orders: input.orders },
    });
  });
}

// ---------------------------------------------------------------------------
// Gig thumbnail image — stored in Supabase Storage bucket "fiverr-gig-thumbnails"
// ---------------------------------------------------------------------------

const STORAGE_NOT_READY =
  'Image storage isn\'t set up yet. In Supabase, create a public Storage bucket named "fiverr-gig-thumbnails".';

/** Uploads (or replaces) a gig's thumbnail. The file is checked by bytes, compressed to WebP, then stored. */
export async function setGigThumbnail(actor: Actor, gigId: string, file: File): Promise<ServiceResult<{ thumbnailUrl: string }>> {
  if (file.size === 0) return failure("Choose an image to upload.");
  if (file.size > GIG_THUMBNAIL_MAX_BYTES) return failure("That image is larger than 8 MB. Choose a smaller one.");

  const original = new Uint8Array(await file.arrayBuffer());
  if (!sniffImage(original)) return failure("Use a PNG, JPEG or WebP image.");

  const optimized = await optimizeCategoryImage(original);
  if (!optimized.ok) return failure(optimized.error);

  const gig = await prisma.fiverrGig.findUnique({ where: { id: gigId }, select: { name: true, thumbnailUrl: true } });
  if (!gig) return failure("That gig no longer exists.");

  let storage: ReturnType<ReturnType<typeof createSupabaseAdminClient>["storage"]["from"]>;
  try {
    storage = createSupabaseAdminClient().storage.from(GIG_THUMBNAIL_BUCKET);
  } catch {
    return failure("Supabase administrative access is not configured.");
  }

  const path = `${gigId}/${randomUUID()}.webp`;
  const upload = await storage.upload(path, optimized.bytes, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (upload.error) {
    return failure(/bucket not found/i.test(upload.error.message) ? STORAGE_NOT_READY : `Upload failed: ${upload.error.message}`);
  }

  const url = gigThumbnailUrl(path);
  if (!url) return failure("Supabase URL is not configured.");

  const prevPath = gig.thumbnailUrl ? pathFromGigThumbnailUrl(gig.thumbnailUrl) : null;

  const result = await runTransaction(async (tx) => {
    await tx.fiverrGig.update({ where: { id: gigId }, data: { thumbnailUrl: url } });
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "fiverr_gig.thumbnail_updated",
      entityType: "FiverrGig",
      entityId: gigId,
      summary: `${prevPath ? "Replaced" : "Added"} thumbnail for gig ${gig.name}`,
      newValue: { path, bytes: optimized.bytes.length },
    });
    return { thumbnailUrl: url };
  });

  if (!result.ok) {
    await storage.remove([path]).catch(() => {});
    return result;
  }
  if (prevPath) await storage.remove([prevPath]).catch(() => {});
  return result;
}

/** Removes a gig's thumbnail (file and reference). */
export async function removeGigThumbnail(actor: Actor, gigId: string): Promise<ServiceResult> {
  const gig = await prisma.fiverrGig.findUnique({ where: { id: gigId }, select: { name: true, thumbnailUrl: true } });
  if (!gig) return failure("That gig no longer exists.");
  if (!gig.thumbnailUrl) return { ok: true, data: undefined };

  const result = await runTransaction(async (tx) => {
    await tx.fiverrGig.update({ where: { id: gigId }, data: { thumbnailUrl: null } });
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "fiverr_gig.thumbnail_removed",
      entityType: "FiverrGig",
      entityId: gigId,
      summary: `Removed thumbnail for gig ${gig.name}`,
    });
  });

  if (result.ok && gig.thumbnailUrl) {
    const path = pathFromGigThumbnailUrl(gig.thumbnailUrl);
    if (path) {
      try {
        await createSupabaseAdminClient().storage.from(GIG_THUMBNAIL_BUCKET).remove([path]);
      } catch {
        // Leftover file is harmless.
      }
    }
  }
  return result;
}

export type BulkGigStatEntry = { statDate: Date; impressions: number; clicks: number; orders: number };

/** Upsert multiple days at once — creates rows that don't exist yet, updates existing ones. */
export async function bulkUpsertGigStats(actor: Actor, gigId: string, entries: BulkGigStatEntry[]): Promise<ServiceResult<{ created: number; updated: number }>> {
  if (entries.length === 0) return { ok: true, data: { created: 0, updated: 0 } };
  for (const entry of entries) {
    const problem = validateStat(entry);
    if (problem) return failure(problem);
  }

  return runTransaction(async (tx) => {
    const gig = await tx.fiverrGig.findUnique({ where: { id: gigId }, select: { name: true } });
    if (!gig) throw new ServiceRejection("That gig no longer exists.");

    let created = 0;
    let updated = 0;

    for (const entry of entries) {
      const existing = await tx.fiverrGigStat.findUnique({
        where: { gigId_statDate: { gigId, statDate: entry.statDate } },
        select: { id: true },
      });

      if (existing) {
        await tx.fiverrGigStat.update({
          where: { id: existing.id },
          data: { impressions: entry.impressions, clicks: entry.clicks, orders: entry.orders },
        });
        updated++;
      } else {
        await tx.fiverrGigStat.create({
          data: { gigId, statDate: entry.statDate, impressions: entry.impressions, clicks: entry.clicks, orders: entry.orders, createdById: actor.user.id },
        });
        created++;
      }
    }

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "fiverr_gig_stat.bulk_upserted",
      entityType: "FiverrGig",
      entityId: gigId,
      summary: `Bulk-updated ${gig.name}: ${created} created, ${updated} updated`,
      newValue: { created, updated, entries: entries.length },
    });

    return { created, updated };
  });
}

export async function deleteGigStatsForRange(actor: Actor, gigId: string, from: Date, to: Date): Promise<ServiceResult<{ deleted: number }>> {
  return runTransaction(async (tx) => {
    const gig = await tx.fiverrGig.findUnique({ where: { id: gigId }, select: { name: true } });
    if (!gig) throw new ServiceRejection("That gig no longer exists.");

    const result = await tx.fiverrGigStat.deleteMany({
      where: { gigId, statDate: { gte: from, lte: to } },
    });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "fiverr_gig_stat.range_deleted",
      entityType: "FiverrGig",
      entityId: gigId,
      summary: `Deleted ${result.count} stat(s) for ${gig.name}`,
      newValue: { deleted: result.count, from: from.toISOString(), to: to.toISOString() },
    });

    return { deleted: result.count };
  });
}
