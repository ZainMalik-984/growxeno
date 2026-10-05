import "server-only";

import { recordAudit } from "@/lib/audit/record";
import type { Actor } from "@/lib/auth/session";
import {
  runTransaction,
  ServiceRejection,
  serviceFailure as failure,
  type ServiceResult,
} from "@/lib/db/transaction";

export type { ServiceResult };

/**
 * Daily Statistics write operations (specification Sections 51-53).
 *
 * Every number here is exactly what the caller typed — never computed from
 * Orders (Section 51). The only business rule enforced is the unique
 * (user, date) constraint (docs/REQUIREMENTS.md D10): a second entry for a
 * day already recorded is refused with a clear message, not silently
 * overwritten or summed.
 */

const statDateKey = (date: Date) => date.toISOString().slice(0, 10);

export type DailyStatInput = {
  userId: string;
  statDate: Date;
  orders: number;
  completed: number;
  pending: number;
  revenue: string;
  revenueCurrency: string;
  notes?: string;
};

function validate(input: { orders: number; completed: number; pending: number }): string | undefined {
  if (input.orders < 0 || input.completed < 0 || input.pending < 0) return "Counts cannot be negative.";
  if (input.completed > input.orders) return "Completed cannot exceed total orders.";
}

export async function createDailyStat(
  actor: Actor,
  input: DailyStatInput,
): Promise<ServiceResult<{ id: string }>> {
  const problem = validate(input);
  if (problem) return failure(problem);

  return runTransaction(async (tx) => {
    const clash = await tx.dailyStat.findUnique({
      where: { userId_statDate: { userId: input.userId, statDate: input.statDate } },
      select: { id: true },
    });
    if (clash) {
      throw new ServiceRejection(
        "This user already has an entry for this date. Edit it instead of creating another.",
      );
    }

    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { fullName: true } });
    if (!user) throw new ServiceRejection("That user no longer exists.");

    const stat = await tx.dailyStat.create({
      data: {
        userId: input.userId,
        statDate: input.statDate,
        orders: input.orders,
        completed: input.completed,
        pending: input.pending,
        revenue: input.revenue,
        revenueCurrency: input.revenueCurrency,
        notes: input.notes?.trim() || null,
        createdById: actor.user.id,
      },
      select: { id: true },
    });

    const summary = `Recorded daily stats for ${user.fullName} on ${statDateKey(input.statDate)}`;
    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "daily_stat.created",
      entityType: "DailyStat",
      entityId: stat.id,
      summary,
      newValue: { ...input, statDate: statDateKey(input.statDate) },
    });

    return { id: stat.id };
  });
}

export async function updateDailyStat(
  actor: Actor,
  id: string,
  input: DailyStatInput,
): Promise<ServiceResult> {
  const problem = validate(input);
  if (problem) return failure(problem);

  return runTransaction(async (tx) => {
    const existing = await tx.dailyStat.findUnique({
      where: { id },
      select: {
        userId: true,
        statDate: true,
        orders: true,
        completed: true,
        pending: true,
        revenue: true,
        revenueCurrency: true,
        notes: true,
        user: { select: { fullName: true } },
      },
    });
    if (!existing) throw new ServiceRejection("That entry no longer exists.");

    const userOrDateChanged =
      existing.userId !== input.userId || existing.statDate.getTime() !== input.statDate.getTime();
    if (userOrDateChanged) {
      const clash = await tx.dailyStat.findUnique({
        where: { userId_statDate: { userId: input.userId, statDate: input.statDate } },
        select: { id: true },
      });
      if (clash) {
        throw new ServiceRejection("This user already has an entry for this date.");
      }
    }

    await tx.dailyStat.update({
      where: { id },
      data: {
        userId: input.userId,
        statDate: input.statDate,
        orders: input.orders,
        completed: input.completed,
        pending: input.pending,
        revenue: input.revenue,
        revenueCurrency: input.revenueCurrency,
        notes: input.notes?.trim() || null,
      },
    });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "daily_stat.updated",
      entityType: "DailyStat",
      entityId: id,
      summary: `Updated daily stats for ${existing.user.fullName} on ${statDateKey(existing.statDate)}`,
      previousValue: {
        userId: existing.userId,
        statDate: statDateKey(existing.statDate),
        orders: existing.orders,
        completed: existing.completed,
        pending: existing.pending,
        revenue: existing.revenue.toString(),
        revenueCurrency: existing.revenueCurrency,
        notes: existing.notes,
      },
      newValue: { ...input, statDate: statDateKey(input.statDate) },
    });
  });
}

