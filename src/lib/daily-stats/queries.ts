import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Read queries for Daily Statistics (specification Sections 51-55).
 *
 * Manually entered, never derived from Orders (Section 51) — every query here
 * reads the `daily_stats` table only, and never joins against `orders` to
 * "fill in" a number.
 */

export const DAILY_STATS_PAGE_SIZE = 31;
export const MAX_PAGE_SIZE = 100;

export type DailyStatScope = { mode: "ALL" } | { mode: "OWN"; userId: string };

export type DailyStatListFilters = {
  page?: number;
  pageSize?: number;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

export type DailyStatRow = {
  id: string;
  userId: string;
  userName: string;
  statDate: Date;
  orders: number;
  completed: number;
  pending: number;
  revenue: string;
  revenueCurrency: string;
  notes: string | null;
  createdByName: string;
  updatedAt: Date;
};

export type DailyStatListResult = {
  rows: DailyStatRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

function scopeFilter(scope: DailyStatScope): Prisma.DailyStatWhereInput {
  return scope.mode === "OWN" ? { userId: scope.userId } : {};
}

function buildWhere(
  filters: Pick<DailyStatListFilters, "userId" | "dateFrom" | "dateTo">,
  scope: DailyStatScope,
): Prisma.DailyStatWhereInput {
  return {
    ...scopeFilter(scope),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          statDate: {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: filters.dateTo } : {}),
          },
        }
      : {}),
  };
}

