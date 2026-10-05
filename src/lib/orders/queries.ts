import "server-only";

import type { OrderItemStatus, OrderSource, OrderStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { ServiceMetricType } from "@/lib/services/metric-type";
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

export type OrderScope = { mode: "ALL" } | { mode: "ASSIGNED"; userId: string };

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
  createdAt: Date;
};

export type OrderListResult = {
  rows: OrderListRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

const DONE_STATUSES: OrderStatus[] = ["COMPLETED", "CANCELLED", "DELIVERED"];

export async function listOrders(
  filters: OrderListFilters,
  scope: OrderScope,
): Promise<OrderListResult> {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(filters.pageSize ?? ORDERS_PAGE_SIZE)));

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
  if (scope.mode === "ASSIGNED") and.push({ items: { some: { workerId: scope.userId } } });

  if (filters.status) and.push({ status: filters.status });
  if (filters.source) and.push({ source: filters.source });
  if (filters.customerId) and.push({ customerId: filters.customerId });

  if (filters.assigned === "1") {
    and.push({ items: { some: { OR: [{ workerId: { not: null } }, { outsourcedWorkerId: { not: null } }] } } });
  } else if (filters.assigned === "0") {
    and.push({ items: { none: { OR: [{ workerId: { not: null } }, { outsourcedWorkerId: { not: null } }] } } });
  }

  if (filters.overdue) {
    and.push({ deadline: { lt: new Date() }, status: { notIn: DONE_STATUSES } });
  }
  if (filters.dueToday) {
    const { start, end } = todayRangeUtc();
    and.push({ deadline: { gte: start, lt: end } });
  }
  if (filters.dueThisWeek) {
    const { start, end } = thisWeekRangeUtc();
    and.push({ deadline: { gte: start, lt: end } });
  }

  if (filters.amountMin) and.push({ totalAmount: { gte: filters.amountMin } });
  if (filters.amountMax) and.push({ totalAmount: { lte: filters.amountMax } });

  const search = filters.search?.trim();
  if (search) {
    const numeric = /^\d+$/.test(search) ? Number(search) : undefined;
    and.push({
      OR: [
        ...(numeric !== undefined ? [{ orderNumber: numeric }] : []),
        { externalReference: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
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

  const where: Prisma.OrderWhereInput = and.length > 0 ? { AND: and } : {};

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
  deadline: Date | null;
  channelLink: string | null;
  targetCount: number | null;
  currentCount: number | null;
  workerCost: string | null;
  workerCostCurrency: string;
  status: OrderItemStatus;
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
  source: OrderSource;
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
  createdBy: { id: string; fullName: string };
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
          channelLink: true,
          targetCount: true,
          currentCount: true,
          workerCost: true,
          workerCostCurrency: true,
          status: true,
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
      channelLink: item.channelLink,
      targetCount: item.targetCount,
      currentCount: item.currentCount,
      workerCost: item.workerCost ? item.workerCost.toString() : null,
      workerCostCurrency: item.workerCostCurrency,
      status: item.status,
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
    scope.mode === "ASSIGNED" ? { items: { some: { workerId: scope.userId } } } : {};
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

