import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { roundMoney, sumByCurrency } from "./money";

/**
 * Read queries for Finance (specification Sections 48, 56-61).
 *
 * The financial-truth principle (Section 57/61): nothing here reads a stored
 * "balance"/"outstanding" field, because none exists. Every summary is
 * computed fresh from `Order`/`OrderItem`/`WorkerPayment` —
 * "totals derived from transaction history," per the specification, never a
 * second number that could disagree with it. Buyer (and BuyerPayment with it)
 * was removed entirely post-Phase-10 (2026-09-27, owner-directed) — revenue
 * has always read `Order.totalAmount`/`deliveredAt` directly and never
 * depended on it.
 *
 * Revenue recognition (D4): an order counts once `status` is DELIVERED or
 * COMPLETED (DELIVERED is the recognition point; COMPLETED necessarily
 * passed through it) and `refunded` is false.
 *
 * Worker earning (D5): an Order Item's `workerCost` counts once its status
 * is COMPLETED or CANCELLED — a cancelled item with no work done simply has
 * `workerCost` left at 0/null and contributes nothing; one with partial work
 * has whatever the admin adjusted it to. Only OUTSOURCED-worker items
 * represent a real cash cost (internal staff are salaried, not paid
 * per-item — see `prisma/schema/catalog.prisma`'s header comment).
 */

const REVENUE_RECOGNIZED_STATUSES = ["DELIVERED", "COMPLETED"] as const;
const EARNED_ITEM_STATUSES = ["COMPLETED", "CANCELLED"] as const;

export const FINANCE_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

// ---------------------------------------------------------------------------
// Expense categories
// ---------------------------------------------------------------------------

export type ExpenseCategoryRow = { id: string; name: string; slug: string; isActive: boolean; expenseCount: number };

export async function listExpenseCategories(includeInactive = false): Promise<ExpenseCategoryRow[]> {
  const rows = await prisma.expenseCategory.findMany({
    where: includeInactive ? {} : { isActive: true },
    select: { id: true, name: true, slug: true, isActive: true, _count: { select: { expenses: true } } },
    orderBy: { name: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    isActive: row.isActive,
    expenseCount: row._count.expenses,
  }));
}

