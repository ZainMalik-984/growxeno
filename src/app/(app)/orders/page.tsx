import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { buttonVariants } from "@/components/ui/button";
import { Breadcrumbs, EmptyState, PageHeader, Section } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { StatusDot } from "@/components/ui/status-dot";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { listAssignableCategories } from "@/lib/categories/queries";
import { listAssignableCustomers } from "@/lib/customers/queries";
import { requireScope } from "@/lib/auth/authorize";
import { listAssignableOutsourcedWorkers } from "@/lib/outsourced-workers/queries";
import {
  listAssignableWorkers,
  listOrders,
  MAX_PAGE_SIZE,
  ORDERS_PAGE_SIZE,
  type OrderScope,
} from "@/lib/orders/queries";
import { orderVisibility } from "@/lib/orders/visibility";
import { listAssignableServices } from "@/lib/services/queries";
import { ORDER_STATUS_LABELS } from "@/lib/orders/state-machine";
import { OrderFilterBar } from "./order-filter-bar";

export const metadata: Metadata = { title: "Orders" };

const searchParamsSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z
    .enum([
      "PENDING",
      "PROCESSING",
      "IN_PROGRESS",
      "INTERNAL_REVIEW",
      "READY_FOR_DELIVERY",
      "DELIVERED",
      "COMPLETED",
      "REVISION",
      "CANCELLED",
    ])
    .optional(),
  source: z.enum(["FIVERR", "EXTERNAL"]).optional(),
  customer: z.uuid().optional(),
  worker: z.uuid().optional(),
  outsourcedWorker: z.uuid().optional(),
  service: z.uuid().optional(),
  category: z.uuid().optional(),
  assigned: z.enum(["1", "0"]).optional(),
  overdue: z.enum(["1"]).optional(),
  dueToday: z.enum(["1"]).optional(),
  dueThisWeek: z.enum(["1"]).optional(),
  hasLinks: z.enum(["1"]).optional(),
  link: z.string().trim().max(300).optional(),
  amountMin: z.string().trim().max(20).optional(),
  amountMax: z.string().trim().max(20).optional(),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(ORDERS_PAGE_SIZE),
  due: z.enum(["overdue"]).optional(),
});

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const { actor, scope } = await requireScope("orders.view");

  const raw = await searchParams;
  const params = searchParamsSchema.parse(raw);

  // What this actor may see — see src/lib/orders/visibility.ts. Filters and columns they may not
  // see are neither loaded nor rendered, so the names/amounts never reach their browser.
  const visibility = orderVisibility((key) => actor.permissions.has(key));
  const orderScope: OrderScope = scope === "ALL" ? { mode: "ALL" } : { mode: "ASSIGNED", userId: actor.user.id };

  const [result, customers, workers, outsourcedWorkers, services, categories] = await Promise.all([
    listOrders(
      {
        page: params.page,
        pageSize: params.size,
        search: params.q,
        status: params.status,
        source: params.source,
        customerId: params.customer,
        workerId: params.worker,
        outsourcedWorkerId: params.outsourcedWorker,
        serviceId: params.service,
        categoryId: params.category,
        assigned: params.assigned,
        overdue: params.overdue === "1" || params.due === "overdue",
        dueToday: params.dueToday === "1",
        dueThisWeek: params.dueThisWeek === "1",
        hasLinks: params.hasLinks === "1",
        linkQuery: params.link,
        // An amount filter is a side channel onto totals the actor may not see (binary-search a price).
        amountMin: visibility.prices ? params.amountMin : undefined,
        amountMax: visibility.prices ? params.amountMax : undefined,
      },
      orderScope,
    ),
    visibility.pickers.customers ? listAssignableCustomers() : Promise.resolve([]),
    visibility.pickers.workers ? listAssignableWorkers() : Promise.resolve([]),
    visibility.pickers.workers ? listAssignableOutsourcedWorkers() : Promise.resolve([]),
    visibility.pickers.catalog ? listAssignableServices() : Promise.resolve([]),
    visibility.pickers.catalog ? listAssignableCategories() : Promise.resolve([]),
  ]);

  const buildHref = (target: number) => {
    const url = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "page" || value === undefined) continue;
      if (key === "size" && value === ORDERS_PAGE_SIZE) continue;
      url.set(key, String(value));
    }
    if (target > 1) url.set("page", String(target));
    const search = url.toString();
    return search ? `/orders?${search}` : "/orders";
  };

  return (
    <>
      <Breadcrumbs items={[{ label: "Operations" }, { label: "Orders" }]} />
      <PageHeader
        title="Orders"
        description={
          scope === "ASSIGNED"
            ? "Orders containing at least one item assigned to you."
            : "Every order in the business."
        }
        actions={
          actor.permissions.has("orders.create") ? (
            <Link href="/orders/new" className={buttonVariants({ variant: "primary" })}>
              New order
            </Link>
          ) : undefined
        }
      />

      <OrderFilterBar
        initialSearch={params.q ?? ""}
        customers={customers.map((c) => ({ id: c.id, label: c.name }))}
        workers={workers.map((w) => ({ id: w.id, label: w.fullName }))}
        outsourcedWorkers={outsourcedWorkers.map((w) => ({ id: w.id, label: w.name }))}
        services={services.map((s) => ({ id: s.id, label: s.name }))}
        categories={categories.map((c) => ({ id: c.id, label: c.name }))}
      />

      <Section>
        {result.rows.length === 0 ? (
          <EmptyState
            title="No orders found"
            description="Try changing the filters, or create a new order."
            action={
              actor.permissions.has("orders.create") ? (
                <Link href="/orders/new" className={buttonVariants({ variant: "primary" })}>
                  New order
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <caption className="sr-only">Orders</caption>
                <THead>
                  <TR>
                    <TH>Order</TH>
                    {visibility.parties ? <TH>Customer</TH> : null}
                    <TH>Status</TH>
                    <TH>Deadline</TH>
                    <TH className="text-right">Items</TH>
                    {visibility.prices ? <TH className="text-right">Amount</TH> : null}
                  </TR>
                </THead>
                <TBody>
                  {result.rows.map((order) => (
                    <TR key={order.id}>
                      <TD>
                        <Link href={`/orders/${order.id}`} className="font-medium text-ink hover:underline">
                          #{order.orderNumber}
                        </Link>
                      </TD>
                      {visibility.parties ? (
                        <TD className="text-ink-muted">
                          {order.customerName ?? <span className="text-ink-faint">—</span>}
                        </TD>
                      ) : null}
                      <TD>
                        <StatusDot tone={statusTone(order.status)} label={ORDER_STATUS_LABELS[order.status]} />
                      </TD>
                      <TD className="text-ink-muted">
                        {order.deadline ? `${dateFormat.format(order.deadline)} UTC` : <span className="text-ink-faint">—</span>}
                      </TD>
                      <TD className="text-right text-ink-muted">{order.itemCount}</TD>
                      {visibility.prices ? (
                        <TD className="text-right text-ink-muted">
                          {order.totalAmount} {order.currency}
                        </TD>
                      ) : null}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              total={result.total}
              itemLabel="order"
              buildHref={buildHref}
            />
          </>
        )}
      </Section>
    </>
  );
}

function statusTone(status: string): "neutral" | "active" | "progress" | "review" | "ready" | "done" | "warning" | "danger" {
  switch (status) {
    case "COMPLETED":
    case "DELIVERED":
      return "done";
    case "CANCELLED":
      return "neutral";
    case "REVISION":
      return "warning";
    case "IN_PROGRESS":
    case "PROCESSING":
      return "progress";
    case "INTERNAL_REVIEW":
      return "review";
    case "READY_FOR_DELIVERY":
      return "ready";
    default:
      return "active";
  }
}
