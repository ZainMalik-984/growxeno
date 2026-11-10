import "server-only";

import type { OrderItemStatus, OrderStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { serviceLabel } from "@/lib/services/label";
import { commissionTotals } from "@/lib/finance/commission";
import { getFiverrFeeSettings } from "@/lib/settings/queries";
import { assignedItemWhere, type AssignmentIdentity } from "@/lib/orders/assignment";
import { todayRangeUtc } from "@/lib/orders/date-ranges";
import { CLOSED_ORDER_STATUSES, ORDER_ITEM_STATUS_LABELS } from "@/lib/orders/state-machine";

/**
 * Read queries for internal Employee profiles and the personal "your work"
 * summary (specification Sections 43–45), documented in docs/ORDERS.md §9.
 *
 * Renamed from "Worker" to "Employee" (owner-directed, confirmed directly,
 * 2026-10-08) — Employees are managers/admins who create and assign orders,
 * salaried, never themselves the assignee doing the work. Execution is done
 * by External Workers (`src/lib/outsourced-workers/`), which is why
 * `getMyWorkSummary` below also matches `outsourcedWorkerId` — it serves
 * BOTH an Employee's dashboard (reading the deprecated `workerId` history,
 * see its schema doc comment) and an External Worker's, via the shared
 * `assignedItemWhere` (`src/lib/orders/assignment.ts`).
 */

const OPEN_ITEM_STATUSES: OrderItemStatus[] = ["PENDING", "PROCESSING", "REFILL"];
const RECENTLY_COMPLETED_LIMIT = 5;
const ATTENTION_LIMIT = 8;
const ACTIVITY_LIMIT = 15;

export type AttentionItemRow = {
  itemId: string;
  orderId: string;
  orderNumber: number;
  serviceName: string;
  status: OrderItemStatus;
  statusLabel: string;
  deadline: Date | null;
  isOverdue: boolean;
};

export type RecentlyCompletedRow = {
  itemId: string;
  orderId: string;
  orderNumber: number;
  serviceName: string;
  completedAt: Date;
};

export type WorkSummary = {
  newCount: number;
  activeCount: number;
  dueTodayCount: number;
  overdueCount: number;
  attention: AttentionItemRow[];
  recentlyCompleted: RecentlyCompletedRow[];
};

/**
 * The personal work summary behind both the dashboard's "Your work" section
 * and an employee's own profile page — one query shape, two surfaces.
 *
 * Item-level, not order-level: an Order Item carries its own `deadline`
 * (falling back to the order's if unset — see docs/ORDERS.md).
 */
export async function getMyWorkSummary(identity: AssignmentIdentity): Promise<WorkSummary> {
  const now = new Date();
  const { start: todayStart, end: todayEnd } = todayRangeUtc(now);
  const mine = assignedItemWhere(identity);

  const [newCount, activeCount, dueTodayCount, overdueCount, attentionItems, recentlyCompleted] = await Promise.all([
    prisma.orderItem.count({ where: { ...mine, status: "PENDING" } }),
    prisma.orderItem.count({ where: { ...mine, status: { in: ["PROCESSING", "REFILL"] } } }),
    prisma.orderItem.count({
      where: { ...mine, status: { in: OPEN_ITEM_STATUSES }, deadline: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.orderItem.count({
      where: { ...mine, status: { in: OPEN_ITEM_STATUSES }, deadline: { lt: now } },
    }),
    prisma.orderItem.findMany({
      where: { ...mine, status: { in: OPEN_ITEM_STATUSES } },
      select: {
        id: true,
        status: true,
        deadline: true,
        orderId: true,
        order: { select: { orderNumber: true } },
        service: { select: { name: true, category: { select: { name: true } } } },
      },
      orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: ATTENTION_LIMIT,
    }),
    prisma.orderItem.findMany({
      where: { ...mine, status: "DONE" },
      select: {
        id: true,
        orderId: true,
        updatedAt: true,
        order: { select: { orderNumber: true } },
        service: { select: { name: true, category: { select: { name: true } } } },
      },
      orderBy: { updatedAt: "desc" },
      take: RECENTLY_COMPLETED_LIMIT,
    }),
  ]);

  return {
    newCount,
    activeCount,
    dueTodayCount,
    overdueCount,
    attention: attentionItems.map((item) => ({
      itemId: item.id,
      orderId: item.orderId,
      orderNumber: item.order.orderNumber,
      serviceName: serviceLabel(item.service.name, item.service.category.name),
      status: item.status,
      statusLabel: ORDER_ITEM_STATUS_LABELS[item.status],
      deadline: item.deadline,
      isOverdue: item.deadline !== null && item.deadline < now,
    })),
    recentlyCompleted: recentlyCompleted.map((item) => ({
      itemId: item.id,
      orderId: item.orderId,
      orderNumber: item.order.orderNumber,
      serviceName: serviceLabel(item.service.name, item.service.category.name),
      completedAt: item.updatedAt,
    })),
  };
}

export type EmployeeListRow = {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string | null;
  roleNames: string[];
  /** Orders they created that are not delivered, finalized or cancelled. */
  openOrderCount: number;
};

/** Active internal users, for the `/employees` roster (`employees.view.all`). */
export async function listEmployees(): Promise<EmployeeListRow[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      fullName: true,
      email: true,
      jobTitle: true,
      roles: { select: { role: { select: { name: true } } } },
      // Employees create orders rather than do the work (2026-11-04), so the
      // roster counts their open orders, not items assigned to them.
      _count: { select: { createdOrders: { where: { status: { notIn: CLOSED_ORDER_STATUSES } } } } },
    },
    orderBy: [{ fullName: "asc" }, { id: "asc" }],
  });

  return users.map((user) => ({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    jobTitle: user.jobTitle,
    roleNames: user.roles.map((assignment) => assignment.role.name).sort(),
    openOrderCount: user._count.createdOrders,
  }));
}

export type EmployeeCategoryRow = { id: string; name: string };
export type EmployeeActivityRow = { id: string; summary: string; createdAt: Date };

export type EmployeeProfile = {
  id: string;
  fullName: string;
  displayName: string | null;
  email: string;
  jobTitle: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  /** Null = no commission. */
  commissionPercent: number | null;
  roleNames: string[];
  /** For the Edit Profile form. */
  roles: Array<{ id: string; name: string }>;
  categories: EmployeeCategoryRow[];
  activity: EmployeeActivityRow[];
};

/** Everything on the Employee Profile page (specification Section 45) that has a real data source today. */
export async function getEmployeeProfile(userId: string): Promise<EmployeeProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      displayName: true,
      email: true,
      jobTitle: true,
      phone: true,
      whatsappNumber: true,
      avatarUrl: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      commissionPercent: true,
      roles: { select: { role: { select: { id: true, name: true } } } },
    },
  });
  if (!user) return null;

  const [categoryRows, activity] = await Promise.all([
    prisma.orderItem.findMany({
      // Categories of the work in orders they created (2026-11-04): an Employee
      // creates and assigns work rather than doing it.
      where: { order: { createdById: userId } },
      distinct: ["categoryId"],
      select: { category: { select: { id: true, name: true } } },
      orderBy: { categoryId: "asc" },
    }),
    prisma.orderActivity.findMany({
      where: { actorId: userId },
      select: { id: true, summary: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: ACTIVITY_LIMIT,
    }),
  ]);

  return {
    id: user.id,
    fullName: user.fullName,
    displayName: user.displayName,
    email: user.email,
    jobTitle: user.jobTitle,
    phone: user.phone,
    whatsappNumber: user.whatsappNumber,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    commissionPercent: user.commissionPercent === null ? null : Number(user.commissionPercent),
    roleNames: user.roles.map((assignment) => assignment.role.name).sort(),
    roles: user.roles.map((assignment) => assignment.role).sort((a, b) => a.name.localeCompare(b.name)),
    categories: categoryRows.map((row) => row.category).sort((a, b) => a.name.localeCompare(b.name)),
    activity,
  };
}

