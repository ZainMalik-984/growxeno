"use client";

import { Ban, Camera, ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";

import { DeadlineCountdown } from "@/components/ui/deadline";
import { AcceptItemsButton } from "./accept-items-button";

import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge, StatusDot, type StatusTone } from "@/components/ui/status-dot";
import { Table, TableWrap, TBody, TH, THead, TD, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Confirmed directly, 2026-10-05: "on the orders list page each row for
 * order should have progress bar and percentage... and each row would be a
 * dropdown and dropdown would show the order item, who its assigned to and
 * progress like 1600/6000." All redaction already happened server-side
 * (src/lib/orders/visibility.ts's `redactOrderListItems`) before this data
 * reached the client — `items` here is already only what this actor may see.
 *
 * Status stays a dot + label, not a filled pill: specification Section 99
 * (a long table of coloured badges is unreadable).
 */

/** `title` is the channel/video name read from YouTube, shown with the link (2026-11-11). */
export type ChannelLink = { href: string; label: string; title?: string | null };

export type OrdersTableItem = {
  id: string;
  channel: ChannelLink | null;
  /** The signed-in worker's own pending item: show Accept. */
  canAccept: boolean;
  serviceName: string;
  assigneeLabel: string;
  statusLabel: string;
  statusTone: StatusTone;
  metricLabel: string | null;
  startingCount: number | null;
  currentCount: number | null;
  targetCount: number | null;
};

export type OrdersTableRow = {
  id: string;
  orderNumber: number;
  customerName: string | null;
  statusLabel: string;
  statusTone: StatusTone;
  /** For a worker, their own (earliest item) deadline. */
  deadline: Date | null;
  /** Completed, delivered or cancelled: show the date, no countdown. */
  finished: boolean;
  /** Past its deadline and not finished. */
  isOverdue: boolean;
  itemCount: number;
  amountLabel: string | null;
  progressPercent: number | null;
  /** Distinct client channels across this row's visible items. */
  channels: ChannelLink[];
  /** Screenshot requests waiting for the team on this order (team view only, 2026-11-11). */
  openRequests: number;
  /** Items whose worker can't continue, waiting to be reassigned (team view only). */
  withdrawRequests: number;
  items: OrdersTableItem[];
};

/** Cell padding inside the card: the shared TD/TH are flush-left by default. */
const EDGE = "first:pl-5 last:pr-5";

export function OrdersTable({
  rows,
  showCustomer,
  showAmount,
}: {
  rows: OrdersTableRow[];
  showCustomer: boolean;
  showAmount: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const columnCount = 3 + (showCustomer ? 1 : 0) + 3 + (showAmount ? 1 : 0);
  const th = cn(EDGE, "border-zinc-200/80 bg-zinc-50/80 py-2.5 text-zinc-500");

  return (
    <>
    {/* Phones: one card per order (2026-11-11), since the table is ~970px wide. */}
    <ul className="divide-y divide-zinc-100 md:hidden">
      {rows.map((order) => (
        <OrderCard key={order.id} order={order} showCustomer={showCustomer} showAmount={showAmount} />
      ))}
    </ul>
    <TableWrap className="hidden md:block">
      <Table className="min-w-[720px]">
        <caption className="sr-only">Orders</caption>
        <THead>
          <TR className="border-0">
            <TH className={cn(th, "w-10")} aria-hidden="true" />
            <TH className={th}>Order</TH>
            <TH className={th}>Link</TH>
            {showCustomer ? <TH className={th}>Customer</TH> : null}
            <TH className={th}>Status</TH>
            <TH className={th}>Deadline</TH>
            <TH className={th}>Progress</TH>
            <TH className={cn(th, "text-right")}>Items</TH>
            {showAmount ? <TH className={cn(th, "text-right")}>Amount</TH> : null}
          </TR>
        </THead>
        <TBody>
          {rows.map((order) => {
            const isOpen = expanded.has(order.id);
            const acceptable = order.items.filter((item) => item.canAccept);
            return (
              <Fragment key={order.id}>
                <TR className={cn("border-zinc-100 transition-colors hover:bg-zinc-50/70", isOpen && "bg-zinc-50/70")}>
                  <TD className={cn(EDGE, "py-3 pr-0")}>
                    <button
                      type="button"
                      onClick={() => toggle(order.id)}
                      aria-expanded={isOpen}
                      aria-label={isOpen ? `Collapse order #${order.orderNumber}` : `Expand order #${order.orderNumber}`}
                      className="flex size-7 items-center justify-center rounded-[6px] text-zinc-400 transition hover:bg-zinc-200/60 hover:text-zinc-800"
                    >
                      <ChevronRight className={cn("size-4 transition-transform", isOpen && "rotate-90")} />
                    </button>
                  </TD>
                  <TD className={cn(EDGE, "py-3")}>
                    <Link href={`/orders/${order.id}`} className="font-semibold tabular-nums text-zinc-900 hover:text-indigo-600 hover:underline">
                      #{order.orderNumber}
                    </Link>
                  </TD>
                  <TD className={cn(EDGE, "max-w-[240px] py-3")}>
                    {order.channels.length > 0 ? (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <ChannelAnchor channel={order.channels[0]} />
                        {order.channels.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => toggle(order.id)}
                            title={order.channels.slice(1).map((c) => c.label).join("\n")}
                            className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-px text-[11px] font-medium text-zinc-600 hover:bg-zinc-200"
                          >
                            +{order.channels.length - 1}
                          </button>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </TD>
                  {showCustomer ? (
                    <TD className={cn(EDGE, "py-3 text-zinc-700")}>
                      {order.customerName ?? <span className="text-zinc-500">—</span>}
                    </TD>
                  ) : null}
                  <TD className={cn(EDGE, "py-3")}>
                    {acceptable.length > 0 ? (
                      <AcceptItemsButton
                        itemIds={acceptable.map((item) => item.id)}
                        label={acceptable.length > 1 ? `Accept ${acceptable.length}` : "Accept"}
                        className="h-7 px-2.5"
                      />
                    ) : (
                      <StatusDot tone={order.statusTone} label={order.statusLabel} />
                    )}
                    {order.withdrawRequests > 0 ? <WithdrawBadge className="mt-1" /> : null}
                    {order.openRequests > 0 ? <RequestBadge count={order.openRequests} className="mt-1" /> : null}
                  </TD>
                  <TD className={cn(EDGE, "whitespace-nowrap py-3")}>
                    {order.deadline ? (
                      <DeadlineCountdown deadline={order.deadline} finished={order.finished} stacked className="items-start" />
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </TD>
                  <TD className={cn(EDGE, "min-w-36 py-3")}>
                    {order.progressPercent !== null ? (
                      <div className="flex items-center gap-2.5">
                        <ProgressBar percent={order.progressPercent} className="w-24" />
                        <span className="tabular text-xs font-medium text-zinc-600">{order.progressPercent}%</span>
                      </div>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </TD>
                  <TD className={cn(EDGE, "py-3 text-right tabular-nums text-zinc-600")}>{order.itemCount}</TD>
                  {showAmount ? (
                    <TD className={cn(EDGE, "whitespace-nowrap py-3 text-right font-medium tabular-nums text-zinc-900")}>
                      {order.amountLabel}
                    </TD>
                  ) : null}
                </TR>
                {isOpen ? (
                  <tr className="border-b border-zinc-100">
                    <td colSpan={columnCount} className="bg-zinc-50/70 px-5 pb-4 pt-0">
                      <div className="ml-10 rounded-[10px] border border-zinc-200/80 bg-white p-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                        {order.items.length === 0 ? (
                          <p className="px-3 py-2.5 text-xs text-zinc-500">No items visible.</p>
                        ) : (
                          <ul className="divide-y divide-zinc-100">
                            {order.items.map((item) => (
                              <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-3 py-2.5 text-[13px]">
                                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <span className="font-medium text-zinc-900">{item.serviceName}</span>
                                  <span className="text-zinc-500">{item.assigneeLabel}</span>
                                  {item.channel ? <ChannelAnchor channel={item.channel} className="text-xs" /> : null}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-zinc-500">
                                  {item.metricLabel ? (
                                    <span className="tabular-nums">
                                      {(item.currentCount ?? 0).toLocaleString("en-US")} / {(item.targetCount ?? 0).toLocaleString("en-US")}{" "}
                                      {item.metricLabel}
                                    </span>
                                  ) : null}
                                  {item.canAccept ? (
                                    <AcceptItemsButton itemIds={[item.id]} className="h-7 px-2.5" />
                                  ) : (
                                    <StatusDot tone={item.statusTone} label={item.statusLabel} />
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </TBody>
      </Table>
    </TableWrap>
    </>
  );
}

/** "120 / 1,000 watch hours delivered · now 775": what was delivered since the start, as the progress bar measures it. */
function DeliveredLine({ item }: { item: OrdersTableItem }) {
  const start = Math.max(0, item.startingCount ?? 0);
  const delivered = Math.max(0, (item.currentCount ?? start) - start);
  const required = Math.max(0, (item.targetCount ?? 0) - start);
  return (
    <p className="mt-1 text-xs tabular-nums text-zinc-600">
      <span className="font-semibold text-zinc-900">{delivered.toLocaleString("en-US")}</span> / {required.toLocaleString("en-US")} {item.metricLabel} delivered
      {item.currentCount !== null ? <span className="text-zinc-400"> · now {item.currentCount.toLocaleString("en-US")}</span> : null}
    </p>
  );
}

/**
 * One order on a phone. The whole card opens the order (a stretched link under
 * the content); the channel link and Accept sit above it so they stay tappable.
 */
function OrderCard({ order, showCustomer, showAmount }: { order: OrdersTableRow; showCustomer: boolean; showAmount: boolean }) {
  const acceptable = order.items.filter((item) => item.canAccept);
  const first = order.items[0];
  const services = order.items.length > 1 ? `${first?.serviceName ?? "Items"} +${order.items.length - 1} more` : (first?.serviceName ?? null);
  const metric = order.items.length === 1 && first?.metricLabel && first.targetCount !== null ? first : null;
  const channel = order.channels[0];

  return (
    <li className="relative px-4 py-4 transition-colors active:bg-zinc-50">
      <Link href={`/orders/${order.id}`} className="absolute inset-0" aria-label={`Open order #${order.orderNumber}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="font-semibold tabular-nums text-zinc-900">#{order.orderNumber}</span>
            {showCustomer && order.customerName ? <span className="truncate">{order.customerName}</span> : null}
          </p>
          {services ? <p className="mt-0.5 truncate text-[13px] text-zinc-600">{services}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge tone={order.statusTone} label={order.statusLabel} className="px-2 py-0.5" />
          {order.withdrawRequests > 0 ? <WithdrawBadge /> : null}
          {order.openRequests > 0 ? <RequestBadge count={order.openRequests} /> : null}
        </div>
      </div>

      {channel ? (
        <div className="relative mt-2.5 flex min-w-0 items-center gap-1.5">
          <ChannelAnchor channel={channel} className="max-w-full text-sm" />
          {order.channels.length > 1 ? (
            <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-px text-[11px] font-medium text-zinc-600">+{order.channels.length - 1}</span>
          ) : null}
        </div>
      ) : null}

      {order.progressPercent !== null ? (
        <div className="mt-3">
          <div className="flex items-center gap-2.5">
            <ProgressBar percent={order.progressPercent} className="flex-1" />
            <span className="tabular text-xs font-semibold text-zinc-700">{order.progressPercent}%</span>
          </div>
          {metric ? <DeliveredLine item={metric} /> : null}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0 text-xs text-zinc-500">
          {order.deadline ? (
            <DeadlineCountdown deadline={order.deadline} finished={order.finished} showDate={false} />
          ) : (
            <span>
              {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {showAmount && order.amountLabel ? (
            <span className="text-sm font-semibold tabular-nums text-zinc-900">{order.amountLabel}</span>
          ) : null}
          {acceptable.length > 0 ? (
            <AcceptItemsButton
              itemIds={acceptable.map((item) => item.id)}
              label={acceptable.length > 1 ? `Accept ${acceptable.length}` : "Accept"}
              className="relative h-9 px-3.5"
            />
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** A worker can't continue and what's left isn't reassigned yet (2026-11-11). */
function WithdrawBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200",
        className,
      )}
    >
      <Ban aria-hidden="true" className="size-3.5" />
      Can&apos;t continue
    </span>
  );
}

/** A worker asked for screenshots and nobody has answered yet (2026-11-11). */
function RequestBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200",
        className,
      )}
    >
      <Camera aria-hidden="true" className="size-3.5" />
      {count === 1 ? "Screenshots requested" : `${count} screenshot requests`}
    </span>
  );
}

/** Opens the client's channel in a new tab; never fetched by the server. */
function ChannelAnchor({ channel, className }: { channel: ChannelLink; className?: string }) {
  return (
    <a
      href={channel.href}
      target="_blank"
      rel="noreferrer noopener"
      title={channel.href}
      className={cn(
        "group inline-flex min-w-0 items-center gap-1 text-[13px] text-indigo-600 hover:text-indigo-800",
        className,
      )}
    >
      {channel.title ? (
        <span className="min-w-0">
          <span className="block truncate font-medium text-zinc-900 group-hover:underline">{channel.title}</span>
          <span className="flex min-w-0 items-center gap-1 text-xs">
            <span className="truncate">{channel.label}</span>
            <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
          </span>
        </span>
      ) : (
        <>
          <span className="truncate group-hover:underline">{channel.label}</span>
          <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
        </>
      )}
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