export async function listDailyStats(
  filters: DailyStatListFilters,
  scope: DailyStatScope,
): Promise<DailyStatListResult> {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(filters.pageSize ?? DAILY_STATS_PAGE_SIZE)));

  const where = buildWhere(filters, scope);

  const [total, rows] = await Promise.all([
    prisma.dailyStat.count({ where }),
    prisma.dailyStat.findMany({
      where,
      select: {
        id: true,
        userId: true,
        statDate: true,
        orders: true,
        completed: true,
        pending: true,
        revenue: true,
        revenueCurrency: true,
        notes: true,
        updatedAt: true,
        user: { select: { fullName: true } },
        createdBy: { select: { fullName: true } },
      },
      orderBy: [{ statDate: "desc" }, { user: { fullName: "asc" } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      userName: row.user.fullName,
      statDate: row.statDate,
      orders: row.orders,
      completed: row.completed,
      pending: row.pending,
      revenue: row.revenue.toString(),
      revenueCurrency: row.revenueCurrency,
      notes: row.notes,
      createdByName: row.createdBy.fullName,
      updatedAt: row.updatedAt,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

const EXPORT_ROW_CAP = 10_000;

/**
 * Unpaginated rows for CSV export (specification Section 53's "Export"),
 * same filters and scope as the list view. Bounded rather than truly
 * unlimited — a business at this scale will never approach the cap, and an
 * unbounded export is exactly the "minimum resource usage" (Section 35)
 * requirement this codebase otherwise holds to everywhere else.
 */
export async function listDailyStatsForExport(
  filters: Pick<DailyStatListFilters, "userId" | "dateFrom" | "dateTo">,
  scope: DailyStatScope,
): Promise<DailyStatRow[]> {
  const rows = await prisma.dailyStat.findMany({
    where: buildWhere(filters, scope),
    select: {
      id: true,
      userId: true,
      statDate: true,
      orders: true,
      completed: true,
      pending: true,
      revenue: true,
      revenueCurrency: true,
      notes: true,
      updatedAt: true,
      user: { select: { fullName: true } },
      createdBy: { select: { fullName: true } },
    },
    orderBy: [{ statDate: "desc" }, { user: { fullName: "asc" } }],
    take: EXPORT_ROW_CAP,
  });

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    userName: row.user.fullName,
    statDate: row.statDate,
    orders: row.orders,
    completed: row.completed,
    pending: row.pending,
    revenue: row.revenue.toString(),
    revenueCurrency: row.revenueCurrency,
    notes: row.notes,
    createdByName: row.createdBy.fullName,
    updatedAt: row.updatedAt,
  }));
}

export async function getDailyStat(id: string): Promise<DailyStatRow | null> {
  const row = await prisma.dailyStat.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      statDate: true,
      orders: true,
      completed: true,
      pending: true,
      revenue: true,
      revenueCurrency: true,
      notes: true,
      updatedAt: true,
      user: { select: { fullName: true } },
      createdBy: { select: { fullName: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    userName: row.user.fullName,
    statDate: row.statDate,
    orders: row.orders,
    completed: row.completed,
    pending: row.pending,
    revenue: row.revenue.toString(),
    revenueCurrency: row.revenueCurrency,
    notes: row.notes,
    createdByName: row.createdBy.fullName,
    updatedAt: row.updatedAt,
  };
}

/** One row per (user, date) already recorded for a given date — used by the bulk-entry form. */
export async function listDailyStatsForDate(
  statDate: Date,
  scope: DailyStatScope,
): Promise<Map<string, DailyStatRow>> {
  const rows = await prisma.dailyStat.findMany({
    where: { statDate, ...scopeFilter(scope) },
    select: {
      id: true,
      userId: true,
      statDate: true,
      orders: true,
      completed: true,
      pending: true,
      revenue: true,
      revenueCurrency: true,
      notes: true,
      updatedAt: true,
      user: { select: { fullName: true } },
      createdBy: { select: { fullName: true } },
    },
  });
  return new Map(
    rows.map((row) => [
      row.userId,
      {
        id: row.id,
        userId: row.userId,
        userName: row.user.fullName,
        statDate: row.statDate,
        orders: row.orders,
        completed: row.completed,
        pending: row.pending,
        revenue: row.revenue.toString(),
        revenueCurrency: row.revenueCurrency,
        notes: row.notes,
        createdByName: row.createdBy.fullName,
        updatedAt: row.updatedAt,
      },
    ]),
  );
}

export type DailyTotal = {
  date: string;
  orders: number;
  completed: number;
  pending: number;
  /** Keyed by currency — never blended (docs/REQUIREMENTS.md D1). */
  revenueByCurrency: Record<string, number>;
};

/**
 * Day-by-day totals for a bounded date range, for the range summary /
 * charts (specification Section 55). One bounded query, aggregated in
 * memory — the row count for any of the supported ranges (today/7/30/90
 * days, or a custom range) stays small for this business's scale.
 */
export async function getDailyStatsRangeTotals(
  range: { start: Date; end: Date },
  scope: DailyStatScope,
): Promise<DailyTotal[]> {
  const rows = await prisma.dailyStat.findMany({
    where: { statDate: { gte: range.start, lte: range.end }, ...scopeFilter(scope) },
    select: { statDate: true, orders: true, completed: true, pending: true, revenue: true, revenueCurrency: true },
    orderBy: { statDate: "asc" },
  });

  const byDate = new Map<string, DailyTotal>();
  for (const row of rows) {
    const key = row.statDate.toISOString().slice(0, 10);
    const existing = byDate.get(key) ?? { date: key, orders: 0, completed: 0, pending: 0, revenueByCurrency: {} };
    existing.orders += row.orders;
    existing.completed += row.completed;
    existing.pending += row.pending;
    existing.revenueByCurrency[row.revenueCurrency] =
      (existing.revenueByCurrency[row.revenueCurrency] ?? 0) + Number(row.revenue);
    byDate.set(key, existing);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Per-user totals for a range — the "user comparison" view (Section 55). */
export type UserTotal = {
  userId: string;
  userName: string;
  orders: number;
  completed: number;
  pending: number;
  revenueByCurrency: Record<string, number>;
};

export async function getDailyStatsUserTotals(
  range: { start: Date; end: Date },
  scope: DailyStatScope,
): Promise<UserTotal[]> {
  const rows = await prisma.dailyStat.findMany({
    where: { statDate: { gte: range.start, lte: range.end }, ...scopeFilter(scope) },
    select: {
      userId: true,
      orders: true,
      completed: true,
      pending: true,
      revenue: true,
      revenueCurrency: true,
      user: { select: { fullName: true } },
    },
  });

  const byUser = new Map<string, UserTotal>();
  for (const row of rows) {
    const existing = byUser.get(row.userId) ?? {
      userId: row.userId,
      userName: row.user.fullName,
      orders: 0,
      completed: 0,
      pending: 0,
      revenueByCurrency: {},
    };
    existing.orders += row.orders;
    existing.completed += row.completed;
    existing.pending += row.pending;
    existing.revenueByCurrency[row.revenueCurrency] =
      (existing.revenueByCurrency[row.revenueCurrency] ?? 0) + Number(row.revenue);
    byUser.set(row.userId, existing);
  }
  return [...byUser.values()].sort((a, b) => a.userName.localeCompare(b.userName));
}
