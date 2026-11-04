import type { Metadata } from "next";
import { formatPay } from "@/lib/finance/format-pay";
import { WorkerTasksTable, type WorkerTaskRow } from "./worker-tasks-table";
import { safeExternalHref } from "@/lib/orders/url-normalize";
import { ITEM_STATUS_TONE, ORDER_STATUS_TONE } from "@/lib/orders/status-tone";
import Link from "next/link";
import { Columns3, Inbox, type LucideIcon, Plus, Rows3 } from "lucide-react";
import type { ReactNode } from "react";
import { z } from "zod";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Breadcrumbs, PageHeader } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { listAssignableCategories } from "@/lib/categories/queries";
import { listAssignableCustomers } from "@/lib/customers/queries";
import { requireScope } from "@/lib/auth/authorize";
import { listAssignableOutsourcedWorkers } from "@/lib/outsourced-workers/queries";
import { boardItemWhere, isAssignedToIdentity } from "@/lib/orders/assignment";
import {
  listAssignableWorkers,
  listBoardItems,
  listOrders,
  countOrdersByStatus,
  MAX_PAGE_SIZE,
  ORDERS_PAGE_SIZE,
  type OrderListFilters,
  type OrderListItemRow,
  type OrderScope,
} from "@/lib/orders/queries";
import { aggregateProgress } from "@/lib/orders/progress";
import { earliest, orderVisibility, redactOrderListItems } from "@/lib/orders/visibility";
import { listAssignableServices } from "@/lib/services/queries";
import { CLOSED_ORDER_STATUSES, deriveOrderStatus, ORDER_ITEM_STATUS_LABELS, ORDER_STATUS_LABELS, ORDER_STATUS_VALUES } from "@/lib/orders/state-machine";
import { SERVICE_METRIC_TYPE_LABELS } from "@/lib/services/metric-type";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/generated/prisma/client";
import { OrderFilterBar } from "./order-filter-bar";
import { OrdersBoard, type BoardCard } from "./orders-board";
import { OrdersTable, type OrdersTableRow } from "./orders-table";

export const metadata: Metadata = { title: "Orders" };

const searchParamsSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z
    .enum(["PENDING", "ASSIGNED", "PROCESSING", "PARTIALLY_COMPLETED", "COMPLETED", "DELIVERED", "FINALIZED", "CANCELLED"])
    // An old bookmark with a retired status just shows every order.
    .optional()
    .catch(undefined),
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
  view: z.enum(["list", "board"]).catch("list"),
});


