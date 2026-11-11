import { AlarmClock, BellRing, ListChecks } from "lucide-react";
import { formatPay } from "@/lib/finance/format-pay";
import { ORDER_STATUS_TONE } from "@/lib/orders/status-tone";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";

import { requirePermission } from "@/lib/auth/authorize";
import { Card, CardHeader, PHONE_FLUSH } from "@/components/ui/card";
import { DeadlineCountdown } from "@/components/ui/deadline";
import { Disclosure } from "@/components/ui/disclosure";
import { Breadcrumbs, MetaList, Section } from "@/components/ui/page";
import { StatusBadge, StatusDot } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";
import { listAssignableExpenseCategories, listExpensesForOrder, getOrderFinancials } from "@/lib/finance/queries";
import { listAssignableFiverrAccounts } from "@/lib/fiverr-accounts/queries";
import { formatCurrencyBreakdown } from "@/lib/finance/money";
import { isAssignedToIdentity } from "@/lib/orders/assignment";
import { getOrderDetail, listAssignableWorkers } from "@/lib/orders/queries";
import { CALCULATED_ORDER_STATUSES, CLOSED_ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/orders/state-machine";
import { listAssignableOutsourcedWorkers } from "@/lib/outsourced-workers/queries";
import { getWorkloads } from "@/lib/outsourced-workers/workload-queries";
import { EMPTY_WORKLOAD } from "@/lib/outsourced-workers/workload";
import { listServicesForOrderPicker } from "@/lib/services/queries";
import { refreshDueItemStats } from "@/lib/youtube/stats-service";
import { ExpenseForm } from "../../finance/expenses/expense-form";
import { canChangeWholeOrderStatus, orderVisibility, redactOrderDetail } from "@/lib/orders/visibility";
import { AcceptItemsButton } from "../accept-items-button";
import { OrderItemsPanel } from "./order-items-panel";
import { OrderNotesButton } from "./order-notes-button";
import { OrderDetailsCard } from "./order-details-card";
import { OrderStatusActions } from "./order-status-actions";
import { OrderStatusStepper } from "./order-status-stepper";

export const metadata: Metadata = { title: "Order" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default async function OrderDetailPage({ params, searchParams }: PageProps<"/orders/[id]">) {
  const actor = await requirePermission("orders.view");
  const { id } = await params;
  // An item's updates opened from a notification (2026-11-11).
  const rawUpdates = (await searchParams).updates;
  const openUpdatesId = typeof rawUpdates === "string" && /^[0-9a-f-]{36}$/i.test(rawUpdates) ? rawUpdates : null;

  const canEdit = actor.permissions.has("orders.edit");
  const canCreateItems = actor.permissions.has("orders.create");
  const canAssign = actor.permissions.has("orders.assign");
  const canChangeStatus = actor.permissions.has("orders.change_status");
  // Item buttons use canChangeStatus; the whole order's status needs more (see visibility.ts).
  const canChangeOrderStatus = canChangeWholeOrderStatus((key) => actor.permissions.has(key));
  const canComment = actor.permissions.has("orders.comment");
  const canViewActivity = actor.permissions.has("orders.activity.view");
  const canUploadOwn = actor.permissions.has("orders.files.upload");
  const needsItemPickers = canCreateItems || canEdit;
  const canViewFinancials = actor.permissions.has("finance.revenue.view") || actor.permissions.has("finance.profit.view");
  const canViewExpenses = actor.permissions.has("finance.expenses.view");
  const canCreateExpense = actor.permissions.has("finance.expenses.create");

  // One round of requests, not two: the pickers/financials only need the id and
  // permissions, so they load alongside the order (each ~200ms trip to the
  // database region adds up). Nothing is rendered before the checks below.
  const [rawOrder, fiverrAccounts, services, outsourcedWorkerRows, financials, expenses, expenseCategories, expenseUsers, workloads] = await Promise.all([
    getOrderDetail(id),
    canEdit ? listAssignableFiverrAccounts() : Promise.resolve([]),
    needsItemPickers ? listServicesForOrderPicker() : Promise.resolve([]),
    // Assignment is External-Worker-only, 2026-10-08 — see
    // assignOrderItemWorker's doc comment in service.ts. `rates` lets the
    // panel auto-fill cost the moment a worker is chosen.
    canAssign ? listAssignableOutsourcedWorkers() : Promise.resolve([]),
    canViewFinancials ? getOrderFinancials(id) : Promise.resolve(null),
    canViewExpenses ? listExpensesForOrder(id) : Promise.resolve([]),
    canCreateExpense ? listAssignableExpenseCategories() : Promise.resolve([]),
    canCreateExpense ? listAssignableWorkers() : Promise.resolve([]),
    // Each worker's current load, shown when choosing who to assign (2026-11-11).
    canAssign ? getWorkloads() : Promise.resolve(new Map()),
  ]);
  const outsourcedWorkers = outsourcedWorkerRows.map((worker) => ({ ...worker, workload: workloads.get(worker.id) ?? EMPTY_WORKLOAD }));
  if (!rawOrder) notFound();

  const identity = { userId: actor.user.id, outsourcedWorkerId: actor.outsourcedWorkerId };
  const canViewAll = actor.permissions.has("orders.view.all");
  if (!canViewAll) {
    const isAssigned = rawOrder.items.some((item) =>
      isAssignedToIdentity({ workerId: item.worker?.id ?? null, outsourcedWorkerId: item.outsourcedWorker?.id ?? null }, identity),
    );
    if (!isAssigned) redirect("/forbidden?permission=orders.view.all");
  }

  // Opening an order also brings its YouTube stats up to date when they are
  // older than the interval in Settings (2026-11-10). Runs after the page is
  // sent, so it never slows it down; the next visit shows the new numbers.
  after(() => refreshDueItemStats({ orderId: id, limit: 20 }).catch(() => undefined));

  // Everything below renders `order`, never `rawOrder`: values this actor may not see
  // (other workers' items, prices, costs, customer) are removed from the data
  // here, on the server, so they never reach the browser. See src/lib/orders/visibility.ts.
  const visibility = orderVisibility((key) => actor.permissions.has(key));
  const order = redactOrderDetail(rawOrder, identity, visibility);


  // Confirmed directly, 2026-09-28: an order should show at a glance how
  // much of its own work is actually assigned. Derived from `order.items`
  // (already redacted above) rather than `rawOrder.items`, so a restricted
  // worker's count never includes an item they are not shown — see
  // src/lib/orders/visibility.ts.
  const totalItemCount = order.items.length;
  const assignedItemCount = order.items.filter((item) => item.worker || item.outsourcedWorker).length;


  const isOpenOrder = !CLOSED_ORDER_STATUSES.includes(order.status);
  // The signed-in worker's own items waiting to be accepted (2026-11-03): shown
  // as a banner at the top so accepting does not mean hunting for the item.
  const myPendingItemIds = canChangeStatus
    ? order.items
        .filter(
          (item) =>
            item.status === "PENDING" &&
            isAssignedToIdentity({ workerId: item.worker?.id ?? null, outsourcedWorkerId: item.outsourcedWorker?.id ?? null }, identity),
        )
        .map((item) => item.id)
    : [];

  return (
    <>
      <div className="hidden md:block">
        <Breadcrumbs items={[{ label: "Operations" }, { label: "Orders", href: "/orders" }, { label: `#${order.orderNumber}` }]} />
      </div>

      {/* ── Header: identity + status on the left, status actions on the right ── */}
      <header className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-[-0.02em] text-zinc-900 sm:text-[22px]">Order #{order.orderNumber}</h1>
            {visibility.orderDetails || !CALCULATED_ORDER_STATUSES.includes(order.status) ? (
              <StatusBadge tone={ORDER_STATUS_TONE[order.status]} label={ORDER_STATUS_LABELS[order.status]} />
            ) : null}
            {/* Notes stay a top-left, open-when-needed button (confirmed directly,
                2026-10-01) — now in the title row instead of fixed over the page. */}
            <OrderNotesButton orderId={order.id} notes={order.internalNotes} canComment={canComment} />
          </div>
          {visibility.orderDetails ? (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-zinc-500">
            <span>{order.source === "FIVERR" ? "Fiverr" : "External"}</span>
            {order.externalReference ? (
              <>
                <Dot />
                <span className="font-medium text-zinc-700">{order.externalReference}</span>
              </>
            ) : null}
            <Dot />
            <span>
              Created {dateFormat.format(order.orderDate)} UTC{order.createdBy ? ` by ${order.createdBy.fullName}` : ""}
            </span>
            {totalItemCount > 0 ? (
              <>
                <Dot />
                <span>
                  {assignedItemCount}/{totalItemCount} {totalItemCount === 1 ? "item" : "items"} assigned
                </span>
              </>
            ) : null}
          </p>
          ) : order.deadline ? (
            // A worker sees only their own deadline (owner request, 2026-11-03).
            <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-zinc-500">
              <span>Deadline</span>
              <DeadlineCountdown deadline={order.deadline} finished={!isOpenOrder} />
            </p>
          ) : null}
        </div>

        {canChangeOrderStatus ? (
          <OrderStatusActions orderId={order.id} status={order.status} />
        ) : null}
      </header>

      {myPendingItemIds.length > 0 ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-indigo-200/80 bg-indigo-50/70 px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white text-indigo-600 ring-1 ring-inset ring-indigo-200">
              <BellRing aria-hidden="true" className="size-[18px]" />
            </span>
            <div>
              <p className="text-sm font-semibold text-indigo-950">
                {myPendingItemIds.length === 1 ? "You have a new task on this order" : `You have ${myPendingItemIds.length} new tasks on this order`}
              </p>
              <p className="text-[13px] text-indigo-900/70">Accept to start working on it.</p>
            </div>
          </div>
          <AcceptItemsButton
            itemIds={myPendingItemIds}
            label={myPendingItemIds.length > 1 ? `Accept all (${myPendingItemIds.length})` : "Accept task"}
            size="md"
          />
        </div>
      ) : null}

      <div className="mb-6">
        {/* Workers see their own item statuses, not the order's progress (2026-11-03). */}
        {visibility.orderDetails ? <OrderStatusStepper status={order.status} /> : null}
        {canAssign && isOpenOrder && !order.deadline ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
            <AlarmClock aria-hidden="true" className="size-3.5" />
            Set a deadline in Order details before assigning workers.
          </p>
        ) : null}
      </div>

      {/* Items are the main thing on this page (confirmed directly, 2026-09-28):
          the wide column. Details and the collapsed money/dates are the side. */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {/* Rows run edge to edge inside the card; only the header is padded (2026-11-11). */}
          <Card className={cn("overflow-hidden p-0 sm:p-0", PHONE_FLUSH)}>
            <div className="px-4 pt-5 sm:px-6 [&>div]:mb-4">
              <CardHeader
                icon={ListChecks}
                title="Items"
                description="Each item moves through its own status."
                tone="amber"
                actions={
                  totalItemCount > 0 ? (
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                      {assignedItemCount}/{totalItemCount} assigned
                    </span>
                  ) : undefined
                }
              />
            </div>
            <OrderItemsPanel
              orderId={order.id}
              items={order.items}
              services={services}
              outsourcedWorkers={outsourcedWorkers}
              currentUserId={actor.user.id}
              currentOutsourcedWorkerId={actor.outsourcedWorkerId}
              canCreate={canCreateItems}
              canEdit={canEdit}
              canAssign={canAssign}
              canChangeStatus={canChangeStatus}
              canViewAll={canViewAll}
              canUploadOwn={canUploadOwn}
              showCosts={visibility.costs}
              openUpdatesId={openUpdatesId}
            />
          </Card>

          {canViewActivity ? (
            <Section title="Activity" description="What has happened on this order, newest first." className={PHONE_FLUSH}>
              {order.activity.length === 0 ? (
                <p className="text-[13px] text-zinc-500">No activity yet.</p>
              ) : (
                <ol className="relative ml-1.5 space-y-4 border-l border-zinc-200 pl-5">
                  {order.activity.map((entry) => (
                    <li key={entry.id} className="relative">
                      <span aria-hidden="true" className="absolute -left-[25px] top-1 size-2.5 rounded-full bg-white ring-2 ring-indigo-400" />
                      <p className="text-[13px] text-zinc-800">{entry.summary}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{dateFormat.format(entry.createdAt)} UTC</p>
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          ) : null}
        </div>

        <aside className="min-w-0 space-y-6 xl:sticky xl:top-20">
          <OrderDetailsCard
            order={order}
            fiverrAccounts={fiverrAccounts}
            canEdit={canEdit}
            canCreateCustomer={actor.permissions.has("customers.create")}
            showPrice={visibility.prices}
            showParties={visibility.parties}
            showOrderDetails={visibility.orderDetails}
            earningsLabel={visibility.orderDetails ? null : sumPay(order.items)}
            finished={!isOpenOrder}
          />

          {/* Money and dates stay one click away (confirmed directly, 2026-09-28:
              "summary financials and expenses should be hidden under a dropdown").
              Not shown to workers: it lists the order's own dates (2026-11-03). */}
          {visibility.orderDetails ? (
          <Card className={cn("p-5 sm:p-6", PHONE_FLUSH)}>
            <Disclosure
              title="Summary, financials & expenses"
              description={isOpenOrder ? "Dates, revenue, costs and this order's expenses." : "Dates, revenue, costs and expenses for this order."}
              className="border-t-0 pt-0"
            >
              <Section plain title="Summary">
                <MetaList
                  className="sm:grid-cols-2 lg:grid-cols-2"
                  items={[
                    { label: "Status", value: <StatusDot tone={ORDER_STATUS_TONE[order.status]} label={ORDER_STATUS_LABELS[order.status]} /> },
                    ...(visibility.prices ? [{ label: "Total amount", value: `${order.totalAmount} ${order.currency}` }] : []),
                    { label: "Order date", value: `${dateFormat.format(order.orderDate)} UTC` },
                    {
                      label: "Deadline",
                      value: order.deadline ? `${dateFormat.format(order.deadline)} UTC` : <span className="text-zinc-500">Not set</span>,
                    },
                    {
                      label: "Delivered",
                      value: order.deliveredAt ? `${dateFormat.format(order.deliveredAt)} UTC` : <span className="text-zinc-500">Not yet</span>,
                    },
                    { label: "Created by", value: order.createdBy?.fullName ?? "—" },
                    { label: "Updated", value: `${dateFormat.format(order.updatedAt)} UTC` },
                  ]}
                />
              </Section>

              {canViewFinancials && financials ? (
                <Section plain title="Financials" description="Shown per currency, never blended.">
                  <MetaList
                    className="sm:grid-cols-2 lg:grid-cols-2"
                    items={[
                      {
                        label: "Revenue",
                        value: financials.revenue?.recognized
                          ? `${financials.revenue.amount} ${financials.revenue.currency}`
                          : <span className="text-zinc-500">Not yet recognized{order.status === "CANCELLED" ? " (refunded / cancelled)" : ""}</span>,
                      },
                      { label: "Worker cost (outsourced)", value: formatCurrencyBreakdown(financials.workerCostByCurrency) },
                      { label: "Other expenses", value: formatCurrencyBreakdown(financials.expensesByCurrency) },
                      {
                        label: "Profit",
                        value:
                          Object.keys(financials.profitByCurrency).length > 0
                            ? formatCurrencyBreakdown(financials.profitByCurrency)
                            : <span className="text-zinc-500">—</span>,
                      },
                    ]}
                  />
                </Section>
              ) : null}

              {canViewExpenses ? (
                <Section
                  plain
                  title="Expenses"
                  description="Tied to this order, never netted automatically."
                  actions={canCreateExpense ? <ExpenseForm categories={expenseCategories} users={expenseUsers} canCreate orderId={order.id} /> : undefined}
                >
                  {expenses.length === 0 ? (
                    <p className="text-[13px] text-zinc-500">No expenses recorded for this order.</p>
                  ) : (
                    <ul className="divide-y divide-zinc-100">
                      {expenses.map((expense) => (
                        <li key={expense.id} className="py-2.5 text-[13px]">
                          <p className="flex items-center justify-between gap-3">
                            <span className="font-medium text-zinc-900">{expense.categoryName}</span>
                            <span className="tabular-nums text-zinc-900">
                              {expense.amount} {expense.currency}
                            </span>
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {expense.description ? `${expense.description} · ` : ""}
                            {dateFormat.format(expense.date)} UTC
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              ) : null}
            </Disclosure>
          </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function Dot() {
  return <span aria-hidden="true" className="size-1 rounded-full bg-zinc-300" />;
}

/**
 * A worker's pay for their items on this order, per currency, never blended
 * (D1): "250.00 PKR" or "250.00 PKR + 10.00 USD". Items arrive redacted, so
 * only the worker's own costs are present.
 */
function sumPay(items: ReadonlyArray<{ workerCost: string | null; workerCostCurrency: string; status: string }>): string | null {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (!item.workerCost || item.status === "CANCELLED") continue;
    totals.set(item.workerCostCurrency, (totals.get(item.workerCostCurrency) ?? 0) + Number(item.workerCost));
  }
  if (totals.size === 0) return null;
  return [...totals].map(([currency, amount]) => formatPay(amount, currency)).join(" + ");
}
