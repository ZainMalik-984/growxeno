import "server-only";

import type { OrderItemStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assignedItemWhere, type AssignmentIdentity } from "@/lib/orders/assignment";
import { todayRangeUtc } from "@/lib/orders/date-ranges";
import { ORDER_ITEM_STATUS_LABELS } from "@/lib/orders/state-machine";

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
        service: { select: { name: true } },
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
        service: { select: { name: true } },
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
      serviceName: item.service.name,
      status: item.status,
      statusLabel: ORDER_ITEM_STATUS_LABELS[item.status],
      deadline: item.deadline,
      isOverdue: item.deadline !== null && item.deadline < now,
    })),
    recentlyCompleted: recentlyCompleted.map((item) => ({
      itemId: item.id,
      orderId: item.orderId,
      orderNumber: item.order.orderNumber,
      serviceName: item.service.name,
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
  openItemCount: number;
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
      _count: { select: { assignedOrderItems: { where: { status: { in: OPEN_ITEM_STATUSES } } } } },
    },
    orderBy: [{ fullName: "asc" }, { id: "asc" }],
  });

  return users.map((user) => ({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    jobTitle: user.jobTitle,
    roleNames: user.roles.map((assignment) => assignment.role.name).sort(),
    openItemCount: user._count.assignedOrderItems,
  }));
}

export type EmployeeCategoryRow = { id: string; name: string };
export type EmployeeActivityRow = { id: string; summary: string; createdAt: Date };

export type EmployeeProfile = {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string | null;
  isActive: boolean;
  roleNames: string[];
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
      email: true,
      jobTitle: true,
      isActive: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  });
  if (!user) return null;

  const [categoryRows, activity] = await Promise.all([
    prisma.orderItem.findMany({
      where: { workerId: userId },
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
    email: user.email,
    jobTitle: user.jobTitle,
    isActive: user.isActive,
    roleNames: user.roles.map((assignment) => assignment.role.name).sort(),
    categories: categoryRows.map((row) => row.category).sort((a, b) => a.name.localeCompare(b.name)),
    activity,
  };
}
