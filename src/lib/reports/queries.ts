import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { roundMoney } from "@/lib/finance/money";
import type { Bucket } from "./range";

/**
 * Report queries (specification Section 75).
 *
 * Cost rules, applied to every query in this file:
 *  - Every figure is a database aggregate (`GROUP BY` / `groupBy`), never rows
 *    fetched and summed in JavaScript — the result size is bounded by the number
 *    of buckets, buyers, workers or currencies, not by the number of orders.
 *  - Every query takes a bounded date range (see `./range.ts`) and ranks/limits
 *    its output (`TOP_N`).
 *  - The independent aggregates of one report run in parallel: one round trip
 *    of latency, not the sum (this project's database is a long way from the app).
 *
 * Money rules are Finance's, unchanged: revenue is recognized on delivery and
 * excludes refunded orders (D4); a worker earns an item's cost when it is
 * COMPLETED or CANCELLED (D5); currencies are never summed together (D1).
 */

const TOP_N = 15;
const RECOGNIZED = Prisma.sql`status IN ('DELIVERED', 'COMPLETED') AND refunded = false`;
const RECOGNIZED_WHERE = { status: { in: ["DELIVERED", "COMPLETED"] as ("DELIVERED" | "COMPLETED")[] }, refunded: false };
const EARNED_STATUSES = ["COMPLETED", "CANCELLED"] as ("COMPLETED" | "CANCELLED")[];
const OPEN_STATUSES = ["PENDING", "IN_PROGRESS", "INTERNAL_REVIEW", "REVISION"] as (
  | "PENDING"
  | "IN_PROGRESS"
  | "INTERNAL_REVIEW"
  | "REVISION"
)[];

type Range = { start: Date; end: Date };
export type CurrencyMap = Record<string, number>;

const truncFor = (bucket: Bucket) => Prisma.raw(`'${bucket === "day" ? "day" : bucket === "week" ? "week" : "month"}'`);

function addTo(map: CurrencyMap, currency: string, amount: number) {
  map[currency] = roundMoney((map[currency] ?? 0) + amount);
}

export type PeriodMoneyRow = { period: Date; currency: string; amount: number; count: number };

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export type SalesReport = {
  bucket: Bucket;
  series: PeriodMoneyRow[];
  totalsByCurrency: CurrencyMap;
  orderCount: number;
  /**
   * Ranked by item COUNT, not revenue: since the order-item redesign
   * (confirmed directly 2026-09-27, docs/REQUIREMENTS.md D12) an Order Item
   * carries no price of its own — `Order.totalAmount` is one figure for the
   * whole order — so there is no accurate way to attribute a share of an
   * order's revenue to one of its services. Showing a guessed split would be
   * fabricating a figure, which this codebase does not do.
   */
  topServices: Array<{ serviceId: string; name: string; items: number }>;
};