export async function listAssignableExpenseCategories(): Promise<Array<{ id: string; name: string }>> {
  return prisma.expenseCategory.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export type ExpenseRow = {
  id: string;
  amount: string;
  currency: string;
  categoryId: string;
  categoryName: string;
  date: Date;
  description: string | null;
  orderId: string | null;
  orderNumber: number | null;
  paidByName: string | null;
  notes: string | null;
  createdByName: string;
};

export type ExpenseListFilters = {
  page?: number;
  pageSize?: number;
  categoryId?: string;
  orderId?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

export type ExpenseListResult = {
  rows: ExpenseRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

function expenseSelect() {
  return {
    id: true,
    amount: true,
    currency: true,
    categoryId: true,
    category: { select: { name: true } },
    date: true,
    description: true,
    orderId: true,
    order: { select: { orderNumber: true } },
    paidBy: { select: { fullName: true } },
    notes: true,
    createdBy: { select: { fullName: true } },
  } as const;
}

function mapExpense(row: {
  id: string;
  amount: Prisma.Decimal;
  currency: string;
  categoryId: string;
  category: { name: string };
  date: Date;
  description: string | null;
  orderId: string | null;
  order: { orderNumber: number } | null;
  paidBy: { fullName: string } | null;
  notes: string | null;
  createdBy: { fullName: string };
}): ExpenseRow {
  return {
    id: row.id,
    amount: row.amount.toString(),
    currency: row.currency,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    date: row.date,
    description: row.description,
    orderId: row.orderId,
    orderNumber: row.order?.orderNumber ?? null,
    paidByName: row.paidBy?.fullName ?? null,
    notes: row.notes,
    createdByName: row.createdBy.fullName,
  };
}

export async function listExpenses(filters: ExpenseListFilters): Promise<ExpenseListResult> {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(filters.pageSize ?? FINANCE_PAGE_SIZE)));

  const where: Prisma.ExpenseWhereInput = {
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.orderId ? { orderId: filters.orderId } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? { date: { ...(filters.dateFrom ? { gte: filters.dateFrom } : {}), ...(filters.dateTo ? { lte: filters.dateTo } : {}) } }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      select: expenseSelect(),
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    rows: rows.map(mapExpense),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getExpense(id: string): Promise<ExpenseRow | null> {
  const row = await prisma.expense.findUnique({ where: { id }, select: expenseSelect() });
  return row ? mapExpense(row) : null;
}

/** Every expense tied to one order — for that order's cost breakdown. */
export async function listExpensesForOrder(orderId: string): Promise<ExpenseRow[]> {
  const rows = await prisma.expense.findMany({
    where: { orderId },
    select: expenseSelect(),
    orderBy: { date: "asc" },
  });
  return rows.map(mapExpense);
}

// ---------------------------------------------------------------------------
// Worker payments
// ---------------------------------------------------------------------------

export type WorkerPaymentRow = {
  id: string;
  workerId: string | null;
  outsourcedWorkerId: string | null;
  workerName: string;
  amount: string;
  currency: string;
  paymentDate: Date;
  reference: string | null;
  notes: string | null;
  createdByName: string;
};

export type WorkerPaymentListFilters = {
  page?: number;
  pageSize?: number;
  workerId?: string;
  outsourcedWorkerId?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

function workerPaymentSelect() {
  return {
    id: true,
    workerId: true,
    outsourcedWorkerId: true,
    worker: { select: { fullName: true } },
    outsourcedWorker: { select: { name: true } },
    amount: true,
    currency: true,
    paymentDate: true,
    reference: true,
    notes: true,
    createdBy: { select: { fullName: true } },
  } as const;
}

function mapWorkerPayment(row: {
  id: string;
  workerId: string | null;
  outsourcedWorkerId: string | null;
  worker: { fullName: string } | null;
  outsourcedWorker: { name: string } | null;
  amount: Prisma.Decimal;
  currency: string;
  paymentDate: Date;
  reference: string | null;
  notes: string | null;
  createdBy: { fullName: string };
}): WorkerPaymentRow {
  return {
    id: row.id,
    workerId: row.workerId,
    outsourcedWorkerId: row.outsourcedWorkerId,
    workerName: row.worker?.fullName ?? row.outsourcedWorker?.name ?? "—",
    amount: row.amount.toString(),
    currency: row.currency,
    paymentDate: row.paymentDate,
    reference: row.reference,
    notes: row.notes,
    createdByName: row.createdBy.fullName,
  };
}

export async function listWorkerPayments(filters: WorkerPaymentListFilters): Promise<{
  rows: WorkerPaymentRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}> {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(filters.pageSize ?? FINANCE_PAGE_SIZE)));

  const where: Prisma.WorkerPaymentWhereInput = {
    ...(filters.workerId ? { workerId: filters.workerId } : {}),
    ...(filters.outsourcedWorkerId ? { outsourcedWorkerId: filters.outsourcedWorkerId } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          paymentDate: {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: filters.dateTo } : {}),
          },
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.workerPayment.count({ where }),
    prisma.workerPayment.findMany({
      where,
      select: workerPaymentSelect(),
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    rows: rows.map(mapWorkerPayment),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getWorkerPayment(id: string): Promise<WorkerPaymentRow | null> {
  const row = await prisma.workerPayment.findUnique({ where: { id }, select: workerPaymentSelect() });
  return row ? mapWorkerPayment(row) : null;
}

/**
 * A worker's earned/paid/outstanding (specification Section 58's "Worker
 * summary"). `workerId` XOR `outsourcedWorkerId` — same shape as everywhere
 * else this pair appears.
 */
export async function getWorkerEarnings(worker: { workerId?: string; outsourcedWorkerId?: string }): Promise<{
  earnedByCurrency: Record<string, number>;
  paidByCurrency: Record<string, number>;
  outstandingByCurrency: Record<string, number>;
}> {
  const itemWhere: Prisma.OrderItemWhereInput = worker.workerId
    ? { workerId: worker.workerId }
    : { outsourcedWorkerId: worker.outsourcedWorkerId };
  const paymentWhere: Prisma.WorkerPaymentWhereInput = worker.workerId
    ? { workerId: worker.workerId }
    : { outsourcedWorkerId: worker.outsourcedWorkerId };

  const [items, payments] = await Promise.all([
    prisma.orderItem.findMany({
      where: { ...itemWhere, status: { in: [...EARNED_ITEM_STATUSES] }, workerCost: { not: null } },
      select: { workerCost: true, workerCostCurrency: true },
    }),
    prisma.workerPayment.findMany({ where: paymentWhere, select: { amount: true, currency: true } }),
  ]);

  const earnedByCurrency = sumByCurrency(
    items.map((item) => ({ amount: Number(item.workerCost), currency: item.workerCostCurrency })),
  );
  const paidByCurrency = sumByCurrency(payments.map((p) => ({ amount: Number(p.amount), currency: p.currency })));

  const outstandingByCurrency: Record<string, number> = {};
  for (const currency of new Set([...Object.keys(earnedByCurrency), ...Object.keys(paidByCurrency)])) {
    outstandingByCurrency[currency] = roundMoney((earnedByCurrency[currency] ?? 0) - (paidByCurrency[currency] ?? 0));
  }

  return { earnedByCurrency, paidByCurrency, outstandingByCurrency };
}

// ---------------------------------------------------------------------------
// Revenue, cost, expense and profit summaries
// ---------------------------------------------------------------------------

export type FinanceSummary = {
  revenueByCurrency: Record<string, number>;
  workerCostByCurrency: Record<string, number>;
  expensesByCurrency: Record<string, number>;
  /** Only populated for a currency where revenue, worker cost AND expenses all appear — see the file header. */
  profitByCurrency: Record<string, number>;
  recognizedOrderCount: number;
};

/** The Finance Overview's headline numbers for a date range, by `deliveredAt`. */
export async function getFinanceSummary(range: { start: Date; end: Date }): Promise<FinanceSummary> {
  const [orders, outsourcedItems, expenses] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { in: [...REVENUE_RECOGNIZED_STATUSES] },
        refunded: false,
        deliveredAt: { gte: range.start, lt: range.end },
      },
      select: { totalAmount: true, currency: true },
    }),
    prisma.orderItem.findMany({
      where: {
        status: { in: [...EARNED_ITEM_STATUSES] },
        outsourcedWorkerId: { not: null },
        workerCost: { not: null },
        finishedAt: { gte: range.start, lt: range.end },
      },
      select: { workerCost: true, workerCostCurrency: true },
    }),
    prisma.expense.findMany({
      where: { date: { gte: range.start, lt: range.end } },
      select: { amount: true, currency: true },
    }),
  ]);

  const revenueByCurrency = sumByCurrency(orders.map((o) => ({ amount: Number(o.totalAmount), currency: o.currency })));
  const workerCostByCurrency = sumByCurrency(
    outsourcedItems.map((i) => ({ amount: Number(i.workerCost), currency: i.workerCostCurrency })),
  );
  const expensesByCurrency = sumByCurrency(expenses.map((e) => ({ amount: Number(e.amount), currency: e.currency })));

  const profitByCurrency: Record<string, number> = {};
  for (const currency of Object.keys(revenueByCurrency)) {
    profitByCurrency[currency] = roundMoney(
      revenueByCurrency[currency] - (workerCostByCurrency[currency] ?? 0) - (expensesByCurrency[currency] ?? 0),
    );
  }

  return { revenueByCurrency, workerCostByCurrency, expensesByCurrency, profitByCurrency, recognizedOrderCount: orders.length };
}

