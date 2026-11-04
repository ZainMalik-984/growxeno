import "server-only";

import type { OrderItemStatus, OrderSource, OrderStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { ServiceMetricType } from "@/lib/services/metric-type";
import { assignedItemWhere, type AssignmentIdentity } from "./assignment";
import { thisWeekRangeUtc, todayRangeUtc } from "./date-ranges";

/**
 * Read queries for Orders (specification Sections 26–34), documented in full
 * in docs/ORDERS.md §8.
 *
 * All filtering and searching happens in PostgreSQL — never "fetch everything
 * and filter in JavaScript" (Section 31). Combined item-level predicates
 * (service + worker together, say) are folded into ONE `items: { some: {} }`
 * clause so they match the SAME item, not two different ones on the same
 * order — a deliberate semantic choice, not an oversight.
 */

export const ORDERS_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export type OrderScope = { mode: "ALL" } | ({ mode: "ASSIGNED" } & AssignmentIdentity);

export type OrderListFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: OrderStatus;
  source?: OrderSource;
  customerId?: string;
  workerId?: string;
  outsourcedWorkerId?: string;
  serviceId?: string;
  categoryId?: string;
  assigned?: "1" | "0";
  overdue?: boolean;
  dueToday?: boolean;
  dueThisWeek?: boolean;
  hasLinks?: boolean;
  linkQuery?: string;
  amountMin?: string;
  amountMax?: string;
};

/**
 * Confirmed directly, 2026-10-05: "on the orders list page each row for
 * order should have progress bar and percentage... and each row would be a
 * dropdown and dropdown would show the order item, who its assigned to and
 * progress." `workerId` travels alongside `worker` purely for
 * `redactOrderListItems` (src/lib/orders/visibility.ts) to compare against
 * the viewing actor — it is never rendered itself.
 */
export type OrderListItemRow = {
  id: string;
  orderId: string;
  serviceName: string;
  metricType: ServiceMetricType | null;
  workerId: string | null;
  worker: { id: string; fullName: string } | null;
  outsourcedWorker: { id: string; name: string } | null;
  currentCount: number | null;
  targetCount: number | null;
  /** The snapshot taken at creation — see the schema doc comment. Feeds `aggregateProgress`, never rendered directly. */
  startingCount: number | null;
  status: OrderItemStatus;
  /** The worker's deadline for this item. */
  deadline: Date | null;
  /** The client's channel (metric services only). */
  channelLink: string | null;
  /** What the assigned worker is paid. Redacted by redactOrderListItems. */
  workerCost: string | null;
  workerCostCurrency: string;
};

export type OrderListRow = {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  source: OrderSource;
  customerName: string | null;
  deadline: Date | null;
  totalAmount: string;
  currency: string;
  itemCount: number;
  items: OrderListItemRow[];
  createdAt: Date;
};

