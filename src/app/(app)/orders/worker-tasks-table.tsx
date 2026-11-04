"use client";

import { ExternalLink, Wallet } from "lucide-react";
import Link from "next/link";

import { DeadlineCountdown } from "@/components/ui/deadline";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusDot, type StatusTone } from "@/components/ui/status-dot";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { AcceptItemsButton } from "./accept-items-button";

/**
 * The orders list as an External Worker sees it (owner request, 2026-11-03:
 * "for outsourced worker the order item is the order, he should see how much
 * he'll make"). One row per task assigned to them, with their pay. Admins and
 * employees keep the order-with-items table (orders-table.tsx).
 */

export type WorkerTaskRow = {
  id: string;
  orderId: string;
  orderNumber: number;
  serviceName: string;
  channel: { href: string; label: string } | null;
  statusLabel: string;
  statusTone: StatusTone;
  canAccept: boolean;
  deadline: Date | null;
  finished: boolean;
  metricLabel: string | null;
  currentCount: number | null;
  targetCount: number | null;
  progressPercent: number | null;
  /** "250.00 PKR", or null when no pay is set yet. */
  earningsLabel: string | null;
};

const EDGE = "first:pl-5 last:pr-5";

export function WorkerTasksTable({ rows }: { rows: WorkerTaskRow[] }) {
  const th = cn(EDGE, "border-zinc-200/80 bg-zinc-50/80 py-2.5 text-zinc-500");

  return (
    <TableWrap>
      <Table className="min-w-[760px]">
        <caption className="sr-only">Your tasks</caption>
        <THead>
          <TR className="border-0">
            <TH className={th}>Task</TH>
            <TH className={th}>Channel</TH>
            <TH className={th}>You earn</TH>
            <TH className={th}>Status</TH>
            <TH className={th}>Deadline</TH>
            <TH className={th}>Progress</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((task) => (
            <TR key={task.id} className="border-zinc-100 transition-colors hover:bg-zinc-50/70">
              <TD className={cn(EDGE, "whitespace-nowrap py-3")}>
                <Link href={`/orders/${task.orderId}`} className="group block">
                  <span className="block font-semibold text-zinc-900 group-hover:text-indigo-600 group-hover:underline">
                    {task.serviceName}
                  </span>
                  <span className="block text-xs tabular-nums text-zinc-500">Order #{task.orderNumber}</span>
                </Link>
              </TD>
              <TD className={cn(EDGE, "max-w-[220px] py-3")}>
                {task.channel ? (
                  <a
                    href={task.channel.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    title={task.channel.href}
                    className="inline-flex min-w-0 items-center gap-1 text-[13px] text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    <span className="truncate">{task.channel.label}</span>
                    <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </TD>
              <TD className={cn(EDGE, "whitespace-nowrap py-3")}>
                {task.earningsLabel ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[13px] font-semibold tabular-nums text-emerald-800 ring-1 ring-inset ring-emerald-200/70">
                    <Wallet aria-hidden="true" className="size-3.5" />
                    {task.earningsLabel}
                  </span>
                ) : (
                  <span className="text-xs text-zinc-500">Not set yet</span>
                )}
              </TD>
              <TD className={cn(EDGE, "py-3")}>
                {task.canAccept ? (
                  <AcceptItemsButton itemIds={[task.id]} className="h-7 px-2.5" />
                ) : (
                  <StatusDot tone={task.statusTone} label={task.statusLabel} />
                )}
              </TD>
              <TD className={cn(EDGE, "whitespace-nowrap py-3")}>
                {task.deadline ? (
                  <DeadlineCountdown deadline={task.deadline} finished={task.finished} stacked className="items-start" />
                ) : (
                  <span className="text-zinc-500">—</span>
                )}
              </TD>
              <TD className={cn(EDGE, "min-w-40 py-3")}>
                {task.progressPercent !== null ? (
                  <div>
                    <div className="flex items-center gap-2.5">
                      <ProgressBar percent={task.progressPercent} className="w-24" />
                      <span className="tabular text-xs font-medium text-zinc-600">{task.progressPercent}%</span>
                    </div>
                    {task.metricLabel ? (
                      <span className="mt-0.5 block text-xs tabular-nums text-zinc-500">
                        {(task.currentCount ?? 0).toLocaleString("en-US")} / {(task.targetCount ?? 0).toLocaleString("en-US")}{" "}
                        {task.metricLabel}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-zinc-500">—</span>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  );
}
