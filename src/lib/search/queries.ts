import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { resolveScope } from "@/lib/permissions/scope";
import { normalizeSearchTerm, PER_CATEGORY_LIMIT } from "./term";

/**
 * Global search (specification Section 76).
 *
 * Cost model, because search is the one feature a user can trigger on every
 * keystroke: every branch is a bounded `take: PER_CATEGORY_LIMIT` query that
 * selects only the columns it displays; every text match is a case-insensitive
 * `contains`, which Postgres serves from the `gin_trgm_ops` trigram indexes
 * declared in the schema (docs/DATABASE.md); a category the actor cannot view is
 * never queried at all; and the branches run in parallel, so latency is one
 * database round trip, not the sum of them. Nothing is cached across requests —
 * a shared cache would have to be permission-aware, and the query is cheap.
 */

export type SearchCategory = "Orders" | "Customers" | "Workers" | "Services" | "Categories";

export type SearchHit = {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle: string | null;
  href: string;
};

export type SearchResults = Record<SearchCategory, SearchHit[]>;

const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });

export async function globalSearch(actor: Actor, rawTerm: string): Promise<SearchResults> {
  const q = normalizeSearchTerm(rawTerm);
  const empty: SearchResults = { Orders: [], Customers: [], Workers: [], Services: [], Categories: [] };
  if (!q) return empty;

  const can = (key: string) => actor.permissions.has(key);
  const take = PER_CATEGORY_LIMIT;

  const orderNumber = /^#?\d{1,9}$/.test(q) ? Number(q.replace("#", "")) : null;
  const orderScope = resolveScope(actor.permissions, "orders.view");
  const scopeFilter: Prisma.OrderWhereInput =
    orderScope === "ALL" ? {} : { items: { some: { workerId: actor.user.id } } };

  const [orders, linkOrders, customers, users, outsourced, services, categories] = await Promise.all([
    can("orders.view")
      ? prisma.order.findMany({
          where: {
            ...scopeFilter,
            OR: [
              ...(orderNumber !== null ? [{ orderNumber }] : []),
              { externalReference: contains(q) },
            ],
          },
          select: { id: true, orderNumber: true, externalReference: true, status: true },
          orderBy: { orderNumber: "desc" },
          take,
        })
      : [],
    // Item links need 3+ characters to be worth the trigram lookup.
    can("orders.view") && q.length >= 3
      ? prisma.orderItemLink.findMany({
          where: { normalizedUrl: contains(q.toLowerCase()), orderItem: { order: scopeFilter } },
          select: { normalizedUrl: true, orderItem: { select: { order: { select: { id: true, orderNumber: true } } } } },
          take,
        })
      : [],
    can("customers.view")
      ? prisma.customer.findMany({
          where: { OR: [{ name: contains(q) }, { email: contains(q) }, { phone: contains(q) }] },
          select: { id: true, name: true, email: true, phone: true },
          orderBy: { name: "asc" },
          take,
        })
      : [],
    can("workers.view.all")
      ? prisma.user.findMany({
          where: { OR: [{ fullName: contains(q) }, { email: contains(q) }, { phone: contains(q) }] },
          select: { id: true, fullName: true, email: true },
          orderBy: { fullName: "asc" },
          take,
        })
      : [],
    can("workers.view.all")
      ? prisma.outsourcedWorker.findMany({
          where: { OR: [{ name: contains(q) }, { phone: contains(q) }] },
          select: { id: true, name: true, phone: true },
          orderBy: { name: "asc" },
          take,
        })
      : [],
    can("services.view")
      ? prisma.service.findMany({
          where: { name: contains(q) },
          select: { id: true, name: true, category: { select: { name: true } } },
          orderBy: { name: "asc" },
          take,
        })
      : [],
    can("categories.view")
      ? prisma.category.findMany({ where: { name: contains(q) }, select: { id: true, name: true }, orderBy: { name: "asc" }, take })
      : [],
  ]);

  const hits: SearchResults = { ...empty };

  const seenOrders = new Set<string>();
  for (const o of orders) {
    seenOrders.add(o.id);
    hits.Orders.push({
      id: o.id,
      category: "Orders",
      title: `#${o.orderNumber}`,
      subtitle: o.externalReference ? `Ref ${o.externalReference}` : null,
      href: `/orders/${o.id}`,
    });
  }
  for (const link of linkOrders) {
    const order = link.orderItem.order;
    if (seenOrders.has(order.id)) continue;
    seenOrders.add(order.id);
    hits.Orders.push({ id: order.id, category: "Orders", title: `#${order.orderNumber}`, subtitle: `Link ${link.normalizedUrl}`, href: `/orders/${order.id}` });
  }
  hits.Orders = hits.Orders.slice(0, take);

  hits.Customers = customers.map((c) => ({
    id: c.id,
    category: "Customers",
    title: c.name,
    subtitle: c.email ?? c.phone,
    href: `/customers/${c.id}`,
  }));

  hits.Workers = [
    ...users.map((u) => ({ id: u.id, category: "Workers" as const, title: u.fullName, subtitle: u.email, href: `/workers/${u.id}` })),
    ...outsourced.map((w) => ({
      id: w.id,
      category: "Workers" as const,
      title: w.name,
      subtitle: w.phone ? `Outsourced · ${w.phone}` : "Outsourced",
      href: `/outsourced-workers/${w.id}`,
    })),
  ].slice(0, take);

  hits.Services = services.map((s) => ({ id: s.id, category: "Services", title: s.name, subtitle: s.category.name, href: `/services/${s.id}` }));
  hits.Categories = categories.map((c) => ({ id: c.id, category: "Categories", title: c.name, subtitle: null, href: "/categories" }));

  return hits;
}
