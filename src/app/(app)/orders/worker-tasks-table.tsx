"use client";

import { BarChart3, CalendarClock, ExternalLink, Eye, Hourglass, Link2, StickyNote, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SiYoutube } from "react-icons/si";

import { DeadlineCountdown, formatDeadlineDate, useNowMinute } from "@/components/ui/deadline";
import { Modal, SHEET_CLASS } from "@/components/ui/modal";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge, StatusDot, type StatusTone } from "@/components/ui/status-dot";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDuration } from "@/lib/time/countdown";
import { cn } from "@/lib/utils";
import { AcceptItemsButton } from "./accept-items-button";
import { CompleteTaskButton } from "./complete-task-button";
import { RejectTaskButton } from "./reject-task-button";
import {
  AskScreenshotsDialog,
  AskScreenshotsTrigger,
  CantContinueDialog,
  CantContinueTrigger,
  clearUpdatesParam,
  ItemUpdatesSheet,
  progressSentence,
  UpdatesTrigger,
} from "@/components/orders/item-updates";

/**
 * The orders list as an External Worker sees it (owner request, 2026-11-03:
 * "for outsourced worker the order item is the order"; reworked 2026-11-11).
 * One row per task: the link with the channel's name, when it was given and
 * how long ago, progress, the YouTube Studio analytics link for watch hours,
 * pay, and Accept / Complete right in the row. "Details" opens everything else
 * about the task in a popup. Admins and employees keep orders-table.tsx.
 */

export type WorkerTaskRow = {
  id: string;
  orderId: string;
  orderNumber: number;
  serviceName: string;
  /** Opens the client's channel/video; label is the link without the scheme ("youtube.com/@name"). */
  channel: { href: string; label: string } | null;
  /** Channel or video name from YouTube, when known. */
  channelTitle: string | null;
  isYoutube: boolean;
  studioUrl: string | null;
  isWatchHours: boolean;
  statusLabel: string;
  statusTone: StatusTone;
  isRefill: boolean;
  canAccept: boolean;
  canComplete: boolean;
  /** Why Complete is off: YouTube doesn't show the target yet (2026-11-12). */
  completeBlocker: string | null;
  /** The worker may post in the task's updates thread (2026-11-11): anything but a cancelled task. */
  canPostUpdate: boolean;
  /** Posts in the updates thread so far. */
  updateCount: number;
  /** The worker's screenshot request is waiting for the team (2026-11-11). */
  hasOpenRequest: boolean;
  /** The worker said they can't continue; the team hasn't reassigned it yet. */
  hasWithdrawRequest: boolean;
  assignedAt: Date | null;
  finishedAt: Date | null;
  deadline: Date | null;
  finished: boolean;
  metricLabel: string | null;
  startingCount: number | null;
  currentCount: number | null;
  targetCount: number | null;
  progressPercent: number | null;
  /** Delivered since the task started (current − starting; can pass `required`), and how many were asked for. */
  delivered: number | null;
  required: number | null;
  /** "250.00 PKR", or null when no pay is set yet. */
  earningsLabel: string | null;
  description: string | null;
  stats: { label: string; value: number | null }[] | null;
  statsAt: Date | null;
  links: { id: string; href: string; label: string }[];
};

const EDGE = "first:pl-5 last:pr-5";
const numberFormat = new Intl.NumberFormat("en-US");