export type RecognizedOrderRow = {
  id: string;
  orderNumber: number;
  totalAmount: string;
  currency: string;
  deliveredAt: Date | null;
  customerName: string | null;
};

const RECOGNIZED_ORDERS_CAP = 200;

/** Orders recognized as revenue in a range (specification Section 56), for the Revenue page's list. */
export async function listRecognizedOrders(range: { start: Date; end: Date }): Promise<RecognizedOrderRow[]> {
  const orders = await prisma.order.findMany({
    where: {
      status: { in: [...REVENUE_RECOGNIZED_STATUSES] },
      refunded: false,
      deliveredAt: { gte: range.start, lt: range.end },
    },
    select: {
      id: true,
      orderNumber: true,
      totalAmount: true,
      currency: true,
      deliveredAt: true,
      customer: { select: { name: true } },
    },
    orderBy: { deliveredAt: "desc" },
    take: RECOGNIZED_ORDERS_CAP,
  });

  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount.toString(),
    currency: order.currency,
    deliveredAt: order.deliveredAt,
    customerName: order.customer?.name ?? null,
  }));
}

export type OrderProfitRow = {
  id: string;
  orderNumber: number;
  revenue: string;
  currency: string;
  workerCost: number;
  expenses: number;
  /** Only set when worker cost + expenses happen to share the revenue currency. */
  profit: number | null;
};

/**
 * Per-order profit rows for a range (specification Section 56's "Selling
 * Amount - Worker Cost - Other Cost = Order Profit"), via a couple of bulk
 * queries rather than one round trip per order.
 */
