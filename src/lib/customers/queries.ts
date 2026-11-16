import "server-only";

import type { PartyType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Read queries for customers (specification Section 49).
 *
 * The list carries each customer's order count and last order date (owner
 * request, 2026-11-15: "show the orders by the customer").
 */

export const CUSTOMERS_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export type CustomerListRow = {
  id: string;
  name: string;
  username: string;
  type: PartyType;
  email: string | null;
  phone: string | null;
  orderCount: number;
  lastOrderAt: Date | null;
};

export type CustomerListResult = {
  rows: CustomerListRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export async function listCustomers(options: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<CustomerListResult> {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(options.pageSize ?? CUSTOMERS_PAGE_SIZE)),
  );
  const search = options.search?.trim();

  const where = {
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { username: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      select: {
        id: true,
        name: true,
        username: true,
        type: true,
        email: true,
        phone: true,
        _count: { select: { orders: true } },
        orders: { select: { orderDate: true }, orderBy: { orderDate: "desc" }, take: 1 },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    rows: customers.map(({ _count, orders, ...customer }) => ({
      ...customer,
      orderCount: _count.orders,
      lastOrderAt: orders[0]?.orderDate ?? null,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type CustomerDetail = {
  id: string;
  name: string;
  username: string;
  type: PartyType;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function getCustomerDetail(customerId: string): Promise<CustomerDetail | null> {
  return prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      username: true,
      type: true,
      email: true,
      phone: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/** id/name only, in name order — for the picker on the Order form/filters. */
export type CustomerSearchHit = { id: string; name: string; email: string | null };

/**
 * Backs the order form's customer autocomplete (confirmed directly,
 * 2026-09-27). Case-insensitive `contains`, served by the trigram index on
 * `name` — bounded, explicit `select`, same cost discipline as global search.
 */
export async function searchCustomersByName(query: string, limit = 8): Promise<CustomerSearchHit[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  return prisma.customer.findMany({
    where: { OR: [{ name: { contains: term, mode: "insensitive" } }, { username: { contains: term, mode: "insensitive" } }] },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: limit,
  });
}

export async function listAssignableCustomers(): Promise<Array<{ id: string; name: string }>> {
  return prisma.customer.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** A count, not row fetches (specification Section 37) — for the dashboard's CRM section. */
export async function countCustomers(): Promise<number> {
  return prisma.customer.count();
}

/** A customer's order figures for their page (owner request, 2026-11-15). */
export type CustomerOrderStats = {
  orderCount: number;
  openCount: number;
  /** What the customer has been charged, per currency (never blended, D1), excluding cancelled and refunded orders. */
  spent: Array<{ currency: string; amount: string }>;
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
};

export async function getCustomerOrderStats(customerId: string): Promise<CustomerOrderStats> {
  const [orderCount, openCount, spent, range] = await Promise.all([
    prisma.order.count({ where: { customerId } }),
    prisma.order.count({ where: { customerId, status: { notIn: ["COMPLETED", "DELIVERED", "FINALIZED", "CANCELLED"] } } }),
    prisma.order.groupBy({
      by: ["currency"],
      where: { customerId, refunded: false, status: { not: "CANCELLED" } },
      _sum: { totalAmount: true },
      orderBy: { currency: "asc" },
    }),
    prisma.order.aggregate({ where: { customerId }, _min: { orderDate: true }, _max: { orderDate: true } }),
  ]);
  return {
    orderCount,
    openCount,
    spent: spent.map((row) => ({ currency: row.currency, amount: (row._sum.totalAmount ?? 0).toString() })),
    firstOrderAt: range._min.orderDate,
    lastOrderAt: range._max.orderDate,
  };
}
