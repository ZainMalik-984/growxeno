import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleCheck, Hourglass, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { PHONE_FLUSH } from "@/components/ui/card";
import { DeadlineCountdown } from "@/components/ui/deadline";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge, type StatusTone } from "@/components/ui/status-dot";
import { CommissionCard } from "@/components/finance/commission-card";
import type { OrderStatus } from "@/generated/prisma/client";
import { getAccessCounts } from "@/lib/access/queries";
import { requireActor } from "@/lib/auth/authorize";
import { countCustomers } from "@/lib/customers/queries";
import { getBusinessOverview, thisMonthRangeUtc, type AttentionRow } from "@/lib/dashboard/queries";
import { getEmployeeCommission, getMyWorkSummary } from "@/lib/employees/queries";
import { formatPay } from "@/lib/finance/format-pay";
import { getFinanceSummary, getWorkerEarnings, type WorkerEarnings } from "@/lib/finance/queries";
import { getNewInquiriesSummary } from "@/lib/inquiries/queries";
import { ORDER_STATUS_LABELS, ORDER_STATUS_VALUES, ORDER_ITEM_STATUS_LABELS } from "@/lib/orders/state-machine";
import { ITEM_STATUS_TONE, ORDER_STATUS_TONE } from "@/lib/orders/status-tone";
import { orderVisibility } from "@/lib/orders/visibility";
import { listWorkerTasks, type WorkerTask } from "@/lib/orders/worker-tasks";
import { getWorkload } from "@/lib/outsourced-workers/workload-queries";
import { WorkloadLines } from "@/components/orders/workload";
import { SERVICE_METRIC_TYPE_LABELS } from "@/lib/services/metric-type";
import { formatDuration } from "@/lib/time/countdown";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const todayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const assignedFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const numberFormat = new Intl.NumberFormat("en-US");

/**
 * Dashboard (redesigned 2026-11-11, owner request: "this looks unprofessional").
 *
 * Two views, chosen by what the person can see:
 *   - Anyone who sees every order gets the business: open orders, what needs
 *     attention (overdue, unassigned, not accepted), recent orders, this
 *     month's money and orders by status.
 *   - An External Worker (or anyone who only sees their own items) gets their
 *     work: tasks with progress, what's due, and what they've earned and are
 *     still owed.
 * The old "Your account / Effective permissions" card is gone: that belongs in
 * the account menu, not on the first page of the day.
 */
