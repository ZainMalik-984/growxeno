import "server-only";

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

export type GigStatInput = { statDate: Date; impressions: number; clicks: number };

function validateStat(input: GigStatInput): string | undefined {
  if (input.impressions < 0 || input.clicks < 0) return "Counts cannot be negative.";
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
      data: { gigId, statDate: input.statDate, impressions: input.impressions, clicks: input.clicks, createdById: actor.user.id },
      select: { id: true },
    });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "fiverr_gig_stat.created",
      entityType: "FiverrGig",
      entityId: gigId,
      summary: `Recorded ${gig.name}'s stats for ${input.statDate.toISOString().slice(0, 10)}: ${input.impressions} impressions, ${input.clicks} clicks`,
      newValue: { statDate: input.statDate.toISOString().slice(0, 10), impressions: input.impressions, clicks: input.clicks },
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
      select: { impressions: true, clicks: true, statDate: true, gig: { select: { name: true } } },
    });
    if (!existing) throw new ServiceRejection("That entry no longer exists.");

    await tx.fiverrGigStat.update({ where: { id: statId }, data: { impressions: input.impressions, clicks: input.clicks } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "fiverr_gig_stat.updated",
      entityType: "FiverrGig",
      entityId: statId,
      summary: `Edited ${existing.gig.name}'s stats for ${existing.statDate.toISOString().slice(0, 10)}`,
      previousValue: { impressions: existing.impressions, clicks: existing.clicks },
      newValue: { impressions: input.impressions, clicks: input.clicks },
    });
  });
}
