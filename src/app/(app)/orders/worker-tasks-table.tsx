"use client";

import { BarChart3, CalendarClock, ExternalLink, Eye, Hourglass, Link2, StickyNote, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SiYoutube } from "react-icons/si";

import { DeadlineCountdown, formatDeadlineDate, useNowMinute } from "@/components/ui/deadline";
import { Modal } from "@/components/ui/modal";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusDot, type StatusTone } from "@/components/ui/status-dot";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDuration } from "@/lib/time/countdown";
import { cn } from "@/lib/utils";
import { AcceptItemsButton } from "./accept-items-button";
import { CompleteTaskButton } from "./complete-task-button";
import { UpdateProgressControl } from "./update-progress-control";

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
  /** The worker may record the current count (accepted metric tasks, 2026-11-11). */
  canUpdateProgress: boolean;
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
}: {
  rows: WorkerTaskRow[];
  /** A task opened from its accept link (2026-11-11): its popup opens on load, in the short form. */
  focus?: WorkerTaskRow | null;
}) {
  const th = cn(EDGE, "border-zinc-200/80 bg-zinc-50/80 py-2.5 text-zinc-500");
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(focus?.id ?? null);
  const [compact, setCompact] = useState(focus !== null);
  const open = rows.find((row) => row.id === openId) ?? (focus && focus.id === openId ? focus : null);

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
      <TableWrap>
        <Table className="min-w-[1080px]">
          <caption className="sr-only">Your tasks</caption>
          <THead>
            <TR className="border-0">
              <TH className={th}>Task</TH>
              <TH className={th}>Link</TH>
              <TH className={th}>Given</TH>
              <TH className={th}>Progress</TH>
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
                <TD className={cn(EDGE, "whitespace-nowrap py-3")}>
                  <GivenCell assignedAt={task.assignedAt} finishedAt={task.finished ? task.finishedAt : null} />
                </TD>
                <TD className={cn(EDGE, "min-w-40 py-3")}>
                  <ProgressCell task={task} />
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
                    {task.canAccept ? <AcceptItemsButton itemIds={[task.id]} className="h-8 px-3" /> : null}
                    {task.canComplete ? <CompleteTaskButton itemId={task.id} refill={task.isRefill} className="h-8 px-3" /> : null}
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
        className="m-auto w-full max-w-lg rounded-[16px] border border-zinc-200 bg-white p-0 shadow-xl shadow-zinc-900/10 backdrop:bg-zinc-950/30"
      >
        {open ? (
          compact ? (
            <TaskSummary task={open} onClose={close} onShowAll={() => setCompact(false)} />
          ) : (
            <TaskDetails task={open} onClose={close} />
          )
        ) : null}
      </Modal>
    </>
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

/** When the task was given to the worker, and how long ago (or how long it took, once done). */
function GivenCell({ assignedAt, finishedAt }: { assignedAt: Date | null; finishedAt: Date | null }) {
  const now = useNowMinute();
  if (!assignedAt) return <span className="text-zinc-400">—</span>;
  const start = new Date(assignedAt).getTime();
  return (
    <div>
      <span className="block text-[13px] text-zinc-800">{formatDeadlineDate(assignedAt)}</span>
      {now !== null ? (
        <span className="mt-0.5 flex items-center gap-1 text-xs tabular-nums text-zinc-500">
          <Hourglass aria-hidden="true" className="size-3" />
          {finishedAt ? `took ${formatDuration(new Date(finishedAt).getTime() - start)}` : `${formatDuration(now - start)} ago`}
        </span>
      ) : null}
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
      {task.canUpdateProgress && task.metricLabel ? (
        <UpdateProgressControl
          itemId={task.id}
          currentCount={task.currentCount}
          targetCount={task.targetCount}
          metricLabel={task.metricLabel}
          className="mt-1"
        />
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
            <GivenCell assignedAt={task.assignedAt} finishedAt={task.finished ? task.finishedAt : null} />
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
          {task.canAccept ? <AcceptItemsButton itemIds={[task.id]} size="md" /> : null}
          {task.canComplete ? <CompleteTaskButton itemId={task.id} refill={task.isRefill} /> : null}
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
function TaskDetails({ task, onClose }: { task: WorkerTaskRow; onClose: () => void }) {
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
            <GivenCell assignedAt={task.assignedAt} finishedAt={task.finished ? task.finishedAt : null} />
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
            {task.canUpdateProgress && task.metricLabel ? (
              <UpdateProgressControl
                itemId={task.id}
                currentCount={task.currentCount}
                targetCount={task.targetCount}
                metricLabel={task.metricLabel}
                className="mt-2.5"
              />
            ) : null}
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
        <Link href={`/orders/${task.orderId}`} className="text-[13px] font-medium text-zinc-600 hover:text-zinc-900 hover:underline">
          Open order page
        </Link>
        <div className="flex items-center gap-2">
          {task.canAccept ? <AcceptItemsButton itemIds={[task.id]} /> : null}
          {task.canComplete ? <CompleteTaskButton itemId={task.id} refill={task.isRefill} /> : null}
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
