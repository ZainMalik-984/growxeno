import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/authorize";
import { Disclosure } from "@/components/ui/disclosure";
import { Breadcrumbs, MetaList, PageHeader, Section } from "@/components/ui/page";
import { StatusDot } from "@/components/ui/status-dot";
import { listAssignableExpenseCategories, listExpensesForOrder, getOrderFinancials } from "@/lib/finance/queries";
import { listAssignableFiverrAccounts } from "@/lib/fiverr-accounts/queries";
import { formatCurrencyBreakdown } from "@/lib/finance/money";
import { getOrderDetail, listAssignableWorkers } from "@/lib/orders/queries";
import { ORDER_STATUS_LABELS } from "@/lib/orders/state-machine";
import { listAssignableOutsourcedWorkers } from "@/lib/outsourced-workers/queries";
import { listServicesForOrderPicker } from "@/lib/services/queries";
import { ExpenseForm } from "../../finance/expenses/expense-form";
import { orderVisibility, redactOrderDetail } from "@/lib/orders/visibility";
import { OrderItemsPanel } from "./order-items-panel";
import { OrderNotesButton } from "./order-notes-button";
import { OrderProfileForm } from "./order-profile-form";
import { OrderStatusActions } from "./order-status-actions";
import { RefundToggle } from "./refund-toggle";