export type OrderListResult = {
  rows: OrderListRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

// Closed = delivered, finalized or refunded/cancelled (2026-11-03 rework). A
// Completed order still has to be delivered, so it is still open.
const DONE_STATUSES: OrderStatus[] = ["DELIVERED", "FINALIZED", "CANCELLED"];

/**
 * The WHERE clause behind the orders list: scope (an ASSIGNED actor only ever
 * matches orders holding one of their items) plus every list filter. Shared by
 * `listOrders` and `countOrdersByStatus` so the status-tab counts can never
 * disagree with the rows, or count orders the actor may not see.
 */
function buildOrderListWhere(
  filters: OrderListFilters,
  scope: OrderScope,
  options: { ignoreStatus?: boolean } = {},
): Prisma.OrderWhereInput {
  const itemFilter: Prisma.OrderItemWhereInput = {};
  if (filters.serviceId) itemFilter.serviceId = filters.serviceId;
  if (filters.categoryId) itemFilter.categoryId = filters.categoryId;
  if (filters.workerId) itemFilter.workerId = filters.workerId;
  if (filters.outsourcedWorkerId) itemFilter.outsourcedWorkerId = filters.outsourcedWorkerId;
  if (filters.linkQuery) {
    const q = filters.linkQuery.trim();
    itemFilter.links = {
      some: {
        OR: [
          { normalizedUrl: { contains: q, mode: "insensitive" } },
          { domain: { contains: q, mode: "insensitive" } },
        ],
      },
    };
  }
  if (filters.hasLinks) itemFilter.links = { ...itemFilter.links, some: { ...itemFilter.links?.some } };
  const hasItemFilter = Object.keys(itemFilter).length > 0;

  const and: Prisma.OrderWhereInput[] = [];
  if (hasItemFilter) and.push({ items: { some: itemFilter } });
  if (scope.mode === "ASSIGNED") and.push({ items: { some: assignedItemWhere(scope) } });

  if (filters.status && !options.ignoreStatus) and.push({ status: filters.status });
  if (filters.source) and.push({ source: filters.source });
  if (filters.customerId) and.push({ customerId: filters.customerId });

  if (filters.assigned === "1") {
    and.push({ items: { some: { OR: [{ workerId: { not: null } }, { outsourcedWorkerId: { not: null } }] } } });
  } else if (filters.assigned === "0") {
    and.push({ items: { none: { OR: [{ workerId: { not: null } }, { outsourcedWorkerId: { not: null } }] } } });
  }

  // A worker's deadlines are their own items' deadlines, never the order's
  // (owner request, 2026-11-03 — see visibility.ts), so the date filters
  // match on those for an ASSIGNED actor.
  const deadlineMatch = (range: Prisma.DateTimeNullableFilter): Prisma.OrderWhereInput =>
    scope.mode === "ASSIGNED" ? { items: { some: { ...assignedItemWhere(scope), deadline: range } } } : { deadline: range };
  if (filters.overdue) {
    and.push({ ...deadlineMatch({ lt: new Date() }), status: { notIn: DONE_STATUSES } });
  }
  if (filters.dueToday) {
    const { start, end } = todayRangeUtc();
    and.push(deadlineMatch({ gte: start, lt: end }));
  }
  if (filters.dueThisWeek) {
    const { start, end } = thisWeekRangeUtc();
    and.push(deadlineMatch({ gte: start, lt: end }));
  }

  if (filters.amountMin) and.push({ totalAmount: { gte: filters.amountMin } });
  if (filters.amountMax) and.push({ totalAmount: { lte: filters.amountMax } });

  const search = filters.search?.trim();
  if (search) {
    const numeric = /^\d+$/.test(search) ? Number(search) : undefined;
    and.push({
      OR: [
        ...(numeric !== undefined ? [{ orderNumber: numeric }] : []),
        // Searching a field is a way of reading it: a worker (ASSIGNED scope)
        // may not see an order's reference, notes or customer, so their search
        // never matches on them (2026-11-03).
        ...(scope.mode === "ASSIGNED"
          ? []
          : [
              { externalReference: { contains: search, mode: "insensitive" as const } },
              { notes: { contains: search, mode: "insensitive" as const } },
              { customer: { name: { contains: search, mode: "insensitive" as const } } },
            ]),
        {
          items: {
            some: {
              OR: [
                { description: { contains: search, mode: "insensitive" } },
                { service: { name: { contains: search, mode: "insensitive" } } },
                { category: { name: { contains: search, mode: "insensitive" } } },
                { worker: { fullName: { contains: search, mode: "insensitive" } } },
                { outsourcedWorker: { name: { contains: search, mode: "insensitive" } } },
                {
                  links: {
                    some: {
                      OR: [
                        { url: { contains: search, mode: "insensitive" } },
                        { domain: { contains: search, mode: "insensitive" } },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

/**
 * Order counts per status for the Orders page tabs: every current filter
 * EXCEPT status itself (so each tab says how many it would show), within the
 * same scope as the list.
 */
export async function countOrdersByStatus(
  filters: OrderListFilters,
  scope: OrderScope,
): Promise<{ total: number; byStatus: Partial<Record<OrderStatus, number>> }> {
  const groups = await prisma.order.groupBy({
    by: ["status"],
    where: buildOrderListWhere(filters, scope, { ignoreStatus: true }),
    _count: { _all: true },
  });
  const byStatus: Partial<Record<OrderStatus, number>> = {};
  let total = 0;
  for (const group of groups) {
    byStatus[group.status] = group._count._all;
    total += group._count._all;
  }
  return { total, byStatus };
}

export async function listOrders(
  filters: OrderListFilters,
  scope: OrderScope,
): Promise<OrderListResult> {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(filters.pageSize ?? ORDERS_PAGE_SIZE)));

  const where = buildOrderListWhere(filters, scope);

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        source: true,
        deadline: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        customer: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // A second, FLAT query rather than nesting `items` (with ITS worker/
  // outsourcedWorker) inside the `order.findMany` above — Prisma's
  // driver-adapter query engine issues one extra sequential round trip per
  // relation LEVEL on a nested select, not per row, which only pays off once
  // for a page load (unlike the per-navigation cost that drove the same
  // choice in getCurrentActor(), src/lib/auth/session.ts). Still nests one
  // level (service/worker/outsourcedWorker) — acceptable here.
  const orderIds = orders.map((order) => order.id);
  const items = orderIds.length
    ? await prisma.orderItem.findMany({
        where: { orderId: { in: orderIds } },
        select: {
          id: true,
          orderId: true,
          currentCount: true,
          targetCount: true,
          startingCount: true,
          status: true,
          deadline: true,
          channelLink: true,
          workerCost: true,
          workerCostCurrency: true,
          service: { select: { name: true, metricType: true } },
          worker: { select: { id: true, fullName: true } },
          outsourcedWorker: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const itemsByOrderId = new Map<string, OrderListItemRow[]>();
  for (const item of items) {
    const row: OrderListItemRow = {
      id: item.id,
      orderId: item.orderId,
      serviceName: item.service.name,
      metricType: item.service.metricType,
      workerId: item.worker?.id ?? null,
      worker: item.worker,
      outsourcedWorker: item.outsourcedWorker,
      currentCount: item.currentCount,
      targetCount: item.targetCount,
      startingCount: item.startingCount,
      status: item.status,
      deadline: item.deadline,
      channelLink: item.channelLink,
      workerCost: item.workerCost ? item.workerCost.toString() : null,
      workerCostCurrency: item.workerCostCurrency,
    };
    const existing = itemsByOrderId.get(item.orderId);
    if (existing) existing.push(row);
    else itemsByOrderId.set(item.orderId, [row]);
  }

  return {
    rows: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      source: order.source,
      customerName: order.customer?.name ?? null,
      deadline: order.deadline,
      totalAmount: order.totalAmount.toString(),
      currency: order.currency,
      itemCount: order._count.items,
      items: itemsByOrderId.get(order.id) ?? [],
      createdAt: order.createdAt,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type OrderItemLinkRow = {
  id: string;
  url: string;
  domain: string;
  label: string | null;
};

export type OrderItemRow = {
  id: string;
  service: { id: string; name: string; metricType: ServiceMetricType | null };
  category: { id: string; name: string };
  worker: { id: string; fullName: string } | null;
  outsourcedWorker: { id: string; name: string } | null;
  description: string | null;
  /** The worker's deadline for this item — see the OrderItem.deadline doc comment. */
  deadline: Date | null;
  /** True when someone set `deadline` by hand instead of it following the order. */
  deadlineOverridden: boolean;
  channelLink: string | null;
  targetCount: number | null;
  currentCount: number | null;
  /** Feeds the client-side cost preview in `order-items-panel.tsx` (required = target − starting). See the schema doc comment. */
  startingCount: number | null;
  workerCost: string | null;
  workerCostCurrency: string;
  status: OrderItemStatus;
  /** When the current worker was assigned (owner request, 2026-11-03: workers see how long ago). */
  assignedAt: Date | null;
  /** When the item reached Done or Cancelled. */
  finishedAt: Date | null;
  links: OrderItemLinkRow[];
  createdAt: Date;
  updatedAt: Date;
};

export type OrderNoteRow = {
  id: string;
  body: string;
  author: { id: string; fullName: string };
  createdAt: Date;
};

export type OrderActivityRow = {
  id: string;
  action: string;
  summary: string;
  actorLabel: string | null;
  createdAt: Date;
};

export type OrderDetail = {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  /** Null when redacted for a worker (src/lib/orders/visibility.ts). */
  source: OrderSource | null;
  externalReference: string | null;
  customer: { id: string; name: string } | null;
  fiverrAccount: { id: string; name: string } | null;
  orderDate: Date;
  deadline: Date | null;
  totalAmount: string;
  currency: string;
  notes: string | null;
  deliveredAt: Date | null;
  refunded: boolean;
  /** Null when redacted for a worker. */
  createdBy: { id: string; fullName: string } | null;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItemRow[];
  internalNotes: OrderNoteRow[];
  activity: OrderActivityRow[];
};

const ACTIVITY_FEED_LIMIT = 30;

export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      source: true,
      externalReference: true,
      orderDate: true,
      deadline: true,
      totalAmount: true,
      currency: true,
      notes: true,
      deliveredAt: true,
      refunded: true,
      createdAt: true,
      updatedAt: true,
      customer: { select: { id: true, name: true } },
      fiverrAccount: { select: { id: true, name: true } },
      createdBy: { select: { id: true, fullName: true } },
      items: {
        select: {
          id: true,
          description: true,
          deadline: true,
          deadlineOverridden: true,
          channelLink: true,
          targetCount: true,
          currentCount: true,
          startingCount: true,
          workerCost: true,
          workerCostCurrency: true,
          status: true,
          assignedAt: true,
          finishedAt: true,
          createdAt: true,
          updatedAt: true,
          service: { select: { id: true, name: true, metricType: true } },
          category: { select: { id: true, name: true } },
          worker: { select: { id: true, fullName: true } },
          outsourcedWorker: { select: { id: true, name: true } },
          links: { select: { id: true, url: true, domain: true, label: true }, orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      },
      internalNotes: {
        select: { id: true, body: true, createdAt: true, author: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
      },
      activity: {
        select: { id: true, action: true, summary: true, actorLabel: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: ACTIVITY_FEED_LIMIT,
      },
    },
  });

  if (!order) return null;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    source: order.source,
    externalReference: order.externalReference,
    customer: order.customer,
    fiverrAccount: order.fiverrAccount,
    orderDate: order.orderDate,
    deadline: order.deadline,
    totalAmount: order.totalAmount.toString(),
    currency: order.currency,
    notes: order.notes,
    deliveredAt: order.deliveredAt,
    refunded: order.refunded,
    createdBy: order.createdBy,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.items.map((item) => ({
      id: item.id,
      service: item.service,
      category: item.category,
      worker: item.worker,
      outsourcedWorker: item.outsourcedWorker,
      description: item.description,
      deadline: item.deadline,
      deadlineOverridden: item.deadlineOverridden,
      channelLink: item.channelLink,
      targetCount: item.targetCount,
      currentCount: item.currentCount,
      startingCount: item.startingCount,
      workerCost: item.workerCost ? item.workerCost.toString() : null,
      workerCostCurrency: item.workerCostCurrency,
      status: item.status,
      assignedAt: item.assignedAt,
      finishedAt: item.finishedAt,
      links: item.links,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    internalNotes: order.internalNotes,
    activity: order.activity,
  };
}

/** Small aggregate counts for the dashboard (specification Section 37: counts, not row fetches). */
export async function getOrderCounts(scope: OrderScope): Promise<{
  open: number;
  overdue: number;
  dueToday: number;
  pending: number;
}> {
  const scopeFilter: Prisma.OrderWhereInput =
    scope.mode === "ASSIGNED" ? { items: { some: assignedItemWhere(scope) } } : {};
  const { start: todayStart, end: todayEnd } = todayRangeUtc();

  const [open, overdue, dueToday, pending] = await Promise.all([
    prisma.order.count({ where: { ...scopeFilter, status: { notIn: DONE_STATUSES } } }),
    prisma.order.count({
      where: { ...scopeFilter, deadline: { lt: new Date() }, status: { notIn: DONE_STATUSES } },
    }),
    prisma.order.count({
      where: { ...scopeFilter, deadline: { gte: todayStart, lt: todayEnd }, status: { notIn: DONE_STATUSES } },
    }),
    prisma.order.count({ where: { ...scopeFilter, status: "PENDING" } }),
  ]);

  return { open, overdue, dueToday, pending };
}

/** Active users, for the internal-worker picker on an Order Item / filter bar. */
export async function listAssignableWorkers(): Promise<Array<{ id: string; fullName: string }>> {
  return prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
}

export type BoardItemRow = {
  id: string;
  orderId: string;
  orderNumber: number;
  serviceName: string;
  metricType: ServiceMetricType | null;
  currentCount: number | null;
  targetCount: number | null;
  startingCount: number | null;
  status: OrderItemStatus;
  worker: { id: string; fullName: string } | null;
  outsourcedWorker: { id: string; name: string } | null;
  workerCost: string | null;
  workerCostCurrency: string;
  deadline: Date | null;
};

/**
 * A cap, not a page — confirmed directly, 2026-10-08: the board's columns
 * ARE the grouping (by status), so there is no natural page boundary the
 * way the list view has one. Generous enough for real usage, small enough
 * to never fetch unboundedly. Most-recent-first, so if the cap is ever hit
 * it's older, presumably-settled items that drop off, not new ones.
 */
export const BOARD_ITEM_LIMIT = 300;

/**
 * Flat, cross-order items for the Jira-style board
 * (`src/app/(app)/orders/orders-board.tsx`) — a SEPARATE flat query rather
 * than nesting items under a paginated `order.findMany`, same reasoning as
 * `listOrders`'s own item query (one extra round trip per relation level,
 * not per row, and this runs once per board load).
 */
export async function listBoardItems(where: Prisma.OrderItemWhereInput): Promise<BoardItemRow[]> {
  const items = await prisma.orderItem.findMany({
    where,
    select: {
      id: true,
      orderId: true,
      currentCount: true,
      targetCount: true,
      startingCount: true,
      status: true,
      workerCost: true,
      workerCostCurrency: true,
      deadline: true,
      order: { select: { orderNumber: true } },
      service: { select: { name: true, metricType: true } },
      worker: { select: { id: true, fullName: true } },
      outsourcedWorker: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: BOARD_ITEM_LIMIT,
  });

  return items.map((item) => ({
    id: item.id,
    orderId: item.orderId,
    orderNumber: item.order.orderNumber,
    serviceName: item.service.name,
    metricType: item.service.metricType,
    currentCount: item.currentCount,
    targetCount: item.targetCount,
    startingCount: item.startingCount,
    status: item.status,
    worker: item.worker,
    outsourcedWorker: item.outsourcedWorker,
    workerCost: item.workerCost ? item.workerCost.toString() : null,
    workerCostCurrency: item.workerCostCurrency,
    deadline: item.deadline,
  }));
}