export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const { actor, scope } = await requireScope("orders.view");

  const raw = await searchParams;
  const params = searchParamsSchema.parse(raw);

  // What this actor may see — see src/lib/orders/visibility.ts. Filters and columns they may not
  // see are neither loaded nor rendered, so the names/amounts never reach their browser.
  const visibility = orderVisibility((key) => actor.permissions.has(key));
  const identity = { userId: actor.user.id, outsourcedWorkerId: actor.outsourcedWorkerId };
  const canViewAll = scope === "ALL";
  const orderScope: OrderScope = canViewAll ? { mode: "ALL" } : { mode: "ASSIGNED", ...identity };
  const isBoardView = params.view === "board";
  const listFilters: OrderListFilters = {
    page: params.page,
    pageSize: params.size,
    search: params.q,
    // Order statuses depend on other workers' items, so a worker can neither
    // filter nor count by them (2026-11-03) — that would reveal those items.
    status: visibility.orderDetails ? params.status : undefined,
    source: visibility.orderDetails ? params.source : undefined,
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
  };
  const now = new Date();

  const [result, customers, workers, outsourcedWorkers, services, categories, boardItems, statusCounts] = await Promise.all([
    isBoardView ? Promise.resolve(null) : listOrders(listFilters, orderScope),
    isBoardView || !visibility.pickers.customers ? Promise.resolve([]) : listAssignableCustomers(),
    isBoardView || !visibility.pickers.workers ? Promise.resolve([]) : listAssignableWorkers(),
    isBoardView || !visibility.pickers.workers ? Promise.resolve([]) : listAssignableOutsourcedWorkers(),
    isBoardView || !visibility.pickers.catalog ? Promise.resolve([]) : listAssignableServices(),
    isBoardView || !visibility.pickers.catalog ? Promise.resolve([]) : listAssignableCategories(),
    isBoardView ? listBoardItems(boardItemWhere(identity, canViewAll)) : Promise.resolve([]),
    isBoardView || !visibility.orderDetails ? Promise.resolve(null) : countOrdersByStatus(listFilters, orderScope),
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

  // Redact to this actor's own item(s) BEFORE computing the aggregate, so a
  // restricted Worker's progress bar always matches the breakdown shown in
  // their own dropdown (confirmed directly, 2026-10-05) — never the order's
  // true total, which would leak that other items/workers exist.
  // Accept from the list (owner request, 2026-11-03): only the assigned
  // worker's own pending items — the same rule as the order page's Accept.
  const canChangeItemStatus = actor.permissions.has("orders.change_status");
  const canAcceptItem = (item: OrderListItemRow) =>
    canChangeItemStatus &&
    item.status === "PENDING" &&
    isAssignedToIdentity({ workerId: item.workerId, outsourcedWorkerId: item.outsourcedWorker?.id ?? null }, identity);

  const tableRows: OrdersTableRow[] = (result?.rows ?? []).map((order) => {
    const visibleItems = redactOrderListItems(order.items, identity, visibility);
    const progress = aggregateProgress(
      visibleItems.map((item) => ({
        targetCount: item.targetCount,
        currentCount: item.currentCount,
        startingCount: item.startingCount,
      })),
    );

    // A worker's deadline is the earliest of their own items' deadlines,
    // never the order's (owner request, 2026-11-03; see visibility.ts).
    const deadline = visibility.orderDetails ? order.deadline : earliest(visibleItems.map((item) => item.deadline));
    // Same rule as redactOrderDetail: a worker's status comes from their own items.
    const rowStatus = visibility.orderDetails
      ? order.status
      : deriveOrderStatus(order.status, visibleItems.map((item) => ({ status: item.status, assigned: Boolean(item.worker || item.outsourcedWorker) })));

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      // Must match `showCustomer` below exactly — this is a CLIENT component
      // prop, so an unconditional value here would leak the customer's name
      // into the page's serialized payload even where the `<TD>` itself is
      // never rendered (found via tests/e2e/worker-boundaries.spec.ts,
      // 2026-10-08 — the same class of bug `redactOrderListItems` exists to
      // prevent, missed here since this field isn't part of that helper).
      customerName: visibility.parties ? order.customerName : null,
      statusLabel: ORDER_STATUS_LABELS[rowStatus],
      statusTone: ORDER_STATUS_TONE[rowStatus],
      deadline,
      finished: CLOSED_ORDER_STATUSES.includes(order.status),
      isOverdue: isOrderOverdue(deadline, order.status),
      // A restricted worker counts only their own items, never the order's total.
      itemCount: visibility.allItems ? order.itemCount : visibleItems.length,
      amountLabel: visibility.prices ? `${order.totalAmount} ${order.currency}` : null,
      progressPercent: progress?.percent ?? null,
      // One entry per distinct channel among the visible items, so the table
      // can link straight to it (owner request, 2026-11-03).
      channels: channelLinks(visibleItems.map((item) => item.channelLink)),
      items: visibleItems.map((item) => ({
        id: item.id,
        channel: channelLinks([item.channelLink])[0] ?? null,
        canAccept: canAcceptItem(item),
        serviceName: item.serviceName,
        assigneeLabel: item.worker?.fullName ?? item.outsourcedWorker?.name ?? "Unassigned",
        statusLabel: ORDER_ITEM_STATUS_LABELS[item.status],
        statusTone: ITEM_STATUS_TONE[item.status],
        metricLabel: item.metricType ? SERVICE_METRIC_TYPE_LABELS[item.metricType].toLowerCase() : null,
        currentCount: item.currentCount,
        targetCount: item.targetCount,
      })),
    };
  });

  // A worker sees one row per task, with their pay (owner request,
  // 2026-11-03: "for outsourced worker the order item is the order").
  const showTasks = !visibility.allItems;
  const taskRows: WorkerTaskRow[] = showTasks
    ? (result?.rows ?? []).flatMap((order) =>
        redactOrderListItems(order.items, identity, visibility).map((item) => {
          const progress = aggregateProgress([
            { targetCount: item.targetCount, currentCount: item.currentCount, startingCount: item.startingCount },
          ]);
          return {
            id: item.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            serviceName: item.serviceName,
            channel: channelLinks([item.channelLink])[0] ?? null,
            statusLabel: ORDER_ITEM_STATUS_LABELS[item.status],
            statusTone: ITEM_STATUS_TONE[item.status],
            canAccept: canAcceptItem(item),
            deadline: item.deadline,
            finished: item.status === "DONE" || item.status === "CANCELLED",
            metricLabel: item.metricType ? SERVICE_METRIC_TYPE_LABELS[item.metricType].toLowerCase() : null,
            currentCount: item.currentCount,
            targetCount: item.targetCount,
            progressPercent: progress?.percent ?? null,
            earningsLabel: item.workerCost ? formatPay(item.workerCost, item.workerCostCurrency) : null,
          };
        }),
      )
    : [];

  const canChangeStatus = actor.permissions.has("orders.change_status");
  const boardCards: BoardCard[] = boardItems.map((item) => {
    const asAssignedWorkerOnly =
      !canViewAll &&
      isAssignedToIdentity({ workerId: item.worker?.id ?? null, outsourcedWorkerId: item.outsourcedWorker?.id ?? null }, identity);
    const progress = aggregateProgress([{ targetCount: item.targetCount, currentCount: item.currentCount, startingCount: item.startingCount }]);
    return {
      id: item.id,
      orderId: item.orderId,
      orderNumber: item.orderNumber,
      serviceName: item.serviceName,
      assigneeLabel: item.outsourcedWorker?.name ?? item.worker?.fullName ?? "Unassigned",
      status: item.status,
      metricLabel: item.metricType ? SERVICE_METRIC_TYPE_LABELS[item.metricType].toLowerCase() : null,
      currentCount: item.currentCount,
      targetCount: item.targetCount,
      progressPercent: progress?.percent ?? null,
      // Own pay is visible to the worker too (2026-11-03).
      costLabel: (visibility.costs || asAssignedWorkerOnly) && item.workerCost ? `${item.workerCost} ${item.workerCostCurrency}` : null,
      canDrag: canChangeStatus && (canViewAll || asAssignedWorkerOnly),
      asAssignedWorkerOnly,
      requiresGuidedCancel: item.outsourcedWorker != null,
    };
  });

  const canCreate = actor.permissions.has("orders.create");

  return (
    <>
      <Breadcrumbs items={[{ label: "Operations" }, { label: "Orders" }]} />
      <PageHeader
        title="Orders"
        description={
          scope === "ASSIGNED"
            ? "Your tasks, one per row, with what you'll earn for each."
            : "Every order in the business."
        }
        actions={
          canCreate ? (
            <Link
              href="/orders/new"
              className={buttonVariants({ variant: "accent", className: "h-9 rounded-[8px] px-3.5 text-[13px] font-semibold" })}
            >
              <Plus aria-hidden="true" />
              New order
            </Link>
          ) : undefined
        }
      />

      <div className="">
        {/* List/Board toggle — confirmed directly, 2026-10-08: "in the orders
            page there should be option to view board or list." Plain links, not
            a client toggle, so the choice is a URL (linkable, shareable, survives
            a refresh) like every other filter here. */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Orders view" className="inline-flex h-9 gap-1 rounded-[9px] bg-zinc-200/60 p-1 ring-1 ring-inset ring-zinc-200/70">
            {([
              ["list", "List", Rows3],
              ["board", "Board", Columns3],
            ] as const).map(([view, label, Icon]) => {
              const active = isBoardView === (view === "board");
              return (
                <Link
                  key={view}
                  href={viewHref(params, view)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-[6px] px-3 text-[13px] font-medium transition",
                    active
                      ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(16,24,40,0.08),0_0_0_1px_rgba(16,24,40,0.04)]"
                      : "text-zinc-500 hover:text-zinc-800",
                  )}
                >
                  <Icon aria-hidden="true" className="size-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>
          {!isBoardView && result ? (
            <p className="text-xs text-zinc-500">
              {showTasks && result.pageCount === 1 ? (
                <>
                  <span className="font-medium tabular-nums text-zinc-800">{taskRows.length}</span> {taskRows.length === 1 ? "task" : "tasks"}
                </>
              ) : (
                <>
                  <span className="font-medium tabular-nums text-zinc-800">{result.total}</span> {result.total === 1 ? "order" : "orders"}
                </>
              )}
            </p>
          ) : isBoardView ? (
            <p className="text-xs text-zinc-500">Drag an item to change its status.</p>
          ) : null}
        </div>

        {isBoardView ? (
          boardCards.length === 0 ? (
            <Card className={SURFACE}>
              <ListEmpty icon={Columns3} title="No items to show" text="Items you may see will appear here, grouped by status." />
            </Card>
          ) : (
            <OrdersBoard cards={boardCards} />
          )
        ) : (
          <div className="space-y-4">
            {statusCounts ? <StatusTabs params={params} counts={statusCounts} /> : null}

            <OrderFilterBar
              initialSearch={params.q ?? ""}
              customers={customers.map((c) => ({ id: c.id, label: c.name }))}
              workers={workers.map((w) => ({ id: w.id, label: w.fullName }))}
              outsourcedWorkers={outsourcedWorkers.map((w) => ({ id: w.id, label: w.name }))}
              services={services.map((s) => ({ id: s.id, label: s.name }))}
              categories={categories.map((c) => ({ id: c.id, label: c.name }))}
              showSource={visibility.orderDetails}
            />

            <Card className={cn(SURFACE, "overflow-hidden p-0 sm:p-0")}>
              {tableRows.length === 0 ? (
                <ListEmpty
                  icon={Inbox}
                  title="No orders found"
                  text="Try changing the filters, or create a new order."
                  action={
                    canCreate ? (
                      <Link
                        href="/orders/new"
                        className={buttonVariants({ variant: "accent", className: "h-9 rounded-[8px] px-3.5 text-[13px] font-semibold" })}
                      >
                        <Plus aria-hidden="true" />
                        New order
                      </Link>
                    ) : undefined
                  }
                />
              ) : (
                <>
                  {showTasks ? (
                    <WorkerTasksTable rows={taskRows} />
                  ) : (
                    <OrdersTable rows={tableRows} showCustomer={visibility.parties} showAmount={visibility.prices} />
                  )}
                  <div className="border-t border-zinc-100 px-5 pb-4">
                    <Pagination
                      page={result!.page}
                      pageCount={result!.pageCount}
                      total={result!.total}
                      itemLabel="order"
                      buildHref={buildHref}
                    />
                  </div>
                </>
              )}
            </Card>
          </div>
        )}
      </div>
    </>
  );

  /** Overdue = has a deadline in the past and is not finished. */
  function isOrderOverdue(deadline: Date | null, status: OrderStatus): boolean {
    return deadline !== null && deadline < now && !CLOSED_ORDER_STATUSES.includes(status);
  }
}

/** Raised white surface shared with the New Order page and dashboard. */
const SURFACE = "border-zinc-200/80 p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.12)]";

function ListEmpty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-zinc-100 text-zinc-500">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium text-zinc-900">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-zinc-500">{text}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Tab order follows the order lifecycle. */
const STATUS_TABS: ReadonlyArray<OrderStatus> = ORDER_STATUS_VALUES;

/**
 * Status views as tabs with live counts — replaces the nine sidebar shortcuts
 * (owner-directed, 2026-11-03). Counts honour every other active filter.
 */
function StatusTabs({
  params,
  counts,
}: {
  params: Record<string, unknown>;
  counts: { total: number; byStatus: Partial<Record<OrderStatus, number>> };
}) {
  const active = (params.status as OrderStatus | undefined) ?? null;
  const tabs: Array<{ key: OrderStatus | null; label: string; count: number }> = [
    { key: null, label: "All", count: counts.total },
    ...STATUS_TABS.map((status) => ({ key: status, label: ORDER_STATUS_LABELS[status], count: counts.byStatus[status] ?? 0 }))
      // An empty status is noise — hide it, unless it is the one being viewed.
      .filter((tab) => tab.count > 0 || tab.key === active),
  ];

  return (
    <nav aria-label="Order status" className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
      <ul className="flex w-max min-w-full gap-1 border-b border-zinc-200/80">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <li key={tab.key ?? "all"}>
              <Link
                href={statusHref(params, tab.key)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "relative -mb-px inline-flex h-10 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-[13px] font-medium transition-colors",
                  isActive
                    ? "border-indigo-600 text-zinc-900"
                    : cn("border-transparent hover:border-zinc-300 hover:text-zinc-900", tab.count === 0 ? "text-zinc-400" : "text-zinc-500"),
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold leading-5 tabular-nums",
                    isActive ? "bg-indigo-600 text-white" : "bg-zinc-200/70 text-zinc-600",
                  )}
                >
                  {tab.count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function statusHref(params: Record<string, unknown>, status: OrderStatus | null): string {
  const url = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "status" || key === "page" || key === "view" || value === undefined) continue;
    if (key === "size" && value === ORDERS_PAGE_SIZE) continue;
    url.set(key, String(value));
  }
  if (status) url.set("status", status);
  const search = url.toString();
  return search ? `/orders?${search}` : "/orders";
}

function viewHref(params: Record<string, unknown>, view: "list" | "board"): string {
  const url = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "view" || key === "page" || value === undefined) continue;
    if (key === "size" && value === ORDERS_PAGE_SIZE) continue;
    url.set(key, String(value));
  }
  if (view !== "list") url.set("view", view);
  const search = url.toString();
  return search ? `/orders?${search}` : "/orders";
}


/**
 * Distinct, safe-to-open channel links with a short label
 * ("youtube.com/@channel"). A link that is not plain http(s) is dropped
 * rather than rendered (same rule as everywhere else, safeExternalHref).
 */
function channelLinks(links: ReadonlyArray<string | null>): Array<{ href: string; label: string }> {
  const seen = new Set<string>();
  const result: Array<{ href: string; label: string }> = [];
  for (const link of links) {
    const href = link ? safeExternalHref(link) : null;
    if (!href || seen.has(href)) continue;
    seen.add(href);
    result.push({ href, label: href.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "") });
  }
  return result;
}