export const metadata: Metadata = { title: "Order" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default async function OrderDetailPage({ params }: PageProps<"/orders/[id]">) {
  const actor = await requirePermission("orders.view");
  const { id } = await params;

  const rawOrder = await getOrderDetail(id);
  if (!rawOrder) notFound();

  const canViewAll = actor.permissions.has("orders.view.all");
  if (!canViewAll) {
    const isAssigned = rawOrder.items.some((item) => item.worker?.id === actor.user.id);
    if (!isAssigned) redirect("/forbidden?permission=orders.view.all");
  }

  // Everything below renders `order`, never `rawOrder`: values this actor may not see
  // (other workers' items, prices, costs, customer) are removed from the data
  // here, on the server, so they never reach the browser. See src/lib/orders/visibility.ts.
  const visibility = orderVisibility((key) => actor.permissions.has(key));
  const order = redactOrderDetail(rawOrder, actor.user.id, visibility);

  const canEdit = actor.permissions.has("orders.edit");
  const canCreateItems = actor.permissions.has("orders.create");
  const canAssign = actor.permissions.has("orders.assign");
  const canChangeStatus = actor.permissions.has("orders.change_status");
  const canProcess = actor.permissions.has("orders.process");
  const canComment = actor.permissions.has("orders.comment");
  const canViewActivity = actor.permissions.has("orders.activity.view");
  const canUploadOwn = actor.permissions.has("orders.files.upload");
  const needsItemPickers = canCreateItems || canEdit;
  const canViewFinancials = actor.permissions.has("finance.revenue.view") || actor.permissions.has("finance.profit.view");
  const canMarkRefunded = actor.permissions.has("finance.revenue.manage");
  const canViewExpenses = actor.permissions.has("finance.expenses.view");
  const canCreateExpense = actor.permissions.has("finance.expenses.create");

  // Confirmed directly, 2026-09-28: an order should show at a glance how
  // much of its own work is actually assigned. Derived from `order.items`
  // (already redacted above) rather than `rawOrder.items`, so a restricted
  // worker's count never includes an item they are not shown — see
  // src/lib/orders/visibility.ts.
  const totalItemCount = order.items.length;
  const assignedItemCount = order.items.filter((item) => item.worker || item.outsourcedWorker).length;

  const [fiverrAccounts, services, workers, outsourcedWorkers, financials, expenses, expenseCategories, expenseUsers] = await Promise.all([
    canEdit ? listAssignableFiverrAccounts() : Promise.resolve([]),
    needsItemPickers ? listServicesForOrderPicker() : Promise.resolve([]),
    canAssign ? listAssignableWorkers() : Promise.resolve([]),
    canAssign ? listAssignableOutsourcedWorkers() : Promise.resolve([]),
    canViewFinancials ? getOrderFinancials(id) : Promise.resolve(null),
    canViewExpenses ? listExpensesForOrder(id) : Promise.resolve([]),
    canCreateExpense ? listAssignableExpenseCategories() : Promise.resolve([]),
    canCreateExpense ? listAssignableWorkers() : Promise.resolve([]),
  ]);

  return (
    <>
      <Breadcrumbs items={[{ label: "Operations" }, { label: "Orders", href: "/orders" }, { label: `#${order.orderNumber}` }]} />

      <PageHeader
        title={`Order #${order.orderNumber}`}
        description={ORDER_STATUS_LABELS[order.status]}
        actions={
          canChangeStatus || canProcess ? (
            <OrderStatusActions
              orderId={order.id}
              status={order.status}
              canChangeStatus={canChangeStatus}
              canProcess={canProcess}
            />
          ) : undefined
        }
      />

      {/* Notes, as a floating button, not a section on the page (confirmed
          directly, 2026-10-01) — see order-notes-button.tsx. */}
      <OrderNotesButton orderId={order.id} notes={order.internalNotes} canComment={canComment} />

      {/* Items are the main thing on this page (confirmed directly,
          2026-09-28), so they get the wide column; Details plus the
          collapsed Summary/Financials/Expenses are a narrower sidebar. A
          hairline divider grounds the two columns against each other,
          rather than leaving them floating side by side with nothing
          marking where one ends and the other begins. */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[320px_1fr]">
        <div className="space-y-8 lg:border-r lg:border-line lg:pr-8">
          <Section title="Details">
            <OrderProfileForm
              order={order}
              fiverrAccounts={fiverrAccounts}
              canEdit={canEdit}
              canCreateCustomer={actor.permissions.has("customers.create")}
            />
          </Section>

          <Disclosure
            title="Summary, financials & expenses"
            description="Closed by default — status/date metadata, revenue/cost/profit, and this order's own expenses."
          >
            <Section title="Summary" actions={canMarkRefunded ? <RefundToggle orderId={order.id} refunded={order.refunded} /> : undefined}>
              <MetaList
                items={[
                  { label: "Status", value: <StatusDot tone="active" label={ORDER_STATUS_LABELS[order.status]} /> },
                  ...(visibility.prices ? [{ label: "Total amount", value: `${order.totalAmount} ${order.currency}` }] : []),
                  { label: "Order date", value: `${dateFormat.format(order.orderDate)} UTC` },
                  {
                    label: "Deadline",
                    value: order.deadline ? `${dateFormat.format(order.deadline)} UTC` : <span className="text-ink-faint">Not set</span>,
                  },
                  {
                    label: "Delivered",
                    value: order.deliveredAt ? `${dateFormat.format(order.deliveredAt)} UTC` : <span className="text-ink-faint">Not yet</span>,
                  },
                  {
                    label: "Refunded",
                    value: <StatusDot tone={order.refunded ? "danger" : "neutral"} label={order.refunded ? "Yes" : "No"} />,
                  },
                  { label: "Created by", value: order.createdBy.fullName },
                  { label: "Updated", value: `${dateFormat.format(order.updatedAt)} UTC` },
                ]}
              />
            </Section>

            {canViewFinancials && financials ? (
              <Section
                title="Financials"
                description="Revenue on delivery, worker cost from outsourced items, and other expenses — shown separately, never blended across currencies."
              >
                <MetaList
                  items={[
                    {
                      label: "Revenue",
                      value: financials.revenue?.recognized
                        ? `${financials.revenue.amount} ${financials.revenue.currency}`
                        : <span className="text-ink-faint">Not yet recognized{order.refunded ? " (refunded)" : ""}</span>,
                    },
                    { label: "Worker cost (outsourced)", value: formatCurrencyBreakdown(financials.workerCostByCurrency) },
                    { label: "Other expenses", value: formatCurrencyBreakdown(financials.expensesByCurrency) },
                    {
                      label: "Profit",
                      value:
                        Object.keys(financials.profitByCurrency).length > 0
                          ? formatCurrencyBreakdown(financials.profitByCurrency)
                          : <span className="text-ink-faint">—</span>,
                    },
                  ]}
                />
              </Section>
            ) : null}

            {canViewExpenses ? (
              <Section
                title="Expenses"
                description="Tied to this order — shown separately from revenue, never netted automatically."
                actions={canCreateExpense ? <ExpenseForm categories={expenseCategories} users={expenseUsers} canCreate orderId={order.id} /> : undefined}
              >
                {expenses.length === 0 ? (
                  <p className="text-[13px] text-ink-faint">No expenses recorded for this order.</p>
                ) : (
                  <ul className="space-y-2">
                    {expenses.map((expense) => (
                      <li key={expense.id} className="flex items-center justify-between gap-3 text-[13px]">
                        <span className="text-ink">
                          {expense.categoryName}
                          {expense.description ? ` — ${expense.description}` : ""}
                        </span>
                        <span className="text-ink-muted">
                          {expense.amount} {expense.currency} · {dateFormat.format(expense.date)} UTC
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            ) : null}
          </Disclosure>
        </div>

        <div>
          <Section
            title="Items"
            description="Each item's status is independent of the order's overall status."
            actions={
              totalItemCount > 0 ? (
                <span className="text-[13px] text-ink-muted">
                  Assigned <span className="font-medium text-ink">{assignedItemCount}/{totalItemCount}</span>
                </span>
              ) : undefined
            }
          >
            <OrderItemsPanel
              orderId={order.id}
              items={order.items}
              services={services}
              workers={workers}
              outsourcedWorkers={outsourcedWorkers}
              currentUserId={actor.user.id}
              canCreate={canCreateItems}
              canEdit={canEdit}
              canAssign={canAssign}
              canChangeStatus={canChangeStatus}
              canViewAll={canViewAll}
              canUploadOwn={canUploadOwn}
              showCosts={visibility.costs}
            />
          </Section>
        </div>
      </div>

      {canViewActivity ? (
        <Section title="Activity" description="The operational feed — distinct from notes and from the audit log.">
          {order.activity.length === 0 ? (
            <p className="text-[13px] text-ink-faint">No activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {order.activity.map((entry) => (
                <li key={entry.id} className="text-[13px] text-ink-muted">
                  <span className="text-ink">{entry.summary}</span>
                  <span className="text-ink-faint"> · {dateFormat.format(entry.createdAt)} UTC</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}
    </>
  );
}