export function WorkerTasksTable({
  rows,
  focus = null,
  openUpdatesId = null,
}: {
  rows: WorkerTaskRow[];
  /** A task opened from its accept link (2026-11-11): its popup opens on load, in the short form. */
  focus?: WorkerTaskRow | null;
  /** A task whose updates open on load (from a notification). */
  openUpdatesId?: string | null;
}) {
  const th = cn(EDGE, "border-zinc-200/80 bg-zinc-50/80 py-2.5 text-zinc-500");
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(focus?.id ?? null);
  const [compact, setCompact] = useState(focus !== null);
  const open = rows.find((row) => row.id === openId) ?? (focus && focus.id === openId ? focus : null);
  // One updates sheet for the whole list (a task shows as a card and a table row).
  const [updatesId, setUpdatesId] = useState<string | null>(openUpdatesId);
  // "Ask for screenshots" popup (2026-11-11).
  const [askFor, setAskFor] = useState<WorkerTaskRow | null>(null);
  // "Can't continue" popup (2026-11-11).
  const [giveUp, setGiveUp] = useState<WorkerTaskRow | null>(null);
  const cantContinue = (task: WorkerTaskRow) => {
    setOpenId(null);
    setGiveUp(task);
  };
  const askScreenshots = (task: WorkerTaskRow) => {
    setOpenId(null);
    setAskFor(task);
  };
  const openUpdates = (id: string) => {
    setOpenId(null);
    setUpdatesId(id);
  };

  const openDetails = (id: string) => {
    setCompact(false);
    setOpenId(id);
  };
  const close = () => {
    setOpenId(null);
    setCompact(false);
    // Drop ?open= so a refresh doesn't pop it up again.
    if (focus) {
      const url = new URL(window.location.href);
      url.searchParams.delete("open");
      router.replace(`${url.pathname}${url.search}`, { scroll: false });
    }
  };

  return (
    <>
      {/* Phones: one card per task with its action full width (2026-11-11). */}
      <ul className="divide-y divide-zinc-100 md:hidden">
        {rows.map((task) => (
          <TaskCard key={task.id} task={task} onOpen={() => openDetails(task.id)} onUpdates={() => openUpdates(task.id)} onAsk={() => askScreenshots(task)} onCantContinue={() => cantContinue(task)} />
        ))}
      </ul>

      <TableWrap className="hidden md:block">
        <Table className="min-w-[1080px]">
          <caption className="sr-only">Your tasks</caption>
          <THead>
            <TR className="border-0">
              <TH className={th}>Task</TH>
              <TH className={th}>Link</TH>
              <TH className={th}>Time &amp; progress</TH>
              <TH className={th}>Analytics</TH>
              <TH className={th}>You earn</TH>
              <TH className={th}>Status</TH>
              <TH className={cn(th, "text-right")}>
                <span className="sr-only">Actions</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((task) => (
              <TR key={task.id} className="border-zinc-100 align-top transition-colors hover:bg-zinc-50/70">
                <TD className={cn(EDGE, "whitespace-nowrap py-3")}>
                  <button type="button" onClick={() => openDetails(task.id)} className="group block text-left">
                    <span className="block font-semibold text-zinc-900 group-hover:text-indigo-600 group-hover:underline">
                      {task.serviceName}
                    </span>
                    <span className="block text-xs tabular-nums text-zinc-500">Order #{task.orderNumber}</span>
                  </button>
                </TD>
                <TD className={cn(EDGE, "max-w-[240px] py-3")}>
                  <ChannelCell task={task} />
                </TD>
                {/* Time since it was given, prominent, with progress under it (owner request, 2026-11-13). */}
                <TD className={cn(EDGE, "min-w-48 py-3")}>
                  <Elapsed assignedAt={task.assignedAt} finishedAt={task.finished ? task.finishedAt : null} showDate />
                  <div className="mt-2">
                    <ProgressCell task={task} />
                  </div>
                </TD>
                <TD className={cn(EDGE, "whitespace-nowrap py-3")}>
                  {task.studioUrl ? (
                    <a
                      href={task.studioUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1.5 rounded-[8px] px-2 py-1 text-[13px] font-medium text-indigo-600 ring-1 ring-inset ring-indigo-200/70 hover:bg-indigo-50"
                    >
                      <BarChart3 aria-hidden="true" className="size-3.5" />
                      Studio
                      <ExternalLink aria-hidden="true" className="size-3" />
                      <span className="sr-only">(YouTube Studio analytics, opens in a new tab)</span>
                    </a>
                  ) : task.isWatchHours ? (
                    <span className="text-xs text-zinc-500" title="Appears once the channel has been read from YouTube">
                      Not available yet
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </TD>
                <TD className={cn(EDGE, "whitespace-nowrap py-3")}>
                  <Earnings label={task.earningsLabel} />
                </TD>
                <TD className={cn(EDGE, "whitespace-nowrap py-3")}>
                  <StatusDot tone={task.statusTone} label={task.statusLabel} />
                </TD>
                <TD className={cn(EDGE, "whitespace-nowrap py-3 text-right")}>
                  <div className="inline-flex items-center gap-1.5">
                    {/* Not accepted yet: only Accept and Reject (2026-11-12). */}
                    {task.canAccept ? (
                      <>
                        <AcceptItemsButton itemIds={[task.id]} className="h-8 px-3" />
                        <RejectTaskButton itemId={task.id} serviceName={task.serviceName} className="h-8 px-3" />
                      </>
                    ) : (
                      <>
                        <UpdatesTrigger count={task.updateCount} canPost={task.canPostUpdate} onClick={() => openUpdates(task.id)} className="h-8 px-3" />
                        {task.canPostUpdate && !task.finished ? (
                          <AskScreenshotsTrigger waiting={task.hasOpenRequest} onClick={() => askScreenshots(task)} className="h-8 px-2.5" />
                        ) : null}
                        {task.canPostUpdate && !task.finished ? (
                          <CantContinueTrigger sent={task.hasWithdrawRequest} onClick={() => cantContinue(task)} className="h-8 px-2.5" />
                        ) : null}
                        {task.canComplete ? <CompleteTaskButton itemId={task.id} refill={task.isRefill} blocker={task.completeBlocker} className="h-8 px-3" /> : null}
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => openDetails(task.id)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      <Eye aria-hidden="true" className="size-3.5" />
                      Details
                    </button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </TableWrap>

      <Modal
        open={open !== null}
        onClose={close}
        labelledBy="task-details-title"
        className={SHEET_CLASS}
      >
        {open ? (
          compact ? (
            <TaskSummary task={open} onClose={close} onShowAll={() => setCompact(false)} />
          ) : (
            <TaskDetails task={open} onClose={close} onUpdates={() => openUpdates(open.id)} onAsk={() => askScreenshots(open)} onCantContinue={() => cantContinue(open)} />
          )
        ) : null}
      </Modal>

      {updatesId ? (
        <ItemUpdatesSheet
          itemId={updatesId}
          onClose={() => {
            setUpdatesId(null);
            clearUpdatesParam(router.replace);
          }}
        />
      ) : null}

      {askFor ? <AskScreenshotsDialog itemId={askFor.id} serviceName={askFor.serviceName} onClose={() => setAskFor(null)} /> : null}
      {giveUp ? (
        <CantContinueDialog
          itemId={giveUp.id}
          serviceName={giveUp.serviceName}
          progress={progressSentence(giveUp, giveUp.metricLabel)}
          onClose={() => setGiveUp(null)}
        />
      ) : null}
    </>
  );
}

/** One task on a phone: tap anywhere to see details; Accept / Complete full width at the bottom. */
function TaskCard({
  task,
  onOpen,
  onUpdates,
  onAsk,
  onCantContinue,
}: {
  task: WorkerTaskRow;
  onOpen: () => void;
  onUpdates: () => void;
  onAsk: () => void;
  onCantContinue: () => void;
}) {
  return (
    <li className="relative px-4 py-4 transition-colors active:bg-zinc-50">
      <button type="button" onClick={onOpen} className="absolute inset-0" aria-label={`Details for ${task.serviceName}, order #${task.orderNumber}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-zinc-900">{task.serviceName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-xs tabular-nums text-zinc-500">Order #{task.orderNumber}</span>
            <StatusBadge tone={task.statusTone} label={task.statusLabel} className="px-2 py-0.5" />
          </div>
        </div>
        {/* How long since it was given, top right where it's seen first (owner request, 2026-11-13). */}
        <Elapsed assignedAt={task.assignedAt} finishedAt={task.finished ? task.finishedAt : null} className="shrink-0" />
      </div>

      {task.channel ? (
        <div className="relative mt-2.5">
          <ChannelCell task={task} />
        </div>
      ) : null}

      {task.progressPercent !== null ? (
        <div className="mt-3">
          <div className="flex items-center gap-2.5">
            <ProgressBar percent={task.progressPercent} className="flex-1" />
            <span className="tabular text-xs font-semibold text-zinc-700">{task.progressPercent}%</span>
          </div>
          {task.metricLabel && task.delivered !== null && task.required !== null ? (
            <p className="mt-1 text-xs tabular-nums text-zinc-600">
              <span className="font-semibold text-zinc-900">{numberFormat.format(task.delivered)}</span> / {numberFormat.format(task.required)}{" "}
              {task.metricLabel} delivered
              {task.currentCount !== null ? <span className="text-zinc-400"> · now {numberFormat.format(task.currentCount)}</span> : null}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <div className="flex items-center gap-2">
          {task.studioUrl ? (
            <a
              href={task.studioUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="relative inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-indigo-600 ring-1 ring-inset ring-indigo-200/70"
            >
              <BarChart3 aria-hidden="true" className="size-3.5" />
              Studio
              <span className="sr-only">(YouTube Studio analytics, opens in a new tab)</span>
            </a>
          ) : null}
          {task.earningsLabel ? <Earnings label={task.earningsLabel} /> : null}
        </div>
      </div>

      {task.canAccept ? (
        // Not accepted yet: only Accept and Reject (2026-11-12).
        <div className="relative mt-3 grid grid-cols-2 gap-2">
          <AcceptItemsButton itemIds={[task.id]} size="md" className="h-11 w-full text-sm" />
          <RejectTaskButton itemId={task.id} serviceName={task.serviceName} className="h-11 w-full text-sm" />
        </div>
      ) : (
        <>
          {/* Post update sits beside the next step, both full size (2026-11-11). */}
          <div className={cn("relative mt-3 grid gap-2", task.canComplete && "grid-cols-2")}>
            <UpdatesTrigger count={task.updateCount} canPost={task.canPostUpdate} onClick={onUpdates} className="h-11 w-full text-sm" />
            {task.canComplete ? <CompleteTaskButton itemId={task.id} refill={task.isRefill} blocker={task.completeBlocker} className="h-11 w-full text-sm" /> : null}
          </div>
          {task.canPostUpdate && !task.finished ? (
            <div className="relative mt-2 grid grid-cols-2 gap-2">
              <AskScreenshotsTrigger waiting={task.hasOpenRequest} onClick={onAsk} className="h-10 w-full" />
              <CantContinueTrigger sent={task.hasWithdrawRequest} onClick={onCantContinue} className="h-10 w-full" />
            </div>
          ) : null}
        </>
      )}
    </li>
  );
}

function ChannelCell({ task }: { task: WorkerTaskRow }) {
  if (!task.channel) return <span className="text-zinc-400">—</span>;
  return (
    <a
      href={task.channel.href}
      target="_blank"
      rel="noreferrer noopener"
      title={task.channel.href}
      className="group flex min-w-0 items-start gap-1.5"
    >
      {task.isYoutube ? <SiYoutube aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-[#FF0000]" /> : null}
      <span className="min-w-0">
        {task.channelTitle ? (
          <span className="block truncate text-[13px] font-medium text-zinc-900 group-hover:underline">{task.channelTitle}</span>
        ) : null}
        <span
          className={cn(
            "flex min-w-0 items-center gap-1 text-indigo-600 group-hover:text-indigo-800",
            task.channelTitle ? "text-xs" : "text-[13px] group-hover:underline",
          )}
        >
          <span className="truncate">{task.channel.label}</span>
          <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
        </span>
      </span>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/**
 * How long since the task was given, big and easy to spot (owner request,
 * 2026-11-13); once done, how long it took. `showDate` adds when it was given.
 */
function Elapsed({
  assignedAt,
  finishedAt,
  showDate = false,
  className,
}: {
  assignedAt: Date | null;
  finishedAt: Date | null;
  showDate?: boolean;
  className?: string;
}) {
  const now = useNowMinute();
  if (!assignedAt) return showDate ? <span className="text-zinc-400">—</span> : null;
  const start = new Date(assignedAt).getTime();
  const ms = finishedAt ? new Date(finishedAt).getTime() - start : now !== null ? now - start : null;
  return (
    <div className={cn("text-right md:text-left", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-[8px] px-2 py-1 ring-1 ring-inset",
          finishedAt ? "bg-zinc-50 text-zinc-800 ring-zinc-200" : "bg-indigo-50 text-indigo-950 ring-indigo-200/80",
        )}
        title={`Given ${formatDeadlineDate(assignedAt)}`}
      >
        <Hourglass aria-hidden="true" className={cn("size-3.5", finishedAt ? "text-zinc-400" : "text-indigo-500")} />
        <span className="text-[15px] font-semibold leading-none tabular-nums">{ms !== null ? formatDuration(ms) : "—"}</span>
        <span className={cn("text-[11px] leading-none", finishedAt ? "text-zinc-500" : "text-indigo-700/80")}>{finishedAt ? "taken" : "elapsed"}</span>
      </span>
      {showDate ? <span className="mt-1 block text-xs text-zinc-500">Given {formatDeadlineDate(assignedAt)}</span> : null}
    </div>
  );
}

function ProgressCell({ task }: { task: WorkerTaskRow }) {
  if (task.progressPercent === null) return <span className="text-zinc-400">—</span>;
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <ProgressBar percent={task.progressPercent} className="w-24" />
        <span className="tabular text-xs font-medium text-zinc-600">{task.progressPercent}%</span>
      </div>
      {task.metricLabel && task.delivered !== null && task.required !== null ? (
        <>
          {/* What the worker has delivered, not the channel's total (owner request, 2026-11-11). */}
          <span className="mt-0.5 block text-xs tabular-nums text-zinc-700">
            <span className="font-semibold">{numberFormat.format(task.delivered)}</span> / {numberFormat.format(task.required)}{" "}
            {task.metricLabel} delivered
          </span>
          {task.currentCount !== null ? (
            <span className="block text-[11px] tabular-nums text-zinc-500">Now at {numberFormat.format(task.currentCount)}</span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Earnings({ label }: { label: string | null }) {
  return label ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[13px] font-semibold tabular-nums text-emerald-800 ring-1 ring-inset ring-emerald-200/70">
      <Wallet aria-hidden="true" className="size-3.5" />
      {label}
    </span>
  ) : (
    <span className="text-xs text-zinc-500">Not set yet</span>
  );
}

/**
 * The short popup an accept link opens (owner request, 2026-11-11): the same
 * details the message carried — link, need, current, stop — plus pay and the
 * Accept button. "Show all details" switches to the full popup.
 */
function TaskSummary({ task, onClose, onShowAll }: { task: WorkerTaskRow; onClose: () => void; onShowAll: () => void }) {
  const current = task.startingCount ?? 0;
  return (
    <div>
      <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-6 py-5">
        <div className="min-w-0">
          <p className="text-xs font-medium tabular-nums text-zinc-500">New task · Order #{task.orderNumber}</p>
          <h2 id="task-details-title" className="text-[15px] font-semibold text-zinc-900">
            {task.serviceName}
          </h2>
          <div className="mt-1.5">
            <StatusDot tone={task.statusTone} label={task.statusLabel} />
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-[8px] p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>

      <div className="space-y-4 px-6 py-5 text-[13px]">
        {task.channel ? (
          <Detail icon={Link2} label="Link">
            <ChannelCell task={task} />
          </Detail>
        ) : null}

        {task.metricLabel && task.required !== null && task.targetCount !== null ? (
          <dl className="grid grid-cols-3 gap-2 rounded-[10px] bg-zinc-50 p-3.5 ring-1 ring-inset ring-zinc-200/70">
            <SummaryFigure label="Need" value={task.required} unit={task.metricLabel} strong />
            <SummaryFigure label={`Current ${task.metricLabel}`} value={current} />
            <SummaryFigure label="Stop at" value={task.targetCount} unit={task.metricLabel} />
          </dl>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <Detail icon={Hourglass} label="Given">
            <Elapsed assignedAt={task.assignedAt} finishedAt={task.finished ? task.finishedAt : null} showDate className="text-left" />
          </Detail>
          <Detail icon={Wallet} label="You earn">
            <Earnings label={task.earningsLabel} />
          </Detail>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-6 py-4">
        <button type="button" onClick={onShowAll} className="text-[13px] font-medium text-zinc-600 hover:text-zinc-900 hover:underline">
          Show all details
        </button>
        <div className="flex items-center gap-2">
          {task.canAccept ? <RejectTaskButton itemId={task.id} serviceName={task.serviceName} /> : null}
          {task.canAccept ? <AcceptItemsButton itemIds={[task.id]} size="md" /> : null}
          {task.canComplete ? <CompleteTaskButton itemId={task.id} refill={task.isRefill} blocker={task.completeBlocker} /> : null}
          {!task.canAccept && !task.canComplete ? <span className="text-xs text-zinc-500">{task.statusLabel}</span> : null}
        </div>
      </div>
    </div>
  );
}

function SummaryFigure({ label, value, unit, strong }: { label: string; value: number; unit?: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs capitalize text-zinc-500">{label}</dt>
      <dd className={cn("tabular-nums text-zinc-900", strong ? "text-[17px] font-semibold" : "text-[15px] font-medium")}>
        {numberFormat.format(value)}
        {unit ? <span className="ml-1 text-xs font-normal text-zinc-500">{unit}</span> : null}
      </dd>
    </div>
  );
}

/** Everything about one task, in the popup. */
function TaskDetails({
  task,
  onClose,
  onUpdates,
  onAsk,
  onCantContinue,
}: {
  task: WorkerTaskRow;
  onClose: () => void;
  onUpdates: () => void;
  onAsk: () => void;
  onCantContinue: () => void;
}) {
  const { delivered, required } = task;

  return (
    <div>
      <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-6 py-5">
        <div className="min-w-0">
          <p className="text-xs font-medium tabular-nums text-zinc-500">Order #{task.orderNumber}</p>
          <h2 id="task-details-title" className="text-[15px] font-semibold text-zinc-900">
            {task.serviceName}
          </h2>
          <div className="mt-1.5">
            <StatusDot tone={task.statusTone} label={task.statusLabel} />
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-[8px] p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>

      <div className="max-h-[65vh] space-y-4 overflow-y-auto px-6 py-5 text-[13px]">
        {task.channel ? (
          <Detail icon={Link2} label={task.isYoutube ? "Channel / video" : "Link"}>
            <ChannelCell task={task} />
          </Detail>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <Detail icon={Hourglass} label="Given">
            <Elapsed assignedAt={task.assignedAt} finishedAt={task.finished ? task.finishedAt : null} showDate className="text-left" />
          </Detail>
          <Detail icon={CalendarClock} label="Deadline">
            {task.deadline ? (
              <DeadlineCountdown deadline={task.deadline} finished={task.finished} stacked className="items-start" />
            ) : (
              <span className="text-zinc-500">Not set</span>
            )}
          </Detail>
        </div>

        {task.progressPercent !== null ? (
          <div className="rounded-[10px] bg-zinc-50 p-3.5 ring-1 ring-inset ring-zinc-200/70">
            <div className="flex items-center gap-2.5">
              <ProgressBar percent={task.progressPercent} className="flex-1" />
              <span className="tabular text-xs font-semibold text-zinc-700">{task.progressPercent}%</span>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <Figure label="Delivered" value={delivered} />
              <Figure label="Required" value={required} />
              <Figure label="Now at" value={task.currentCount} />
            </dl>
            {delivered !== null && required !== null && task.metricLabel ? (
              <p className="mt-2 text-xs text-zinc-600">
                {numberFormat.format(delivered)} of {numberFormat.format(required)} {task.metricLabel} delivered.
              </p>
            ) : null}
          </div>
        ) : null}

        {task.stats ? (
          <Detail icon={BarChart3} label={`On YouTube${task.statsAt ? ` · ${formatDeadlineDate(task.statsAt)}` : ""}`}>
            <dl className="flex flex-wrap gap-x-5 gap-y-1">
              {task.stats.map((s) => (
                <div key={s.label} className="flex items-baseline gap-1.5">
                  <dt className="text-xs text-zinc-500">{s.label}</dt>
                  <dd className="font-semibold tabular-nums text-zinc-900">{s.value !== null ? numberFormat.format(s.value) : "Hidden"}</dd>
                </div>
              ))}
            </dl>
          </Detail>
        ) : null}

        {task.studioUrl ? (
          <Detail icon={BarChart3} label="Watch hours">
            <a href={task.studioUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline">
              Open YouTube Studio analytics
              <ExternalLink aria-hidden="true" className="size-3" />
            </a>
          </Detail>
        ) : null}

        <Detail icon={Wallet} label="You earn">
          <Earnings label={task.earningsLabel} />
        </Detail>

        {task.description ? (
          <Detail icon={StickyNote} label="Note">
            <p className="whitespace-pre-wrap text-zinc-700">{task.description}</p>
          </Detail>
        ) : null}

        {task.links.length > 0 ? (
          <Detail icon={Link2} label="Other links">
            <ul className="space-y-1">
              {task.links.map((link) => (
                <li key={link.id}>
                  <a href={link.href} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                    <span className="truncate">{link.label}</span>
                    <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </Detail>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href={`/orders/${task.orderId}`} className="text-[13px] font-medium text-zinc-600 hover:text-zinc-900 hover:underline">
            Open order page
          </Link>
          {task.canPostUpdate && !task.finished && !task.canAccept ? (
            <CantContinueTrigger sent={task.hasWithdrawRequest} onClick={onCantContinue} className="h-8 px-2" />
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {task.canAccept ? (
            <>
              <RejectTaskButton itemId={task.id} serviceName={task.serviceName} />
              <AcceptItemsButton itemIds={[task.id]} />
            </>
          ) : (
            <>
              {task.canPostUpdate && !task.finished ? <AskScreenshotsTrigger waiting={task.hasOpenRequest} onClick={onAsk} /> : null}
              <UpdatesTrigger count={task.updateCount} canPost={task.canPostUpdate} onClick={onUpdates} />
              {task.canComplete ? <CompleteTaskButton itemId={task.id} refill={task.isRefill} blocker={task.completeBlocker} /> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, children }: { icon: typeof Link2; label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        <Icon aria-hidden="true" className="size-3.5" />
        {label}
      </p>
      {children}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-semibold tabular-nums text-zinc-900">{value !== null ? numberFormat.format(value) : "—"}</dd>
    </div>
  );
}