export async function deleteDailyStat(actor: Actor, id: string): Promise<ServiceResult> {
  return runTransaction(async (tx) => {
    const existing = await tx.dailyStat.findUnique({
      where: { id },
      select: { statDate: true, user: { select: { fullName: true } } },
    });
    if (!existing) throw new ServiceRejection("That entry no longer exists.");

    await tx.dailyStat.delete({ where: { id } });

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "daily_stat.deleted",
      entityType: "DailyStat",
      entityId: id,
      summary: `Deleted daily stats for ${existing.user.fullName} on ${statDateKey(existing.statDate)}`,
    });
  });
}

export type BulkDailyStatEntry = {
  userId: string;
  orders: number;
  completed: number;
  pending: number;
  revenue: string;
  revenueCurrency: string;
  notes?: string;
};

/**
 * Enter or update several users' rows for one date in a single transaction
 * (specification Section 53's "Bulk entry", Section 54's "without opening
 * many separate pages"). Upserts: a user who already has a row for this
 * date gets it updated, not rejected — bulk entry is meant to be fast, and
 * re-submitting the same table is the expected edit flow.
 */
export async function bulkUpsertDailyStats(
  actor: Actor,
  statDate: Date,
  entries: readonly BulkDailyStatEntry[],
): Promise<ServiceResult<{ count: number }>> {
  for (const entry of entries) {
    const problem = validate(entry);
    if (problem) return failure(`${problem} (check every row)`);
  }

  return runTransaction(async (tx) => {
    for (const entry of entries) {
      await tx.dailyStat.upsert({
        where: { userId_statDate: { userId: entry.userId, statDate } },
        create: {
          userId: entry.userId,
          statDate,
          orders: entry.orders,
          completed: entry.completed,
          pending: entry.pending,
          revenue: entry.revenue,
          revenueCurrency: entry.revenueCurrency,
          notes: entry.notes?.trim() || null,
          createdById: actor.user.id,
        },
        update: {
          orders: entry.orders,
          completed: entry.completed,
          pending: entry.pending,
          revenue: entry.revenue,
          revenueCurrency: entry.revenueCurrency,
          notes: entry.notes?.trim() || null,
        },
      });
    }

    await recordAudit(tx, {
      actorUserId: actor.user.id,
      actorEmail: actor.user.email,
      action: "daily_stat.bulk_entered",
      entityType: "DailyStat",
      summary: `Bulk-entered daily stats for ${entries.length} ${entries.length === 1 ? "user" : "users"} on ${statDateKey(statDate)}`,
      newValue: { statDate: statDateKey(statDate), userIds: entries.map((e) => e.userId) },
    });

    return { count: entries.length };
  });
}

/**
 * Copies every row from the previous calendar day onto `targetDate`, for
 * whichever users do not already have a row there (specification Section
 * 53's "Copy previous day") — never overwrites an existing target-day entry.
 */
export async function copyPreviousDay(
  actor: Actor,
  targetDate: Date,
): Promise<ServiceResult<{ copied: number; skipped: number }>> {
  const previousDate = new Date(targetDate.getTime() - 24 * 60 * 60 * 1000);

  return runTransaction(async (tx) => {
    const [previousRows, existingTargetRows] = await Promise.all([
      tx.dailyStat.findMany({ where: { statDate: previousDate } }),
      tx.dailyStat.findMany({ where: { statDate: targetDate }, select: { userId: true } }),
    ]);

    const alreadyPresent = new Set(existingTargetRows.map((row) => row.userId));
    const toCopy = previousRows.filter((row) => !alreadyPresent.has(row.userId));

    for (const row of toCopy) {
      await tx.dailyStat.create({
        data: {
          userId: row.userId,
          statDate: targetDate,
          orders: row.orders,
          completed: row.completed,
          pending: row.pending,
          revenue: row.revenue,
          revenueCurrency: row.revenueCurrency,
          notes: row.notes,
          createdById: actor.user.id,
        },
      });
    }

    if (toCopy.length > 0) {
      await recordAudit(tx, {
        actorUserId: actor.user.id,
        actorEmail: actor.user.email,
        action: "daily_stat.copied_previous_day",
        entityType: "DailyStat",
        summary: `Copied ${toCopy.length} ${toCopy.length === 1 ? "entry" : "entries"} from ${statDateKey(previousDate)} to ${statDateKey(targetDate)}`,
        newValue: { fromDate: statDateKey(previousDate), toDate: statDateKey(targetDate), userIds: toCopy.map((r) => r.userId) },
      });
    }

    return { copied: toCopy.length, skipped: previousRows.length - toCopy.length };
  });
}
