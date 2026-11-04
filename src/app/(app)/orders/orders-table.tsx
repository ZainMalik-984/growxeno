"use client";

import { ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";

import { DeadlineCountdown } from "@/components/ui/deadline";
import { AcceptItemsButton } from "./accept-items-button";

import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusDot, type StatusTone } from "@/components/ui/status-dot";
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

export type ChannelLink = { href: string; label: string };

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
    <TableWrap>
      <Table className="min-w-[720px]">
        <caption className="sr-only">Orders</caption>
        <THead>
          <TR className="border-0">
            <TH className={cn(th, "w-10")} aria-hidden="true" />
            <TH className={th}>Order</TH>
            <TH className={th}>Channel</TH>
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
        "inline-flex min-w-0 items-center gap-1 text-[13px] text-indigo-600 hover:text-indigo-800 hover:underline",
        className,
      )}
    >
      <span className="truncate">{channel.label}</span>
      <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