export async function listOrderProfitRows(range: { start: Date; end: Date }): Promise<OrderProfitRow[]> {
  const orders = await listRecognizedOrders(range);
  if (orders.length === 0) return [];
  const orderIds = orders.map((o) => o.id);

  const [itemGroups, expenseGroups] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["orderId", "workerCostCurrency"],
      where: {
        orderId: { in: orderIds },
        outsourcedWorkerId: { not: null },
        status: { in: [...EARNED_ITEM_STATUSES] },
        workerCost: { not: null },
      },
      _sum: { workerCost: true },
    }),
    prisma.expense.groupBy({
      by: ["orderId", "currency"],
      where: { orderId: { in: orderIds } },
      _sum: { amount: true },
    }),
  ]);

  const workerCostByOrder = new Map<string, Record<string, number>>();
  for (const group of itemGroups) {
    if (!group.orderId) continue;
    const byCurrency = workerCostByOrder.get(group.orderId) ?? {};
    byCurrency[group.workerCostCurrency] = roundMoney((byCurrency[group.workerCostCurrency] ?? 0) + Number(group._sum.workerCost ?? 0));
    workerCostByOrder.set(group.orderId, byCurrency);
  }

  const expensesByOrder = new Map<string, Record<string, number>>();
  for (const group of expenseGroups) {
    if (!group.orderId) continue;
    const byCurrency = expensesByOrder.get(group.orderId) ?? {};
    byCurrency[group.currency] = roundMoney((byCurrency[group.currency] ?? 0) + Number(group._sum.amount ?? 0));
    expensesByOrder.set(group.orderId, byCurrency);
  }

  return orders.map((order) => {
    const workerCostByCurrency = workerCostByOrder.get(order.id) ?? {};
    const expensesByCurrency = expensesByOrder.get(order.id) ?? {};
    const workerCost = workerCostByCurrency[order.currency] ?? 0;
    const expenses = expensesByCurrency[order.currency] ?? 0;
    const hasOtherCurrencyCosts =
      Object.keys(workerCostByCurrency).some((c) => c !== order.currency) ||
      Object.keys(expensesByCurrency).some((c) => c !== order.currency);

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      revenue: order.totalAmount,
      currency: order.currency,
      workerCost,
      expenses,
      profit: hasOtherCurrencyCosts ? null : roundMoney(Number(order.totalAmount) - workerCost - expenses),
    };
  });
}

export type OrderFinancials = {
  orderId: string;
  orderNumber: number;
  revenue: { amount: string; currency: string; recognized: boolean } | null;
  workerCostByCurrency: Record<string, number>;
  expensesByCurrency: Record<string, number>;
  profitByCurrency: Record<string, number>;
};

/** One order's Selling Amount / Worker Cost / Other Cost breakdown (specification Section 56). */
export async function getOrderFinancials(orderId: string): Promise<OrderFinancials | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true,
      status: true,
      refunded: true,
      totalAmount: true,
      currency: true,
      items: { select: { workerCost: true, workerCostCurrency: true, outsourcedWorkerId: true, status: true } },
      expenses: { select: { amount: true, currency: true } },
    },
  });
  if (!order) return null;

  const recognized = REVENUE_RECOGNIZED_STATUSES.includes(order.status as (typeof REVENUE_RECOGNIZED_STATUSES)[number]) && !order.refunded;

  const workerCostByCurrency = sumByCurrency(
    order.items
      .filter((item) => item.outsourcedWorkerId && item.workerCost && EARNED_ITEM_STATUSES.includes(item.status as (typeof EARNED_ITEM_STATUSES)[number]))
      .map((item) => ({ amount: Number(item.workerCost), currency: item.workerCostCurrency })),
  );
  const expensesByCurrency = sumByCurrency(order.expenses.map((e) => ({ amount: Number(e.amount), currency: e.currency })));

  const profitByCurrency: Record<string, number> = {};
  if (recognized) {
    const revenueCurrency = order.currency;
    profitByCurrency[revenueCurrency] = roundMoney(
      Number(order.totalAmount) - (workerCostByCurrency[revenueCurrency] ?? 0) - (expensesByCurrency[revenueCurrency] ?? 0),
    );
  }

  return {
    orderId,
    orderNumber: order.orderNumber,
    revenue: { amount: order.totalAmount.toString(), currency: order.currency, recognized },
    workerCostByCurrency,
    expensesByCurrency,
    profitByCurrency,
  };
}
