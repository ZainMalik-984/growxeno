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
import { Card, PHONE_FLUSH } from "@/components/ui/card";
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
import { completionBlocker } from "@/lib/orders/completion";
import { earliest, orderVisibility, redactOrderListItems } from "@/lib/orders/visibility";
import { listAssignableServices } from "@/lib/services/queries";
import { CLOSED_ORDER_STATUSES, deriveOrderStatus, ORDER_ITEM_STATUS_LABELS, ORDER_STATUS_LABELS, ORDER_STATUS_VALUES } from "@/lib/orders/state-machine";
import { SERVICE_METRIC_TYPE_LABELS } from "@/lib/services/metric-type";
import { cn } from "@/lib/utils";
import { canTransitionItem } from "@/lib/orders/state-machine";
import { listWorkerTasks, type WorkerTask } from "@/lib/orders/worker-tasks";
import { WORKER_TASK_VIEW_LABELS, WORKER_TASK_VIEWS, type WorkerTaskView } from "@/lib/orders/worker-task-view";
import { Search } from "lucide-react";
import type { OrderStatus } from "@/generated/prisma/client";
import { OrderFilterBar } from "./order-filter-bar";
import { OrdersBoard, type BoardCard } from "./orders-board";
import { OrdersTable, type OrdersTableRow } from "./orders-table";
import { LoadMoreOnScroll } from "./load-more";

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
  // Orders with a screenshot request waiting for the team (2026-11-11).
  screenshots: z.enum(["1"]).optional(),
  link: z.string().trim().max(300).optional(),
  amountMin: z.string().trim().max(20).optional(),
  amountMax: z.string().trim().max(20).optional(),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(ORDERS_PAGE_SIZE),
  due: z.enum(["overdue"]).optional(),
  view: z.enum(["list", "board"]).catch("list"),
  // An External Worker's task tabs (2026-11-11): "To do" (pending, processing, refill) by default.
  task: z.enum(WORKER_TASK_VIEWS).catch("active"),
  // A task opened from its accept link (2026-11-11): shows that task's popup.
  open: z.uuid().optional().catch(undefined),
  // A task's updates opened from a notification (2026-11-11).
  updates: z.uuid().optional().catch(undefined),
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
    // Only the team answers requests, so only they filter by them.
    screenshotRequests: visibility.allItems && params.screenshots === "1",
    linkQuery: params.link,
    // An amount filter is a side channel onto totals the actor may not see (binary-search a price).
    amountMin: visibility.prices ? params.amountMin : undefined,
    amountMax: visibility.prices ? params.amountMax : undefined,
  };
  const now = new Date();
  // A worker sees one row per task, with their pay (owner request,
  // 2026-11-03: "for outsourced worker the order item is the order").
  const showTasks = !visibility.allItems;

  const [result, customers, workers, outsourcedWorkers, services, categories, boardItems, statusCounts] = await Promise.all([
    isBoardView || showTasks ? Promise.resolve(null) : listOrders(listFilters, orderScope),
    isBoardView || !visibility.pickers.customers ? Promise.resolve([]) : listAssignableCustomers(),
    isBoardView || !visibility.pickers.workers ? Promise.resolve([]) : listAssignableWorkers(),
    isBoardView || !visibility.pickers.workers ? Promise.resolve([]) : listAssignableOutsourcedWorkers(),
    isBoardView || !visibility.pickers.catalog ? Promise.resolve([]) : listAssignableServices(),
    isBoardView || !visibility.pickers.catalog ? Promise.resolve([]) : listAssignableCategories({ includeInactive: true }),
    isBoardView ? listBoardItems(boardItemWhere(identity, canViewAll)) : Promise.resolve([]),
    isBoardView || !visibility.orderDetails ? Promise.resolve(null) : countOrdersByStatus(listFilters, orderScope),
  ]);
  const workerTasks =
    showTasks && !isBoardView ? await listWorkerTasks(identity, { view: params.task, search: params.q, focusId: params.open }) : null;

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
      channels: channelLinks(visibleItems.map((item) => ({ link: item.channelLink, title: item.channelTitle }))),
      openRequests: visibility.allItems ? visibleItems.filter((item) => item.hasOpenRequest).length : 0,
      withdrawRequests: visibility.allItems ? visibleItems.filter((item) => item.hasWithdrawRequest).length : 0,
      items: visibleItems.map((item) => ({
        id: item.id,
        channel: channelLinks([{ link: item.channelLink, title: item.channelTitle }])[0] ?? null,
        canAccept: canAcceptItem(item),
        serviceName: item.serviceName,
        assigneeLabel: item.worker?.fullName ?? item.outsourcedWorker?.name ?? "Unassigned",
        statusLabel: ORDER_ITEM_STATUS_LABELS[item.status],
        statusTone: ITEM_STATUS_TONE[item.status],
        metricLabel: item.metricType ? SERVICE_METRIC_TYPE_LABELS[item.metricType].toLowerCase() : null,
        startingCount: item.startingCount,
        currentCount: item.currentCount,
        targetCount: item.targetCount,
      })),
    };
  });

  // Sorted and filtered by listWorkerTasks (2026-11-11): pending, then processing, then refill, oldest first.
  const taskRows: WorkerTaskRow[] = (workerTasks?.tasks ?? []).map((task) => toTaskRow(task, canChangeItemStatus));

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
      {/* Phones get a compact header: no breadcrumb or description (2026-11-11). */}
      <div className="hidden md:block">
        <Breadcrumbs items={[{ label: "Operations" }, { label: "Orders" }]} />
      </div>
      <PageHeader
        title="Orders"
        description={
          <span className="hidden md:inline">
            {scope === "ASSIGNED" ? "Your tasks, one per row, with what you'll earn for each." : "Every order in the business."}
          </span>
        }
        actions={
          canCreate ? (
            <span className="hidden md:contents">
              <Link
                href="/orders/new"
                className={buttonVariants({ variant: "accent", className: "h-9 rounded-[8px] px-3.5 text-[13px] font-semibold" })}
              >
                <Plus aria-hidden="true" />
                New order
              </Link>
            </span>
          ) : undefined
        }
      />

      {/* Room under the list on phones so the + button never covers the last card. */}
      <div className={cn(canCreate && "max-md:pb-20")}>
        {/* List/Board toggle — confirmed directly, 2026-10-08: "in the orders
            page there should be option to view board or list." Plain links, not
            a client toggle, so the choice is a URL (linkable, shareable, survives
            a refresh) like every other filter here. */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 md:mb-4">
          <nav aria-label="Orders view" className="hidden h-9 gap-1 md:inline-flex rounded-[9px] bg-zinc-200/60 p-1 ring-1 ring-inset ring-zinc-200/70">
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
          {!isBoardView && workerTasks ? (
            <p className="text-xs text-zinc-500">
              <span className="font-medium tabular-nums text-zinc-800">{taskRows.length}</span> {taskRows.length === 1 ? "task" : "tasks"}
            </p>
          ) : !isBoardView && result ? (
            <p className="text-xs text-zinc-500">
              <span className="font-medium tabular-nums text-zinc-800">{result.total}</span> {result.total === 1 ? "order" : "orders"}
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
        ) : workerTasks ? (
          <div className="space-y-4">
            <WorkerTaskTabs active={params.task} search={params.q} counts={workerTasks.counts} />
            <form method="get" action="/orders" role="search" className="relative max-w-sm">
              {params.task !== "active" ? <input type="hidden" name="task" value={params.task} /> : null}
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                name="q"
                defaultValue={params.q ?? ""}
                aria-label="Search your tasks"
                placeholder="Search by service, channel or order #"
                className="h-9 w-full rounded-[8px] border border-zinc-200 bg-white pl-9 pr-3 text-[13px] shadow-[0_1px_1px_rgba(16,24,40,0.03)] placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
              />
            </form>
            <Card className={cn(SURFACE, "overflow-hidden p-0 sm:p-0", PHONE_FLUSH)}>
              {taskRows.length === 0 && !workerTasks.focus ? (
                <ListEmpty
                  icon={Inbox}
                  title={params.q ? "No tasks match your search" : params.task === "active" ? "Nothing to do right now" : "No tasks here"}
                  text={
                    params.task === "active"
                      ? "New tasks assigned to you appear here. Finished ones are under Completed."
                      : "Tasks with this status will appear here."
                  }
                />
              ) : (
                <WorkerTasksTable
                  // Remount when a notification link changes ?open= / ?updates= on this same page, so its popup opens
                  // without a refresh (2026-11-12): popups start from these props.
                  key={`${params.open ?? ""}|${params.updates ?? ""}`}
                  rows={taskRows}
                  focus={workerTasks.focus ? toTaskRow(workerTasks.focus, canChangeItemStatus) : null}
                  openUpdatesId={params.updates ?? null}
                />
              )}
            </Card>
          </div>
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
              showRequests={visibility.allItems}
            />

            <Card className={cn(SURFACE, "overflow-hidden p-0 sm:p-0", PHONE_FLUSH)}>
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
                  <OrdersTable rows={tableRows} showCustomer={visibility.parties} showAmount={visibility.prices} />
                  {result!.page === 1 ? (
                    <LoadMoreOnScroll
                      shown={tableRows.length}
                      total={result!.total}
                      nextHref={sizeHref(params, Math.min(MAX_PAGE_SIZE, params.size + ORDERS_PAGE_SIZE))}
                      atMax={params.size >= MAX_PAGE_SIZE}
                      nextPageHref={buildHref(2)}
                    />
                  ) : null}
                  <div className={cn("border-t border-zinc-100 px-5 pb-4", result!.page === 1 && "hidden md:block")}>
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

      {canCreate ? (
        <Link
          href="/orders/new"
          aria-label="New order"
          className="fixed bottom-5 right-5 z-30 grid size-14 place-items-center rounded-full bg-indigo-600 text-white shadow-[0_10px_30px_-8px_rgba(79,70,229,0.6)] transition active:scale-95 md:hidden"
        >
          <Plus aria-hidden="true" className="size-6" />
        </Link>
      ) : null}
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
                  "relative -mb-px inline-flex h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 md:h-10 text-[13px] font-medium transition-colors",
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

/** Same filters, page 1, `size` rows: "load more" on phones grows the first page. */
function sizeHref(params: Record<string, unknown>, size: number): string {
  const url = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || key === "size" || value === undefined) continue;
    if (key === "view" && value === "list") continue;
    if (key === "task" && value === "active") continue;
    url.set(key, String(value));
  }
  if (size !== ORDERS_PAGE_SIZE) url.set("size", String(size));
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
function channelLinks(
  links: ReadonlyArray<{ link: string | null; title: string | null }>,
): Array<{ href: string; label: string; title: string | null }> {
  const seen = new Set<string>();
  const result: Array<{ href: string; label: string; title: string | null }> = [];
  for (const { link, title } of links) {
    const href = link ? safeExternalHref(link) : null;
    if (!href || seen.has(href)) continue;
    seen.add(href);
    // The channel/video name read from YouTube shows with the link (2026-11-11).
    result.push({ href, label: shortLink(href), title });
  }
  return result;
}

function shortLink(href: string): string {
  return href.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "");
}

/** Delivered = current − starting (never below 0, may pass required); required = target − starting. */
function deliveredOf(task: { startingCount: number | null; currentCount: number | null; targetCount: number | null }): {
  delivered: number | null;
  required: number | null;
} {
  if (task.targetCount === null) return { delivered: null, required: null };
  const start = Math.max(0, task.startingCount ?? 0);
  return {
    delivered: Math.max(0, (task.currentCount ?? start) - start),
    required: Math.max(0, task.targetCount - start),
  };
}

/** One task row for an External Worker (2026-11-11). Accept on pending; Complete on processing and refill. */
function toTaskRow(task: WorkerTask, canChangeItemStatus: boolean): WorkerTaskRow {
  const progress = aggregateProgress([{ targetCount: task.targetCount, currentCount: task.currentCount, startingCount: task.startingCount }]);
  const channelStats = task.metricType === "SUBSCRIBERS" || task.metricType === "WATCH_HOURS" || task.metricType === "FOLLOWERS";
  return {
    id: task.id,
    orderId: task.orderId,
    orderNumber: task.orderNumber,
    serviceName: task.serviceName,
    channel: channelLinks([{ link: task.channelLink, title: null }])[0] ?? null,
    channelTitle: task.channelTitle,
    isYoutube: task.channelLink ? /youtube\.com|youtu\.be/i.test(task.channelLink) : false,
    studioUrl: task.studioUrl,
    isWatchHours: task.metricType === "WATCH_HOURS",
    // A done task waits for the team to accept the delivery (2026-11-12).
    statusLabel: task.status === "DONE" ? (task.deliveryAccepted ? "Accepted" : "Awaiting acceptance") : ORDER_ITEM_STATUS_LABELS[task.status],
    statusTone: task.status === "DONE" && !task.deliveryAccepted ? "warning" : ITEM_STATUS_TONE[task.status],
    isRefill: task.status === "REFILL",
    canAccept: canChangeItemStatus && task.status === "PENDING",
    canComplete:
      canChangeItemStatus && task.status !== "PENDING" && canTransitionItem(task.status, "DONE", { asAssignedWorkerOnly: true }),
    // Complete stays off until YouTube shows the target (2026-11-12).
    completeBlocker: completionBlocker({
      metricType: task.metricType,
      categoryName: task.categoryName,
      currentCount: task.currentCount,
      targetCount: task.targetCount,
    }),
    // Updates thread (2026-11-11): the count, a note, screenshots. The count itself needs the task accepted (checked on post).
    // Before accepting: only Accept / Reject (2026-11-12).
    canPostUpdate: canChangeItemStatus && (task.status === "PROCESSING" || task.status === "REFILL" || task.status === "DONE"),
    updateCount: task.updateCount,
    hasOpenRequest: task.hasOpenRequest,
    hasWithdrawRequest: task.hasWithdrawRequest,
    assignedAt: task.assignedAt,
    finishedAt: task.finishedAt,
    deadline: task.deadline,
    finished: task.status === "DONE" || task.status === "CANCELLED",
    metricLabel: task.metricType ? SERVICE_METRIC_TYPE_LABELS[task.metricType].toLowerCase() : null,
    startingCount: task.startingCount,
    currentCount: task.currentCount,
    targetCount: task.targetCount,
    progressPercent: progress?.percent ?? null,
    // Progress as the worker sees it: what they delivered since the task started, out of what was asked (2026-11-11).
    ...deliveredOf(task),
    earningsLabel: task.workerCost ? formatPay(task.workerCost, task.workerCostCurrency) : null,
    description: task.description,
    stats: task.stats
      ? channelStats
        ? [
            { label: "Subscribers", value: task.stats.subscribers },
            { label: "Total views", value: task.stats.views },
          ]
        : [
            { label: "Views", value: task.stats.views },
            { label: "Likes", value: task.stats.likes },
            { label: "Comments", value: task.stats.comments },
          ]
      : null,
    statsAt: task.stats?.at ?? null,
    links: task.links.flatMap((link) => {
      const href = safeExternalHref(link.url);
      return href ? [{ id: link.id, href, label: link.label || shortLink(href) }] : [];
    }),
  };
}

/** An External Worker's task tabs with counts (2026-11-11). "To do" is the default; Completed and Cancelled sit apart. */
function WorkerTaskTabs({
  active,
  search,
  counts,
}: {
  active: WorkerTaskView;
  search: string | undefined;
  counts: Record<WorkerTaskView, number>;
}) {
  return (
    <nav aria-label="Task status" className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
      <ul className="flex w-max min-w-full gap-1 border-b border-zinc-200/80">
        {WORKER_TASK_VIEWS.map((view) => {
          const isActive = active === view;
          const url = new URLSearchParams();
          if (view !== "active") url.set("task", view);
          if (search) url.set("q", search);
          const query = url.toString();
          return (
            <li key={view} className={view === "done" ? "ml-auto" : undefined}>
              <Link
                href={query ? `/orders?${query}` : "/orders"}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "relative -mb-px inline-flex h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 md:h-10 text-[13px] font-medium transition-colors",
                  isActive ? "border-indigo-600 text-zinc-900" : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-900",
                )}
              >
                {WORKER_TASK_VIEW_LABELS[view]}
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold leading-5 tabular-nums",
                    isActive ? "bg-indigo-600 text-white" : "bg-zinc-200/70 text-zinc-600",
                  )}
                >
                  {counts[view]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