export default async function DashboardPage() {
  const actor = await requireActor();
  const has = (key: string) => actor.permissions.has(key);
  const visibility = orderVisibility(has);
  const canSeeOrders = has("orders.view");
  const isBusinessView = canSeeOrders && visibility.allItems;
  const identity = { userId: actor.user.id, outsourcedWorkerId: actor.outsourcedWorkerId };
  const canSeeMoney = has("finance.revenue.view");
  const canSeeProfit = has("finance.profit.view");

  const [overview, myWork, workerTasks, earnings, month, inquiries, customerCount, access, commission, workload] = await Promise.all([
    isBusinessView ? getBusinessOverview({ showCustomers: visibility.parties, showAmounts: visibility.prices }) : null,
    canSeeOrders ? getMyWorkSummary(identity) : null,
    canSeeOrders && !isBusinessView ? listWorkerTasks(identity, { view: "active" }) : null,
    actor.outsourcedWorkerId ? getWorkerEarnings({ outsourcedWorkerId: actor.outsourcedWorkerId }) : null,
    isBusinessView && canSeeMoney ? getFinanceSummary(thisMonthRangeUtc()) : null,
    has("inquiries.view") ? getNewInquiriesSummary(3) : null,
    has("customers.view") ? countCustomers() : null,
    has("users.view") ? getAccessCounts() : null,
    getEmployeeCommission(actor.user.id),
    actor.outsourcedWorkerId ? getWorkload(actor.outsourcedWorkerId) : null,
  ]);

  const firstName = (actor.user.displayName ?? actor.user.fullName).split(" ")[0];
  const canCreate = has("orders.create");
  const renderedAt = new Date();

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-[13px] text-zinc-500">{todayFormat.format(renderedAt)}</p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-[-0.02em] text-zinc-900 sm:text-[22px]">Welcome back, {firstName}</h1>
        </div>
        {isBusinessView && canCreate ? (
          <Link href="/orders/new" className={buttonVariants({ variant: "accent", className: "h-9 rounded-[8px] px-3.5 text-[13px] font-semibold" })}>
            <Plus aria-hidden="true" />
            New order
          </Link>
        ) : canSeeOrders ? (
          <Link href="/orders" className={buttonVariants({ variant: "secondary", className: "h-9 rounded-[8px] px-3.5 text-[13px] font-semibold" })}>
            {isBusinessView ? "All orders" : "Open my tasks"}
            <ArrowRight aria-hidden="true" />
          </Link>
        ) : null}
      </header>

      {overview ? (
        <KpiStrip
          items={[
            { label: "Open orders", value: overview.openOrders, hint: "Not yet delivered", href: "/orders" },
            {
              label: "Unassigned",
              value: overview.unassignedItems,
              hint: overview.unassignedItems === 1 ? "item needs a worker" : "items need a worker",
              href: "/orders?assigned=0",
              tone: overview.unassignedItems > 0 ? "amber" : undefined,
            },
            {
              label: "Overdue",
              value: overview.overdueItems,
              hint: overview.overdueItems > 0 ? "items past their deadline" : "Nothing late",
              href: "/orders?overdue=1",
              tone: overview.overdueItems > 0 ? "red" : undefined,
            },
            { label: "Due this week", value: overview.dueThisWeekItems, hint: "items", href: "/orders?dueThisWeek=1" },
          ]}
        />
      ) : myWork ? (
        <KpiStrip
          items={[
            { label: "To accept", value: myWork.newCount, hint: "New tasks", href: "/orders?task=pending", tone: myWork.newCount > 0 ? "indigo" : undefined },
            { label: "In progress", value: myWork.activeCount, hint: "Accepted or refill", href: "/orders?task=processing" },
            { label: "Due today", value: myWork.dueTodayCount, hint: "Deadline today (UTC)", href: "/orders", tone: myWork.dueTodayCount > 0 ? "amber" : undefined },
            {
              label: "Overdue",
              value: myWork.overdueCount,
              hint: myWork.overdueCount > 0 ? "Past the deadline" : "Nothing late",
              href: "/orders",
              tone: myWork.overdueCount > 0 ? "red" : undefined,
            },
          ]}
        />
      ) : null}

      <div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {overview ? (
            <>
              <Panel title="Needs attention" description="Workers who can't continue or need screenshots, overdue, unassigned, or not accepted after a day." action={<PanelLink href="/orders">All orders</PanelLink>}>
                {overview.attention.length > 0 ? (
                  <ul className="divide-y divide-zinc-100">
                    {overview.attention.map((row) => (
                      <AttentionItem key={row.itemId} row={row} now={renderedAt.getTime()} />
                    ))}
                  </ul>
                ) : (
                  <AllClear text="Nothing is overdue, unassigned or waiting to be accepted." />
                )}
              </Panel>

              <Panel title="Recent orders" action={<PanelLink href="/orders">View all</PanelLink>}>
                {overview.recentOrders.length > 0 ? (
                  <ul className="divide-y divide-zinc-100">
                    {overview.recentOrders.map((order) => (
                      <li key={order.id}>
                        <Link href={`/orders/${order.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 sm:px-5">
                          <span className="w-10 shrink-0 text-sm font-semibold tabular-nums text-zinc-900">#{order.orderNumber}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-zinc-800">{order.customerName ?? `${order.itemCount} ${order.itemCount === 1 ? "item" : "items"}`}</span>
                            <span className="block text-xs text-zinc-500">
                              {dayFormat.format(order.createdAt)}
                              {order.customerName ? ` · ${order.itemCount} ${order.itemCount === 1 ? "item" : "items"}` : ""}
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-1">
                            <StatusBadge tone={ORDER_STATUS_TONE[order.status]} label={ORDER_STATUS_LABELS[order.status]} className="px-2 py-0.5" />
                            {order.amountLabel ? <span className="text-xs font-medium tabular-nums text-zinc-700">{order.amountLabel}</span> : null}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-8 text-center text-[13px] text-zinc-500">No orders yet.</p>
                )}
              </Panel>
            </>
          ) : null}

          {workerTasks ? (
            <Panel title="Your tasks" description="Oldest first. Open one to update progress." action={<PanelLink href="/orders">All tasks</PanelLink>}>
              {workerTasks.tasks.length > 0 ? (
                <ul className="divide-y divide-zinc-100">
                  {workerTasks.tasks.slice(0, 6).map((task) => (
                    <TaskItem key={task.id} task={task} now={renderedAt.getTime()} />
                  ))}
                </ul>
              ) : (
                <AllClear text="No open tasks right now. New ones show up here as soon as they're assigned." />
              )}
            </Panel>
          ) : null}

          {/* An admin who is also assigned work still sees it, below the business. */}
          {overview && myWork && myWork.attention.length > 0 ? (
            <Panel title="Assigned to you" description="Soonest deadline first.">
              <ul className="divide-y divide-zinc-100">
                {myWork.attention.map((item) => (
                  <li key={item.itemId}>
                    <Link href={`/orders/${item.orderId}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 sm:px-5">
                      <span className="w-10 shrink-0 text-sm font-semibold tabular-nums text-zinc-900">#{item.orderNumber}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-800">{item.serviceName}</span>
                      {item.deadline ? <DeadlineCountdown deadline={item.deadline} showDate={false} /> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {!isBusinessView && myWork && myWork.recentlyCompleted.length > 0 ? (
            <Panel title="Recently completed">
              <ul className="divide-y divide-zinc-100">
                {myWork.recentlyCompleted.map((item) => (
                  <li key={item.itemId}>
                    <Link href={`/orders/${item.orderId}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 sm:px-5">
                      <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-emerald-600" />
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-800">{item.serviceName}</span>
                      <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                        #{item.orderNumber} · {dayFormat.format(item.completedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {!canSeeOrders ? (
            <Panel title="Welcome to Grow Xeno">
              <p className="px-5 pb-5 text-[13px] text-zinc-500">Use the menu to open the areas you have access to.</p>
            </Panel>
          ) : null}
        </div>

        <aside className="min-w-0 space-y-6">
          {workload ? (
            <Panel title="Your workload" description="Across your active tasks: delivered, and what's left.">
              <WorkloadLines workload={workload} className="px-4 pb-5 sm:px-5" />
            </Panel>
          ) : null}
          {earnings ? <EarningsPanel earnings={earnings} /> : null}

          {month ? (
            <Panel title="This month" description={`${month.recognizedOrderCount} ${month.recognizedOrderCount === 1 ? "order" : "orders"} delivered`} action={<PanelLink href="/finance">Finance</PanelLink>}>
              <dl className="space-y-3 px-4 pb-5 sm:px-5">
                <MoneyRow label="Revenue" values={month.revenueByCurrency} strong />
                <MoneyRow label="Worker cost" values={month.workerCostByCurrency} />
                <MoneyRow label="Expenses" values={month.expensesByCurrency} />
                {canSeeProfit ? <MoneyRow label="Profit" values={month.profitByCurrency} strong tone="emerald" /> : null}
              </dl>
            </Panel>
          ) : null}

          {overview ? <StatusBreakdown counts={overview.ordersByStatus} /> : null}

          {inquiries ? (
            <Panel
              title="New inquiries"
              description={inquiries.count === 0 ? "Nothing waiting from the website." : `${inquiries.count} waiting for a reply`}
              action={<PanelLink href="/inquiries">View all</PanelLink>}
            >
              {inquiries.latest.length > 0 ? (
                <ul className="divide-y divide-zinc-100">
                  {inquiries.latest.map((inquiry) => (
                    <li key={inquiry.id}>
                      <Link href="/inquiries" className="block px-4 py-3 transition-colors hover:bg-zinc-50 sm:px-5">
                        <span className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-medium text-zinc-900">{inquiry.name}</span>
                          <span className="shrink-0 text-xs text-zinc-500">{dayFormat.format(inquiry.createdAt)}</span>
                        </span>
                        <span className="mt-0.5 line-clamp-1 block text-xs text-zinc-500">
                          {inquiry.service ? `${inquiry.service} · ` : ""}
                          {inquiry.message}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Panel>
          ) : null}

          {customerCount !== null || access ? (
            <Panel title="At a glance">
              <dl className="grid grid-cols-2 divide-x divide-zinc-100 border-t border-zinc-100">
                {customerCount !== null ? <Glance label="Customers" value={customerCount} href="/customers" /> : null}
                {access ? <Glance label="Active users" value={access.activeUsers} href="/settings/users" /> : null}
              </dl>
            </Panel>
          ) : null}

          {commission ? <CommissionCard commission={commission} title="Your commission" /> : null}
        </aside>
      </div>
    </>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────

const SURFACE = "rounded-[12px] border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-14px_rgba(16,24,40,0.12)]";

/** A titled white panel; the body decides its own padding so lists can run edge to edge. */
function Panel({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={cn(SURFACE, PHONE_FLUSH, "overflow-hidden")}>
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-zinc-900">{title}</h2>
          {description ? <p className="mt-0.5 text-[13px] text-zinc-500">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-8 items-center gap-1 rounded-[8px] px-2 text-[13px] font-medium text-indigo-600 transition-colors hover:bg-indigo-50">
      {children}
      <ArrowRight aria-hidden="true" className="size-3.5" />
    </Link>
  );
}

type KpiTone = "red" | "amber" | "indigo";

const KPI_TONE: Record<KpiTone, string> = {
  red: "text-red-600",
  amber: "text-amber-600",
  indigo: "text-indigo-600",
};

/** The headline numbers as one strip, each a link to the matching list. 2×2 on a phone, 4 across from lg. */
function KpiStrip({ items }: { items: Array<{ label: string; value: number; hint: string; href: string; tone?: KpiTone }> }) {
  return (
    <section aria-label="Summary" className={cn(SURFACE, PHONE_FLUSH, "grid grid-cols-2 overflow-hidden lg:grid-cols-4")}>
      {items.map((item, index) => (
        <Link
          key={item.label}
          href={item.href}
          className={cn(
            "group px-4 py-4 transition-colors hover:bg-zinc-50 sm:px-5",
            index % 2 === 1 && "border-l border-zinc-100",
            index >= 2 && "border-t border-zinc-100 lg:border-t-0",
            index === 2 && "lg:border-l",
          )}
        >
          <p className="text-[13px] font-medium text-zinc-500">{item.label}</p>
          <p className={cn("mt-1 text-[28px] font-semibold leading-none tracking-tight tabular-nums", item.tone ? KPI_TONE[item.tone] : "text-zinc-900")}>
            {numberFormat.format(item.value)}
          </p>
          <p className="mt-1.5 truncate text-xs text-zinc-500">{item.hint}</p>
        </Link>
      ))}
    </section>
  );
}

const REASON: Record<AttentionRow["reason"], { label: string; className: string }> = {
  withdraw: { label: "Can't continue", className: "bg-red-50 text-red-700 ring-red-200" },
  screenshots: { label: "Screenshots requested", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  overdue: { label: "Overdue", className: "bg-red-50 text-red-700 ring-red-200/70" },
  unassigned: { label: "Unassigned", className: "bg-amber-50 text-amber-800 ring-amber-200/70" },
  not_accepted: { label: "Not accepted", className: "bg-indigo-50 text-indigo-700 ring-indigo-200/70" },
};

/** `now` is when the page was rendered, so the "late" / "ago" text is stable. */
function AttentionItem({ row, now }: { row: AttentionRow; now: number }) {
  const reason = REASON[row.reason];
  const detail =
    row.reason === "overdue" && row.deadline
      ? `${formatDuration(now - row.deadline.getTime())} late`
      : row.reason === "not_accepted" && row.assignedAt
        ? `Assigned ${formatDuration(now - row.assignedAt.getTime())} ago`
        : row.deadline
          ? null
          : "No deadline";
  return (
    <li>
      <Link
        href={row.reason === "screenshots" ? `/orders/${row.orderId}?updates=${row.itemId}` : row.reason === "withdraw" ? `/orders/${row.orderId}#item-${row.itemId}` : `/orders/${row.orderId}`}
        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 sm:items-center sm:px-5"
      >
        <span className="w-10 shrink-0 pt-px text-sm font-semibold tabular-nums text-zinc-900">#{row.orderNumber}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-zinc-800">{row.serviceName}</span>
          <span className="mt-0.5 block truncate text-xs text-zinc-500">
            {row.workerName ?? "No worker yet"}
            {detail ? ` · ${detail}` : null}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", reason.className)}>{reason.label}</span>
          {row.reason !== "overdue" && row.deadline ? <DeadlineCountdown deadline={row.deadline} showDate={false} /> : null}
        </span>
      </Link>
    </li>
  );
}

/** One of the worker's own tasks: what it is, the channel, delivered / needed, and when it's due. */
function TaskItem({ task, now }: { task: WorkerTask; now: number }) {
  const start = Math.max(0, task.startingCount ?? 0);
  const required = task.targetCount !== null ? Math.max(0, task.targetCount - start) : null;
  const delivered = Math.max(0, (task.currentCount ?? start) - start);
  const percent = required ? Math.min(100, Math.round((delivered / required) * 100)) : null;
  const unit = task.metricType ? SERVICE_METRIC_TYPE_LABELS[task.metricType].toLowerCase() : null;
  return (
    <li>
      <Link href={`/orders/${task.orderId}`} className="block px-4 py-3.5 transition-colors hover:bg-zinc-50 sm:px-5">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-zinc-900">{task.serviceName}</span>
            <span className="block truncate text-xs text-zinc-500">
              #{task.orderNumber}
              {task.channelTitle ? ` · ${task.channelTitle}` : ""}
            </span>
          </span>
          <StatusBadge tone={ITEM_STATUS_TONE[task.status]} label={ORDER_ITEM_STATUS_LABELS[task.status]} className="shrink-0 px-2 py-0.5" />
        </span>
        {percent !== null && required !== null && unit ? (
          <span className="mt-2.5 block">
            <span className="flex items-center gap-2.5">
              <ProgressBar percent={percent} className="flex-1" />
              <span className="tabular w-9 text-right text-xs font-semibold text-zinc-700">{percent}%</span>
            </span>
            <span className="mt-1 block text-xs tabular-nums text-zinc-500">
              {numberFormat.format(delivered)} / {numberFormat.format(required)} {unit} delivered
            </span>
          </span>
        ) : null}
        <span className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {/* When it was given, not time left (owner request, 2026-11-11). */}
          {task.assignedAt ? (
            <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-zinc-500">
              <Hourglass aria-hidden="true" className="size-3.5" />
              Assigned {formatDuration(now - task.assignedAt.getTime())} ago
              <span className="text-zinc-400">· {assignedFormat.format(task.assignedAt)} UTC</span>
            </span>
          ) : (
            <span className="text-xs text-zinc-500">Not assigned yet</span>
          )}
          {task.workerCost ? <span className="text-xs font-semibold tabular-nums text-emerald-700">{formatPay(task.workerCost, task.workerCostCurrency)}</span> : null}
        </span>
      </Link>
    </li>
  );
}

/**
 * A worker's money (owner's rule, 2026-11-12): the balance is only what the
 * team has confirmed (see workerPayStage); work marked done but not yet
 * confirmed, and work still in progress, are shown apart from it.
 */
function EarningsPanel({ earnings }: { earnings: WorkerEarnings }) {
  const owed = Object.entries(earnings.outstandingByCurrency).filter(([, amount]) => amount !== 0);
  return (
    <Panel title="Your earnings" description="Counted once the team accepts your delivery.">
      <div className="px-4 pb-5 sm:px-5">
        <p className="text-[13px] font-medium text-zinc-500">Available balance</p>
        <p className="mt-1 text-[26px] font-semibold leading-tight tracking-tight tabular-nums text-zinc-900">
          {owed.length > 0 ? owed.map(([currency, amount]) => formatPay(amount, currency)).join(" + ") : "Nothing owed"}
        </p>
        <dl className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
          <MoneyRow label="Earned" values={earnings.earnedByCurrency} />
          <MoneyRow label="Paid" values={earnings.paidByCurrency} />
          <MoneyRow label="Awaiting confirmation" values={earnings.awaitingByCurrency} muted />
          <MoneyRow label="In progress" values={earnings.inProgressByCurrency} muted />
        </dl>
      </div>
    </Panel>
  );
}

function MoneyRow({
  label,
  values,
  strong,
  muted,
  tone,
}: {
  label: string;
  values: Record<string, number>;
  strong?: boolean;
  muted?: boolean;
  tone?: "emerald";
}) {
  const entries = Object.entries(values);
  return (
    <div className="flex items-baseline justify-between gap-4 text-[13px]">
      <dt className="text-zinc-500">{label}</dt>
      <dd
        className={cn(
          "text-right tabular-nums",
          strong ? "font-semibold" : "font-medium",
          tone === "emerald" ? "text-emerald-700" : muted ? "text-zinc-500" : "text-zinc-900",
        )}
      >
        {entries.length > 0 ? entries.map(([currency, amount]) => formatPay(amount, currency)).join(" + ") : "—"}
      </dd>
    </div>
  );
}

const BAR_COLOR: Record<StatusTone, string> = {
  neutral: "bg-zinc-300",
  active: "bg-blue-500",
  progress: "bg-indigo-500",
  review: "bg-amber-400",
  ready: "bg-teal-500",
  done: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

/** Every order by status: one stacked bar and a list of the statuses that have any. */
function StatusBreakdown({ counts }: { counts: Partial<Record<OrderStatus, number>> }) {
  const rows = ORDER_STATUS_VALUES.map((status) => ({ status, count: counts[status] ?? 0 })).filter((row) => row.count > 0);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <Panel title="Orders by status" description={`${total} ${total === 1 ? "order" : "orders"} in total`}>
      {total > 0 ? (
        <div className="px-4 pb-4 sm:px-5">
          <div className="flex h-2 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true">
            {rows.map((row) => (
              <span key={row.status} className={BAR_COLOR[ORDER_STATUS_TONE[row.status]]} style={{ width: `${(row.count / total) * 100}%` }} />
            ))}
          </div>
          <ul className="mt-3 space-y-1">
            {rows.map((row) => (
              <li key={row.status}>
                <Link href={`/orders?status=${row.status}`} className="-mx-2 flex items-center justify-between gap-3 rounded-[6px] px-2 py-1.5 text-[13px] hover:bg-zinc-50">
                  <span className="flex items-center gap-2 text-zinc-700">
                    <span aria-hidden="true" className={cn("size-2 rounded-full", BAR_COLOR[ORDER_STATUS_TONE[row.status]])} />
                    {ORDER_STATUS_LABELS[row.status]}
                  </span>
                  <span className="font-medium tabular-nums text-zinc-900">{row.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="px-5 pb-5 text-[13px] text-zinc-500">No orders yet.</p>
      )}
    </Panel>
  );
}

function Glance({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="block px-4 py-3.5 transition-colors hover:bg-zinc-50 sm:px-5">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold tabular-nums text-zinc-900">{numberFormat.format(value)}</dd>
    </Link>
  );
}

function AllClear({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 border-t border-zinc-100 px-4 py-6 sm:px-5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600">
        <CircleCheck aria-hidden="true" className="size-[18px]" />
      </span>
      <div>
        <p className="text-sm font-medium text-zinc-900">All clear</p>
        <p className="text-[13px] text-zinc-500">{text}</p>
      </div>
    </div>
  );
}
