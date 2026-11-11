import "server-only";

import type { OrderItemStatus, OrderStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { thisWeekRangeUtc } from "@/lib/orders/date-ranges";
import { CLOSED_ORDER_STATUSES } from "@/lib/orders/state-machine";
import { serviceLabel } from "@/lib/services/label";

/**
 * The business overview on the dashboard (2026-11-11, owner request: "redesign
 * the dashboard, this looks unprofessional"). Shown to anyone who can see every
 * order. Customer names and amounts are only loaded when the caller says the
 * viewer may see them, so they never reach a browser that shouldn't have them.
 */

const OPEN_ITEM_STATUSES: OrderItemStatus[] = ["PENDING", "PROCESSING", "REFILL"];
const ATTENTION_LIMIT = 8;
const RECENT_ORDERS_LIMIT = 5;
/** A task assigned this long ago and still not accepted is worth a nudge. */
const NOT_ACCEPTED_AFTER_MS = 24 * 60 * 60 * 1000;

export type AttentionReason = "withdraw" | "screenshots" | "overdue" | "unassigned" | "not_accepted";

export type AttentionRow = {
  itemId: string;
  orderId: string;
  orderNumber: number;
  serviceName: string;
  status: OrderItemStatus;
  reason: AttentionReason;
  deadline: Date | null;
  assignedAt: Date | null;
  workerName: string | null;
};

export type RecentOrderRow = {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  createdAt: Date;
  itemCount: number;
  /** Null when the viewer may not see customers. */
  customerName: string | null;
  /** "190.00 USD", or null when the viewer may not see prices. */
  amountLabel: string | null;
};

export type BusinessOverview = {
  openOrders: number;
  unassignedItems: number;
  overdueItems: number;
  dueThisWeekItems: number;
  attention: AttentionRow[];
  recentOrders: RecentOrderRow[];
  ordersByStatus: Partial<Record<OrderStatus, number>>;
};

export async function getBusinessOverview(options: { showCustomers: boolean; showAmounts: boolean }): Promise<BusinessOverview> {
  const now = new Date();
  const week = thisWeekRangeUtc(now);
  const openOrder = { status: { notIn: [...CLOSED_ORDER_STATUSES] } };
  const openItem = { status: { in: OPEN_ITEM_STATUSES }, order: openOrder };
  const unassigned = { workerId: null, outsourcedWorkerId: null };

  const itemSelect = {
    id: true,
    orderId: true,
    status: true,
    deadline: true,
    assignedAt: true,
    order: { select: { orderNumber: true } },
    service: { select: { name: true, category: { select: { name: true } } } },
    outsourcedWorker: { select: { name: true } },
    worker: { select: { fullName: true } },
  } as const;

  const [openOrders, unassignedItems, overdueItems, dueThisWeekItems, overdue, unassignedList, notAccepted, recent, byStatus, requested] =
    await Promise.all([
      prisma.order.count({ where: openOrder }),
      prisma.orderItem.count({ where: { ...openItem, ...unassigned } }),
      prisma.orderItem.count({ where: { ...openItem, deadline: { lt: now } } }),
      prisma.orderItem.count({ where: { ...openItem, deadline: { gte: now, lt: week.end } } }),
      prisma.orderItem.findMany({
        where: { ...openItem, deadline: { lt: now } },
        select: itemSelect,
        orderBy: { deadline: "asc" },
        take: ATTENTION_LIMIT,
      }),
      prisma.orderItem.findMany({
        where: { ...openItem, ...unassigned },
        select: itemSelect,
        orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
        take: ATTENTION_LIMIT,
      }),
      prisma.orderItem.findMany({
        where: {
          status: "PENDING",
          order: openOrder,
          assignedAt: { lt: new Date(now.getTime() - NOT_ACCEPTED_AFTER_MS) },
          OR: [{ workerId: { not: null } }, { outsourcedWorkerId: { not: null } }],
        },
        select: itemSelect,
        orderBy: { assignedAt: "asc" },
        take: ATTENTION_LIMIT,
      }),
      prisma.order.findMany({
        select: {
          id: true,
          orderNumber: true,
          status: true,
          createdAt: true,
          totalAmount: options.showAmounts,
          currency: options.showAmounts,
          customer: options.showCustomers ? { select: { name: true } } : false,
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        take: RECENT_ORDERS_LIMIT,
      }),
      prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      // Items whose worker is waiting on screenshots from the team (2026-11-11).
      prisma.orderItem.findMany({
        where: { ...openItem, updates: { some: { isRequest: true, resolvedAt: null } } },
        select: { ...itemSelect, updates: { where: { isRequest: true, resolvedAt: null }, select: { requestType: true } } },
        orderBy: { createdAt: "asc" },
        take: ATTENTION_LIMIT,
      }),
    ]);

  // Screenshot requests first (a worker is blocked), then overdue, unassigned, not accepted; an item appears once.
  const seen = new Set<string>();
  const attention: AttentionRow[] = [];
  const add = (rows: typeof overdue, reason: AttentionReason) => {
    for (const item of rows) {
      if (seen.has(item.id) || attention.length >= ATTENTION_LIMIT) continue;
      seen.add(item.id);
      attention.push({
        itemId: item.id,
        orderId: item.orderId,
        orderNumber: item.order.orderNumber,
        serviceName: serviceLabel(item.service.name, item.service.category.name),
        status: item.status,
        reason,
        deadline: item.deadline,
        assignedAt: item.assignedAt,
        workerName: item.outsourcedWorker?.name ?? item.worker?.fullName ?? null,
      });
    }
  };
  // A worker who can't continue comes first: the work has stopped.
  add(requested.filter((item) => item.updates.some((u) => u.requestType === "WITHDRAW")), "withdraw");
  add(requested, "screenshots");
  add(overdue, "overdue");
  add(unassignedList, "unassigned");
  add(notAccepted, "not_accepted");

  const ordersByStatus: Partial<Record<OrderStatus, number>> = {};
  for (const group of byStatus) ordersByStatus[group.status] = group._count._all;

  return {
    openOrders,
    unassignedItems,
    overdueItems,
    dueThisWeekItems,
    attention,
    recentOrders: recent.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      itemCount: order._count.items,
      customerName: options.showCustomers ? (order.customer?.name ?? null) : null,
      amountLabel: options.showAmounts && order.totalAmount != null ? `${order.totalAmount.toFixed(2)} ${order.currency}` : null,
    })),
    ordersByStatus,
  };
}

/** The first and last instant of this calendar month, UTC. */
export function thisMonthRangeUtc(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}