export async function getSalesReport(range: Range, bucket: Bucket): Promise<SalesReport> {
  const orderRange = { deliveredAt: { gte: range.start, lt: range.end } };

  const [seriesRaw, byService] = await Promise.all([
    prisma.$queryRaw<Array<{ period: Date; currency: string; amount: string; count: number }>>`
      SELECT date_trunc(${truncFor(bucket)}, delivered_at AT TIME ZONE 'UTC') AS period,
             currency, SUM(total_amount)::text AS amount, COUNT(*)::int AS count
      FROM orders
      WHERE ${RECOGNIZED} AND delivered_at >= ${range.start} AND delivered_at < ${range.end}
      GROUP BY 1, 2 ORDER BY 1, 2`,
    prisma.orderItem.groupBy({
      by: ["serviceId"],
      where: { status: { not: "CANCELLED" }, order: { ...RECOGNIZED_WHERE, ...orderRange } },
      _count: true,
    }),
  ]);

  const series = seriesRaw.map((r) => ({ period: r.period, currency: r.currency, amount: Number(r.amount), count: r.count }));
  const totalsByCurrency: CurrencyMap = {};
  let orderCount = 0;
  for (const row of series) {
    addTo(totalsByCurrency, row.currency, row.amount);
    orderCount += row.count;
  }

  const rankedServices = byService
    .map((r) => ({ serviceId: r.serviceId, items: r._count }))
    .sort((a, b) => b.items - a.items)
    .slice(0, TOP_N);

  const services = await prisma.service.findMany({ where: { id: { in: rankedServices.map((s) => s.serviceId) } }, select: { id: true, name: true } });
  const serviceName = new Map(services.map((s) => [s.id, s.name]));

  return {
    bucket,
    series,
    totalsByCurrency,
    orderCount,
    topServices: rankedServices.map((s) => ({ ...s, name: serviceName.get(s.serviceId) ?? "Unknown" })),
  };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export type OrdersReport = {
  bucket: Bucket;
  createdSeries: Array<{ period: Date; count: number }>;
  createdCount: number;
  byStatus: Array<{ status: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
  deliveredCount: number;
  averageHoursToDeliver: number | null;
  onTimeRate: number | null;
  overdueNow: number;
};

export async function getOrdersReport(range: Range, bucket: Bucket): Promise<OrdersReport> {
  const created = { createdAt: { gte: range.start, lt: range.end } };

  const [createdSeries, byStatus, bySource, delivery, overdueNow] = await Promise.all([
    prisma.$queryRaw<Array<{ period: Date; count: number }>>`
      SELECT date_trunc(${truncFor(bucket)}, created_at AT TIME ZONE 'UTC') AS period, COUNT(*)::int AS count
      FROM orders WHERE created_at >= ${range.start} AND created_at < ${range.end}
      GROUP BY 1 ORDER BY 1`,
    prisma.order.groupBy({ by: ["status"], where: created, _count: true }),
    prisma.order.groupBy({ by: ["source"], where: created, _count: true }),
    prisma.$queryRaw<Array<{ delivered: number; avg_seconds: string | null; with_deadline: number; on_time: number }>>`
      SELECT COUNT(*)::int AS delivered,
             AVG(EXTRACT(EPOCH FROM (delivered_at - order_date)))::text AS avg_seconds,
             COUNT(deadline)::int AS with_deadline,
             COUNT(*) FILTER (WHERE deadline IS NOT NULL AND delivered_at <= deadline)::int AS on_time
      FROM orders
      WHERE delivered_at IS NOT NULL AND delivered_at >= ${range.start} AND delivered_at < ${range.end}`,
    prisma.order.count({
      where: { deadline: { lt: new Date() }, status: { notIn: ["DELIVERED", "COMPLETED", "CANCELLED"] } },
    }),
  ]);

  const d = delivery[0];
  return {
    bucket,
    createdSeries,
    createdCount: byStatus.reduce((sum, r) => sum + r._count, 0),
    byStatus: byStatus.map((r) => ({ status: r.status, count: r._count })).sort((a, b) => b.count - a.count),
    bySource: bySource.map((r) => ({ source: r.source, count: r._count })).sort((a, b) => b.count - a.count),
    deliveredCount: d?.delivered ?? 0,
    averageHoursToDeliver: d?.avg_seconds ? Math.round((Number(d.avg_seconds) / 3600) * 10) / 10 : null,
    onTimeRate: d && d.with_deadline > 0 ? Math.round((d.on_time / d.with_deadline) * 100) : null,
    overdueNow,
  };
}

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------

export type WorkerReportRow = {
  key: string;
  kind: "internal" | "outsourced";
  id: string;
  name: string;
  completed: number;
  cancelled: number;
  open: number;
  overdue: number;
  earned: CurrencyMap | null;
  paid: CurrencyMap | null;
  outstanding: CurrencyMap | null;
};

const workerKey = (w: { workerId: string | null; outsourcedWorkerId: string | null }) =>
  w.workerId ? `user:${w.workerId}` : w.outsourcedWorkerId ? `outsourced:${w.outsourcedWorkerId}` : null;

export async function getWorkersReport(range: Range, includeMoney: boolean): Promise<WorkerReportRow[]> {
  const now = new Date();
  const assigned = { OR: [{ workerId: { not: null } }, { outsourcedWorkerId: { not: null } }] };
  const finishedInRange = { finishedAt: { gte: range.start, lt: range.end } };

  const [finished, open, overdue, earnedAll, paidAll, paidRange] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["workerId", "outsourcedWorkerId", "status", "workerCostCurrency"],
      where: { ...assigned, status: { in: EARNED_STATUSES }, ...finishedInRange },
      _count: true,
      _sum: { workerCost: true },
    }),
    prisma.orderItem.groupBy({ by: ["workerId", "outsourcedWorkerId"], where: { ...assigned, status: { in: OPEN_STATUSES } }, _count: true }),
    prisma.orderItem.groupBy({
      by: ["workerId", "outsourcedWorkerId"],
      where: {
        ...assigned,
        status: { in: OPEN_STATUSES },
        OR: [{ deadline: { lt: now } }, { deadline: null, order: { deadline: { lt: now } } }],
      },
      _count: true,
    }),
    includeMoney
      ? prisma.orderItem.groupBy({
          by: ["workerId", "outsourcedWorkerId", "workerCostCurrency"],
          where: { ...assigned, status: { in: EARNED_STATUSES }, workerCost: { not: null } },
          _sum: { workerCost: true },
        })
      : Promise.resolve([]),
    includeMoney ? prisma.workerPayment.groupBy({ by: ["workerId", "outsourcedWorkerId", "currency"], _sum: { amount: true } }) : Promise.resolve([]),
    includeMoney
      ? prisma.workerPayment.groupBy({
          by: ["workerId", "outsourcedWorkerId", "currency"],
          where: { paymentDate: { gte: range.start, lt: range.end } },
          _sum: { amount: true },
        })
      : Promise.resolve([]),
  ]);

  const rows = new Map<string, WorkerReportRow>();
  const ensure = (w: { workerId: string | null; outsourcedWorkerId: string | null }) => {
    const key = workerKey(w);
    if (!key) return null;
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        kind: w.workerId ? "internal" : "outsourced",
        id: (w.workerId ?? w.outsourcedWorkerId) as string,
        name: "",
        completed: 0,
        cancelled: 0,
        open: 0,
        overdue: 0,
        earned: includeMoney ? {} : null,
        paid: includeMoney ? {} : null,
        outstanding: includeMoney ? {} : null,
      };
      rows.set(key, row);
    }
    return row;
  };

  const earnedInRange = new Map<string, CurrencyMap>();
  for (const r of finished) {
    const row = ensure(r);
    if (!row) continue;
    if (r.status === "COMPLETED") row.completed += r._count;
    else row.cancelled += r._count;
    if (includeMoney && r._sum.workerCost) {
      const key = row.key;
      const map = earnedInRange.get(key) ?? {};
      addTo(map, r.workerCostCurrency, Number(r._sum.workerCost));
      earnedInRange.set(key, map);
    }
  }
  for (const r of open) {
    const row = ensure(r);
    if (row) row.open += r._count;
  }
  for (const r of overdue) {
    const row = ensure(r);
    if (row) row.overdue += r._count;
  }

  if (includeMoney) {
    const earnedAllMap = new Map<string, CurrencyMap>();
    const paidAllMap = new Map<string, CurrencyMap>();
    for (const r of earnedAll) {
      const key = workerKey(r);
      if (!key || !r._sum.workerCost) continue;
      const map = earnedAllMap.get(key) ?? {};
      addTo(map, r.workerCostCurrency, Number(r._sum.workerCost));
      earnedAllMap.set(key, map);
    }
    for (const r of paidAll) {
      const key = workerKey(r);
      if (!key || !r._sum.amount) continue;
      const map = paidAllMap.get(key) ?? {};
      addTo(map, r.currency, Number(r._sum.amount));
      paidAllMap.set(key, map);
    }
    const paidRangeMap = new Map<string, CurrencyMap>();
    for (const r of paidRange) {
      const row = ensure(r);
      if (!row || !r._sum.amount) continue;
      const map = paidRangeMap.get(row.key) ?? {};
      addTo(map, r.currency, Number(r._sum.amount));
      paidRangeMap.set(row.key, map);
    }
    for (const row of rows.values()) {
      row.earned = earnedInRange.get(row.key) ?? {};
      row.paid = paidRangeMap.get(row.key) ?? {};
      const eAll = earnedAllMap.get(row.key) ?? {};
      const pAll = paidAllMap.get(row.key) ?? {};
      const out: CurrencyMap = {};
      for (const c of new Set([...Object.keys(eAll), ...Object.keys(pAll)])) out[c] = roundMoney((eAll[c] ?? 0) - (pAll[c] ?? 0));
      row.outstanding = out;
    }
  }

  const internalIds = [...rows.values()].filter((r) => r.kind === "internal").map((r) => r.id);
  const outsourcedIds = [...rows.values()].filter((r) => r.kind === "outsourced").map((r) => r.id);
  const [users, outsourced] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: internalIds } }, select: { id: true, fullName: true } }),
    prisma.outsourcedWorker.findMany({ where: { id: { in: outsourcedIds } }, select: { id: true, name: true } }),
  ]);
  const names = new Map<string, string>([...users.map((u) => [`user:${u.id}`, u.fullName] as const), ...outsourced.map((w) => [`outsourced:${w.id}`, w.name] as const)]);
  for (const row of rows.values()) row.name = names.get(row.key) ?? "Unknown";

  return [...rows.values()].sort((a, b) => b.completed + b.open - (a.completed + a.open) || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export type CustomerReportRow = {
  customerId: string;
  name: string;
  orders: number;
  lastOrderAt: Date | null;
  revenue: CurrencyMap | null;
};

export async function getCustomersReport(range: Range, includeMoney: boolean): Promise<CustomerReportRow[]> {
  const [orders, revenue] = await Promise.all([
    prisma.order.groupBy({
      by: ["customerId"],
      where: { customerId: { not: null }, createdAt: { gte: range.start, lt: range.end } },
      _count: true,
      _max: { orderDate: true },
      orderBy: { _count: { customerId: "desc" } },
      take: 100,
    }),
    includeMoney
      ? prisma.order.groupBy({
          by: ["customerId", "currency"],
          where: { ...RECOGNIZED_WHERE, customerId: { not: null }, deliveredAt: { gte: range.start, lt: range.end } },
          _sum: { totalAmount: true },
        })
      : Promise.resolve([]),
  ]);

  const ids = orders.flatMap((o) => (o.customerId ? [o.customerId] : []));
  const customers = await prisma.customer.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const info = new Map(customers.map((c) => [c.id, c]));

  const revenueOf = new Map<string, CurrencyMap>();
  for (const r of revenue) {
    if (!r.customerId) continue;
    const m = revenueOf.get(r.customerId) ?? {};
    addTo(m, r.currency, Number(r._sum.totalAmount ?? 0));
    revenueOf.set(r.customerId, m);
  }

  return orders.flatMap((o) =>
    o.customerId
      ? [
          {
            customerId: o.customerId,
            name: info.get(o.customerId)?.name ?? "Unknown",
            orders: o._count,
            lastOrderAt: o._max.orderDate,
            revenue: includeMoney ? (revenueOf.get(o.customerId) ?? {}) : null,
          },
        ]
      : [],
  );
}

// ---------------------------------------------------------------------------
// Profit
// ---------------------------------------------------------------------------

export type ProfitPeriodRow = {
  period: Date;
  revenue: CurrencyMap;
  workerCost: CurrencyMap;
  expenses: CurrencyMap;
  /** Only when every currency present in the period is the same one — otherwise costs in another currency are not netted (D1). */
  net: CurrencyMap | null;
};

export async function getProfitReport(range: Range, bucket: Bucket): Promise<{ bucket: Bucket; rows: ProfitPeriodRow[] }> {
  const [revenue, cost, expenses] = await Promise.all([
    prisma.$queryRaw<Array<{ period: Date; currency: string; amount: string }>>`
      SELECT date_trunc(${truncFor(bucket)}, delivered_at AT TIME ZONE 'UTC') AS period, currency, SUM(total_amount)::text AS amount
      FROM orders WHERE ${RECOGNIZED} AND delivered_at >= ${range.start} AND delivered_at < ${range.end}
      GROUP BY 1, 2`,
    prisma.$queryRaw<Array<{ period: Date; currency: string; amount: string }>>`
      SELECT date_trunc(${truncFor(bucket)}, finished_at AT TIME ZONE 'UTC') AS period, worker_cost_currency AS currency, SUM(worker_cost)::text AS amount
      FROM order_items
      WHERE status IN ('COMPLETED', 'CANCELLED') AND outsourced_worker_id IS NOT NULL AND worker_cost IS NOT NULL
        AND finished_at >= ${range.start} AND finished_at < ${range.end}
      GROUP BY 1, 2`,
    prisma.$queryRaw<Array<{ period: Date; currency: string; amount: string }>>`
      SELECT date_trunc(${truncFor(bucket)}, "date"::timestamp) AS period, currency, SUM(amount)::text AS amount
      FROM expenses WHERE "date" >= ${range.start} AND "date" < ${range.end}
      GROUP BY 1, 2`,
  ]);

  const periods = new Map<number, ProfitPeriodRow>();
  const rowFor = (period: Date) => {
    const key = period.getTime();
    let row = periods.get(key);
    if (!row) {
      row = { period, revenue: {}, workerCost: {}, expenses: {}, net: null };
      periods.set(key, row);
    }
    return row;
  };
  for (const r of revenue) addTo(rowFor(r.period).revenue, r.currency, Number(r.amount));
  for (const r of cost) addTo(rowFor(r.period).workerCost, r.currency, Number(r.amount));
  for (const r of expenses) addTo(rowFor(r.period).expenses, r.currency, Number(r.amount));

  for (const row of periods.values()) {
    const currencies = new Set([...Object.keys(row.revenue), ...Object.keys(row.workerCost), ...Object.keys(row.expenses)]);
    if (currencies.size === 1) {
      const [c] = [...currencies];
      row.net = { [c]: roundMoney((row.revenue[c] ?? 0) - (row.workerCost[c] ?? 0) - (row.expenses[c] ?? 0)) };
    }
  }
  return { bucket, rows: [...periods.values()].sort((a, b) => a.period.getTime() - b.period.getTime()) };
}

// ---------------------------------------------------------------------------
// Overview totals (expenses, worker payments)
// ---------------------------------------------------------------------------

export async function getMoneyMovementTotals(range: Range): Promise<{
  expenses: CurrencyMap;
  workerPayments: CurrencyMap;
}> {
  const [expenses, workerPayments] = await Promise.all([
    prisma.expense.groupBy({ by: ["currency"], where: { date: { gte: range.start, lt: range.end } }, _sum: { amount: true } }),
    prisma.workerPayment.groupBy({ by: ["currency"], where: { paymentDate: { gte: range.start, lt: range.end } }, _sum: { amount: true } }),
  ]);
  const toMap = (rows: Array<{ currency: string; _sum: { amount: Prisma.Decimal | null } }>) => {
    const map: CurrencyMap = {};
    for (const r of rows) addTo(map, r.currency, Number(r._sum.amount ?? 0));
    return map;
  };
  return { expenses: toMap(expenses), workerPayments: toMap(workerPayments) };
}