// ---------------------------------------------------------------------------
// An Employee's own output: the orders they create and the work they assign
// (owner-directed, 2026-11-04: "employee does not do any work, he's the one
// who'll create jobs and assign them").
// ---------------------------------------------------------------------------

export type EmployeeOrderRow = {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  deadline: Date | null;
  itemCount: number;
  createdAt: Date;
};

export type EmployeeAssignmentRow = {
  itemId: string;
  orderId: string;
  orderNumber: number;
  serviceName: string;
  workerName: string;
  status: OrderItemStatus;
  assignedAt: Date | null;
};

export type EmployeeOutputSummary = {
  ordersCreated: number;
  openOrders: number;
  overdueOrders: number;
  awaitingAcceptance: number;
  recentOrders: EmployeeOrderRow[];
  recentAssignments: EmployeeAssignmentRow[];
};

const RECENT_LIMIT = 8;

export async function getEmployeeOutputSummary(userId: string): Promise<EmployeeOutputSummary> {
  const now = new Date();
  const createdByMe = { createdById: userId };
  const open = { status: { notIn: CLOSED_ORDER_STATUSES } };

  const [ordersCreated, openOrders, overdueOrders, awaitingAcceptance, recentOrders, recentAssignments] = await Promise.all([
    prisma.order.count({ where: createdByMe }),
    prisma.order.count({ where: { ...createdByMe, ...open } }),
    prisma.order.count({ where: { ...createdByMe, ...open, deadline: { lt: now } } }),
    // Handed to a worker by this employee, not yet accepted.
    prisma.orderItem.count({ where: { assignedById: userId, outsourcedWorkerId: { not: null }, status: "PENDING" } }),
    prisma.order.findMany({
      where: createdByMe,
      select: { id: true, orderNumber: true, status: true, deadline: true, createdAt: true, _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      take: RECENT_LIMIT,
    }),
    prisma.orderItem.findMany({
      where: { assignedById: userId, outsourcedWorkerId: { not: null } },
      select: {
        id: true,
        orderId: true,
        status: true,
        assignedAt: true,
        order: { select: { orderNumber: true } },
        service: { select: { name: true, category: { select: { name: true } } } },
        outsourcedWorker: { select: { name: true } },
      },
      orderBy: [{ assignedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
      take: RECENT_LIMIT,
    }),
  ]);

  return {
    ordersCreated,
    openOrders,
    overdueOrders,
    awaitingAcceptance,
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      deadline: order.deadline,
      itemCount: order._count.items,
      createdAt: order.createdAt,
    })),
    recentAssignments: recentAssignments.map((item) => ({
      itemId: item.id,
      orderId: item.orderId,
      orderNumber: item.order.orderNumber,
      serviceName: serviceLabel(item.service.name, item.service.category.name),
      workerName: item.outsourcedWorker?.name ?? "—",
      status: item.status,
      assignedAt: item.assignedAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// Commission (owner request, 2026-11-04) — see src/lib/finance/commission.ts
// ---------------------------------------------------------------------------

export type EmployeeCommission = {
  percent: number;
  fiverrFeePercent: number;
  earnedByCurrency: Record<string, number>;
  pendingByCurrency: Record<string, number>;
};

/**
 * Null when no commission percentage is set for this person — the page then
 * shows nothing about commission at all. One grouped query: commission is a
 * straight percentage, so summing prices per (source, status, currency)
 * first gives the same totals as summing per order (to the cent).
 */
export async function getEmployeeCommission(userId: string): Promise<EmployeeCommission | null> {
  // Checked first: most people have no commission, and then this is one query.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { commissionPercent: true } });
  const percent = user?.commissionPercent ? Number(user.commissionPercent) : null;
  if (!percent) return null;

  const [fee, groups] = await Promise.all([
    getFiverrFeeSettings(),
    prisma.order.groupBy({
      by: ["source", "status", "currency"],
      where: { createdById: userId, status: { not: "CANCELLED" } },
      _sum: { totalAmount: true },
    }),
  ]);
  const totals = commissionTotals(
    groups.map((g) => ({ source: g.source, status: g.status, currency: g.currency, totalAmount: g._sum.totalAmount?.toString() ?? "0" })),
    percent,
    fee.percent,
  );
  return { percent, fiverrFeePercent: fee.percent, ...totals };
}
