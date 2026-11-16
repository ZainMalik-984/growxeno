"use client";

import {
  Ban,
  BarChart3,
  Camera,
  CheckCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Hourglass,
  Link2,
  MessageSquareText,
  RefreshCw,
  StickyNote,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SiYoutube } from "react-icons/si";
import { toast } from "sonner";

import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { CategoryThumb } from "@/components/catalog/category-thumb";
import { UnreadBadge } from "@/components/orders/unread-badge";
import { DeadlineCountdown, formatDeadlineDate, useNowMinute } from "@/components/ui/deadline";
import { Modal, SHEET_CLASS } from "@/components/ui/modal";
import { StatusBadge, type StatusTone } from "@/components/ui/status-dot";
import { changeOrderItemStatusAction } from "@/lib/orders/actions";
import { formatDuration } from "@/lib/time/countdown";
import { cn } from "@/lib/utils";
import { refreshOrderItemStatsAction } from "@/lib/youtube/actions";
import { AcceptItemsButton } from "./accept-items-button";
import { CompleteTaskButton } from "./complete-task-button";
import { RejectTaskButton, RejectTaskDialog } from "./reject-task-button";
import {
  AskScreenshotsDialog,
  CantContinueDialog,
  clearUpdatesParam,
  ItemUpdatesSheet,
  progressSentence,
} from "@/components/orders/item-updates";
import { GrowXenoLoader } from "@/components/brand/grow-xeno-loader";

/**
 * The orders list as an External Worker sees it (owner request, 2026-11-03:
 * "for outsourced worker the order item is the order"). Redesigned 2026-11-15
 * ("progress rings", chosen from five variants): one compact row per task with
 * a progress ring, the link, status and pay, and how long it has been open in
 * large type coloured by age; every action sits in a "⋯" menu. The same row
 * works on phones. "Details" opens everything else in a popup. Admins and
 * employees keep orders-table.tsx.
 */

export type WorkerTaskRow = {
  id: string;
  orderId: string;
  orderNumber: number;
  /** Unread update notifications for this task (2026-11-15). */
  unreadUpdates?: number;
  serviceName: string;
  /** Shown as category logo + service name, e.g. [YouTube logo] Subscribers (2026-11-15). */
  serviceTitle?: string;
  categoryName?: string;
  categoryImageUrl?: string | null;
  /** Opens the client's channel/video; label is the link without the scheme ("youtube.com/@name"). */
  channel: { href: string; label: string } | null;
  /** Channel or video name from YouTube, when known. */
  channelTitle: string | null;
  isYoutube: boolean;
  studioUrl: string | null;
  /** Opens the channel by its UC… id; null when unknown or the link already is that (2026-11-15). */
  channelIdUrl?: string | null;
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

const numberFormat = new Intl.NumberFormat("en-US");
const DAY = 24 * 60 * 60 * 1000;

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
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(focus?.id ?? null);
  const [compact, setCompact] = useState(focus !== null);
  const open = rows.find((row) => row.id === openId) ?? (focus && focus.id === openId ? focus : null);
  // One of each popup for the whole list.
  const [updatesId, setUpdatesId] = useState<string | null>(openUpdatesId);
  const [askFor, setAskFor] = useState<WorkerTaskRow | null>(null);
  const [giveUp, setGiveUp] = useState<WorkerTaskRow | null>(null);
  const [rejectFor, setRejectFor] = useState<WorkerTaskRow | null>(null);
  const [completeFor, setCompleteFor] = useState<WorkerTaskRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const leaveDetails = () => setOpenId(null);
  const actions: TaskActions = {
    details: (task) => {
      setCompact(false);
      setOpenId(task.id);
    },
    updates: (task) => {
      leaveDetails();
      setUpdatesId(task.id);
    },
    ask: (task) => {
      leaveDetails();
      setAskFor(task);
    },
    cantContinue: (task) => {
      leaveDetails();
      setGiveUp(task);
    },
    reject: (task) => {
      leaveDetails();
      setRejectFor(task);
    },
    complete: (task) => {
      leaveDetails();
      setCompleteFor(task);
    },
    accept: (task) => {
      setBusyId(task.id);
      startTransition(async () => {
        const result = await changeOrderItemStatusAction({ itemId: task.id, status: "PROCESSING" });
        if (result.ok) toast.success("Task accepted.");
        else toast.error(result.error);
        setBusyId(null);
        router.refresh();
      });
    },
    checkYoutube: (task) => {
      setBusyId(task.id);
      startTransition(async () => {
        const result = await refreshOrderItemStatsAction({ itemId: task.id });
        if (!result.ok) toast.error(result.error);
        else toast.success("Checked YouTube. Complete turns on once the count reaches the target.");
        setBusyId(null);
        router.refresh();
      });
    },
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
      <div className="hidden grid-cols-[44px_minmax(0,1fr)_150px_120px_32px] gap-x-4 border-b border-zinc-200/80 bg-zinc-50/80 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500 md:grid">
        <span className="col-span-2">Task</span>
        <span>Status &amp; pay</span>
        <span className="text-right">Elapsed</span>
        <span className="sr-only">Actions</span>
      </div>
      <ul aria-label="Your tasks" className="divide-y divide-zinc-100">
        {rows.map((task) => (
          <TaskRow key={task.id} task={task} actions={actions} busy={busyId === task.id} />
        ))}
      </ul>

      <Modal open={open !== null} onClose={close} labelledBy="task-details-title" className={SHEET_CLASS}>
        {open ? (
          compact ? (
            <TaskSummary task={open} onClose={close} onShowAll={() => setCompact(false)} />
          ) : (
            <TaskDetails task={open} onClose={close} actions={actions} busy={busyId === open.id} />
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
      {rejectFor ? <RejectTaskDialog itemId={rejectFor.id} serviceName={rejectFor.serviceName} onClose={() => setRejectFor(null)} /> : null}
      {completeFor ? <CompleteTaskDialog task={completeFor} onClose={() => setCompleteFor(null)} /> : null}
    </>
  );
}

type TaskActions = Record<
  "details" | "updates" | "ask" | "cantContinue" | "reject" | "complete" | "accept" | "checkYoutube",
  (task: WorkerTaskRow) => void
>;

/**
 * What the "⋯" menu offers for a task. Not accepted yet: Accept and Reject
 * only (2026-11-12). Otherwise the next step first, then the rest, with
 * Can't continue last and in red. `inDetails` leaves out "Details".
 */
function taskMenu(task: WorkerTaskRow, actions: TaskActions, { inDetails = false, busy = false } = {}): ActionMenuItem[] {
  const details: ActionMenuItem[] = inDetails ? [] : ["separator", { label: "Details", icon: Eye, onSelect: () => actions.details(task) }];
  const links: ActionMenuItem[] = [
    ...(task.studioUrl ? [{ label: "Studio analytics", icon: BarChart3, href: task.studioUrl, external: true }] : []),
    ...(task.channel ? [{ label: task.isYoutube ? "Open on YouTube" : "Open link", icon: ExternalLink, href: task.channel.href, external: true }] : []),
  ];

  if (task.canAccept) {
    return [
      { label: busy ? "Accepting…" : "Accept task", icon: CheckCircle2, tone: "primary", disabled: busy, onSelect: () => actions.accept(task) },
      { label: "Reject", icon: XCircle, tone: "danger", onSelect: () => actions.reject(task) },
      ...(links.length ? ["separator" as const, ...links] : []),
      ...details,
    ];
  }

  const open = task.canPostUpdate && !task.finished;
  const doneLabel = task.isRefill ? "Refill done" : "Complete";
  const complete: ActionMenuItem[] = task.canComplete
    ? task.completeBlocker
      ? [
          { label: doneLabel, icon: CheckCheck, disabled: true, hint: task.completeBlocker },
          { label: busy ? "Checking YouTube…" : "Check YouTube again", icon: RefreshCw, disabled: busy, onSelect: () => actions.checkYoutube(task) },
        ]
      : [{ label: doneLabel, icon: CheckCheck, tone: "primary", onSelect: () => actions.complete(task) }]
    : [];

  return [
    ...complete,
    {
      label: `${task.canPostUpdate ? "Post update" : "Updates"}${task.updateCount > 0 ? ` (${task.updateCount})` : ""}`,
      icon: MessageSquareText,
      onSelect: () => actions.updates(task),
    },
    ...(open
      ? [
          task.hasOpenRequest
            ? { label: "Screenshots requested", icon: Clock, disabled: true, hint: "Waiting for the team" }
            : { label: "Ask for screenshots", icon: Camera, onSelect: () => actions.ask(task) },
        ]
      : []),
    ...links,
    ...details,
    ...(open
      ? [
          "separator" as const,
          task.hasWithdrawRequest
            ? { label: "Waiting for reassignment", icon: Clock, disabled: true, hint: "You said you can't continue" }
            : { label: "Can't continue", icon: Ban, tone: "danger" as const, onSelect: () => actions.cantContinue(task) },
        ]
      : []),
  ];
}

/**
 * One task: ring, what and where, status and pay, elapsed, "⋯". On phones the
 * status and pay move under the link and the elapsed time sits top right
 * beside the menu (owner request, 2026-11-13). Tapping the row opens details.
 */
function TaskRow({ task, actions, busy }: { task: WorkerTaskRow; actions: TaskActions; busy: boolean }) {
  const label = `${task.serviceName}, order #${task.orderNumber}`;
  return (
    <li
      className={cn(
        "relative grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-x-3 px-4 py-3.5 transition-colors md:grid-cols-[44px_minmax(0,1fr)_150px_120px_32px] md:items-center md:gap-x-4 md:px-5",
        // Waiting for Accept or Reject: a soft blink so it isn't missed (owner request, 2026-11-15).
        task.canAccept ? "pending-blink" : "hover:bg-zinc-50/70",
      )}
    >
      <button type="button" onClick={() => actions.details(task)} className="absolute inset-0" aria-label={`Details for ${label}`} />

      <ProgressRing percent={task.progressPercent} />

      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-1.5 text-[14px] font-semibold leading-snug text-zinc-900">
          <ServiceLogo task={task} />
          <span className="min-w-0 md:truncate">{task.serviceTitle ?? task.serviceName}</span>
          <span className="shrink-0 text-xs font-normal tabular-nums text-zinc-500">#{task.orderNumber}</span>
          <UnreadBadge count={task.unreadUpdates ?? 0} onClick={() => actions.updates(task)} />
        </p>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-zinc-500 md:flex-nowrap">
          {task.channel ? <ChannelLink task={task} /> : null}
          {task.studioUrl ? (
            <>
              <span aria-hidden="true" className="text-zinc-300">|</span>
              <a
                href={task.studioUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="relative inline-flex shrink-0 items-center gap-1 rounded-[6px] px-1 font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
              >
                <BarChart3 aria-hidden="true" className="size-3 text-zinc-500" />
                Studio
                <span className="sr-only">(YouTube Studio analytics, opens in a new tab)</span>
              </a>
            </>
          ) : null}
          {task.channel && task.metricLabel && task.delivered !== null ? <span aria-hidden="true" className="hidden md:inline">·</span> : null}
          <DeliveredText task={task} className="shrink-0" />
        </div>
        {/* Status and pay under the link on phones. */}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 md:hidden">
          <StatusBadge tone={task.statusTone} label={task.statusLabel} className="px-2 py-0.5" />
          <Pay label={task.earningsLabel} />
        </div>
        {task.canAccept ? <AcceptOffer task={task} actions={actions} busy={busy} className="mt-2.5 md:hidden" /> : null}
        <Flags task={task} />
      </div>

      <div className="hidden md:block">
        {task.canAccept ? (
          <AcceptOffer task={task} actions={actions} busy={busy} />
        ) : (
          <StatusBadge tone={task.statusTone} label={task.statusLabel} className="px-2 py-0.5" />
        )}
        <div className="mt-1">
          <Pay label={task.earningsLabel} />
        </div>
      </div>

      {/* Phones: elapsed and the menu side by side, top right; from md each is its own column. */}
      <div className="flex items-start gap-1 md:contents">
        <Elapsed assignedAt={task.assignedAt} finishedAt={task.finished ? task.finishedAt : null} />
        <ActionMenu label={`Actions for ${label}`} items={taskMenu(task, actions, { busy })} className="relative -mr-1.5 md:mr-0" />
      </div>
    </li>
  );
}

/** The category's logo before the service name. */
function ServiceLogo({ task, size = 18 }: { task: WorkerTaskRow; size?: number }) {
  if (!task.categoryName) return null;
  return <CategoryThumb name={task.categoryName} imageUrl={task.categoryImageUrl ?? null} size={size} className="rounded-[5px]" />;
}

/**
 * Accept / Reject right on the row while a task waits for an answer (owner
 * request, 2026-11-15: "so he knows he still needs to accept or reject").
 */
function AcceptOffer({ task, actions, busy, className }: { task: WorkerTaskRow; actions: TaskActions; busy: boolean; className?: string }) {
  return (
    <div className={cn("relative flex items-center gap-1.5", className)}>
      <button
        type="button"
        onClick={() => actions.accept(task)}
        disabled={busy}
        className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-indigo-600 px-3 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 max-md:h-9 max-md:flex-1 max-md:justify-center"
      >
        {busy ? <GrowXenoLoader size="xs" variant="light" label="" /> : <CheckCircle2 aria-hidden="true" className="size-3.5" />}
        {busy ? "Accepting…" : "Accept"}
      </button>
      <button
        type="button"
        onClick={() => actions.reject(task)}
        className="inline-flex h-8 items-center rounded-[8px] px-2.5 text-[13px] font-medium text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50 max-md:h-9 max-md:flex-1 max-md:justify-center"
      >
        Reject
      </button>
    </div>
  );
}

/** Progress as a ring with the percentage inside; a plain ring when there's nothing to count. */
function ProgressRing({ percent, size = 44 }: { percent: number | null; size?: number }) {
  const stroke = size >= 52 ? 5 : 4;
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const value = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const done = value >= 100;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={percent === null ? "No progress to show" : `${value}% done`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-zinc-200/80" />
      {percent !== null && value > 0 ? (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c.toFixed(2)}
          strokeDashoffset={(c * (1 - value / 100)).toFixed(2)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={done ? "stroke-emerald-500" : "stroke-indigo-600"}
        />
      ) : null}
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className={cn("fill-zinc-800 font-semibold tabular-nums", size >= 52 ? "text-[13px]" : "text-[11px]")}
      >
        {percent === null ? "—" : `${value}%`}
      </text>
    </svg>
  );
}

function ChannelLink({ task, className }: { task: WorkerTaskRow; className?: string }) {
  if (!task.channel) return null;
  return (
    <a
      href={task.channel.href}
      target="_blank"
      rel="noreferrer noopener"
      title={task.channel.href}
      className={cn("relative inline-flex min-w-0 max-w-full items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800 hover:underline", className)}
    >
      {task.isYoutube ? <SiYoutube aria-hidden="true" className="size-3.5 shrink-0 text-[#FF0000]" /> : null}
      <span className="truncate">{task.channelTitle ?? task.channel.label}</span>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/** "500 of 5,000 subscribers": what the worker delivered, not the channel's total (2026-11-11). */
function DeliveredText({ task, className }: { task: WorkerTaskRow; className?: string }) {
  if (!task.metricLabel || task.delivered === null || task.required === null) return null;
  return (
    <span className={cn("tabular-nums", className)}>
      <span className="font-medium text-zinc-700">{numberFormat.format(task.delivered)}</span> of {numberFormat.format(task.required)} {task.metricLabel}
    </span>
  );
}

/** Waiting on the team: a screenshot request or a can't-continue. */
function Flags({ task }: { task: WorkerTaskRow }) {
  if (!task.hasOpenRequest && !task.hasWithdrawRequest) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {task.hasOpenRequest ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
          <Clock aria-hidden="true" className="size-3" />
          Screenshots requested
        </span>
      ) : null}
      {task.hasWithdrawRequest ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 ring-1 ring-inset ring-red-200">
          <Clock aria-hidden="true" className="size-3" />
          Waiting for reassignment
        </span>
      ) : null}
    </div>
  );
}

function Pay({ label }: { label: string | null }) {
  return label ? (
    <span className="text-[13px] font-semibold tabular-nums text-emerald-700">{label}</span>
  ) : (
    <span className="text-xs text-zinc-500">Pay not set</span>
  );
}

/** Colour by how long it's been open: green under a day, amber to three days, red after (2026-11-15). */
function ageTone(ms: number | null, finished: boolean): string {
  if (finished || ms === null) return "text-zinc-700";
  if (ms < DAY) return "text-emerald-600";
  if (ms < 3 * DAY) return "text-amber-600";
  return "text-red-600";
}

/**
 * How long since the task was given, big and easy to spot (owner request,
 * 2026-11-13); once done, how long it took.
 */
function Elapsed({
  assignedAt,
  finishedAt,
  large = false,
  inline = false,
  className,
}: {
  assignedAt: Date | null;
  finishedAt: Date | null;
  large?: boolean;
  /** One line: "3d 7h elapsed". */
  inline?: boolean;
  className?: string;
}) {
  const now = useNowMinute();
  if (!assignedAt) return <span className={cn("text-right text-zinc-400", className)}>—</span>;
  const start = new Date(assignedAt).getTime();
  const ms = finishedAt ? new Date(finishedAt).getTime() - start : now !== null ? now - start : null;
  if (inline) {
    return (
      <p className={cn("flex items-baseline gap-1.5", className)} title={`Given ${formatDeadlineDate(assignedAt)}`}>
        <span className={cn("text-[17px] font-semibold tabular-nums", ageTone(ms, finishedAt !== null))}>{ms !== null ? formatDuration(ms) : "—"}</span>
        <span className="text-xs text-zinc-500">{finishedAt ? "taken" : "elapsed"}</span>
      </p>
    );
  }
  return (
    <div className={cn("text-right", className)} title={`Given ${formatDeadlineDate(assignedAt)}`}>
      <p className={cn("font-semibold leading-tight tabular-nums", large ? "text-[22px]" : "text-[17px]", ageTone(ms, finishedAt !== null))}>
        {ms !== null ? formatDuration(ms) : "—"}
      </p>
      <p className="text-[11px] text-zinc-500">{finishedAt ? "taken" : "elapsed"}</p>
    </div>
  );
}

/** The confirm step for Complete / Refill done from the menu. */
function CompleteTaskDialog({ task, onClose }: { task: WorkerTaskRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await changeOrderItemStatusAction({ itemId: task.id, status: "DONE" });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(task.isRefill ? "Refill marked done." : "Task completed.");
      onClose();
      router.refresh();
    });
  };
  return (
    <Modal open onClose={onClose} labelledBy={`complete-title-${task.id}`} className={cn(SHEET_CLASS, "sm:max-w-md")}>
      <div className="px-5 py-5">
        <h2 id={`complete-title-${task.id}`} className="text-[15px] font-semibold text-zinc-900">
          {task.isRefill ? "Mark the refill done?" : "Mark this task done?"}
        </h2>
        <p className="mt-1 text-[13px] text-zinc-500">
          {task.serviceName} · Order #{task.orderNumber}. The team checks it and accepts the delivery.
        </p>
        {error ? (
          <p role="alert" className="mt-3 text-[13px] text-red-600">
            {error}
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-[10px] text-sm font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50">
            Not yet
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {pending ? <GrowXenoLoader size="xs" variant="light" label="" /> : <CheckCheck aria-hidden="true" className="size-4" />}
            {task.isRefill ? "Refill done" : "Complete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Popup header shared by the short and full popups: ring, task, status and pay, elapsed. */
function PopupHeader({ task, kicker, onClose }: { task: WorkerTaskRow; kicker: string; onClose: () => void }) {
  return (
    <div className="flex items-start gap-4 border-b border-zinc-100 px-5 py-4 sm:px-6">
      <ProgressRing percent={task.progressPercent} size={56} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium tabular-nums text-zinc-500">{kicker}</p>
        <h2 id="task-details-title" className="flex min-w-0 items-center gap-1.5 text-[16px] font-semibold leading-snug text-zinc-900">
          <ServiceLogo task={task} size={20} />
          <span className="min-w-0 sm:truncate">{task.serviceTitle ?? task.serviceName}</span>
        </h2>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <StatusBadge tone={task.statusTone} label={task.statusLabel} className="px-2 py-0.5" />
          <Pay label={task.earningsLabel} />
        </div>
        {/* Phones: elapsed under the title so the name has room. */}
        <Elapsed assignedAt={task.assignedAt} finishedAt={task.finished ? task.finishedAt : null} inline className="mt-1.5 sm:hidden" />
      </div>
      <Elapsed assignedAt={task.assignedAt} finishedAt={task.finished ? task.finishedAt : null} large className="hidden shrink-0 sm:block" />
      <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 rounded-[8px] p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

/** The link as one line (2026-11-15): "name link | channel-id link icon | Studio". */
function LinkLine({ task }: { task: WorkerTaskRow }) {
  if (!task.channel && !task.studioUrl) return null;
  const parts: React.ReactNode[] = [];
  if (task.channel) {
    parts.push(
      <a key="link" href={task.channel.href} target="_blank" rel="noreferrer noopener" className="group inline-flex min-w-0 items-center gap-1.5">
        {task.isYoutube ? <SiYoutube aria-hidden="true" className="size-4 shrink-0 text-[#FF0000]" /> : <Link2 aria-hidden="true" className="size-4 text-zinc-400" />}
        {task.channelTitle ? <span className="font-medium text-zinc-900 group-hover:underline">{task.channelTitle}</span> : null}
        <span className={cn("truncate text-indigo-600", !task.channelTitle && "group-hover:underline")}>{task.channel.label}</span>
        <span className="sr-only">(opens in a new tab)</span>
      </a>,
    );
  }
  if (task.channelIdUrl) {
    parts.push(
      <a
        key="id"
        href={task.channelIdUrl}
        target="_blank"
        rel="noreferrer noopener"
        title="Open by channel ID"
        aria-label="Open by channel ID"
        className="inline-flex size-6 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
      >
        <Link2 aria-hidden="true" className="size-4" />
      </a>,
    );
  }
  if (task.studioUrl) {
    parts.push(
      <a
        key="studio"
        href={task.studioUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex h-7 items-center gap-1.5 rounded-[7px] border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
      >
        <BarChart3 aria-hidden="true" className="size-3.5 text-zinc-500" />
        Studio
        <span className="sr-only">(YouTube Studio analytics, opens in a new tab)</span>
      </a>,
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px]">
      {parts.flatMap((part, i) => (i === 0 ? [part] : [<span key={`sep-${i}`} aria-hidden="true" className="text-zinc-300">|</span>, part]))}
    </div>
  );
}

type FigureItem = { label: string; value: number | null; strong?: boolean; note?: string; tone?: "indigo" | "amber" | "emerald" };

/** A strip of labelled figures, each with an optional line under it. */
function Figures({ items }: { items: FigureItem[] }) {
  return (
    <dl className={cn("grid divide-x divide-zinc-200/70 rounded-[10px] bg-zinc-50 ring-1 ring-inset ring-zinc-200/70", items.length === 4 ? "grid-cols-2 sm:grid-cols-4 max-sm:[&>div:nth-child(3)]:border-l-0 max-sm:[&>div:nth-child(n+3)]:border-t max-sm:[&>div:nth-child(n+3)]:border-zinc-200/70" : "grid-cols-3")}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0 px-3 py-2">
          <dt className="truncate text-[11px] font-medium uppercase tracking-wide text-zinc-500">{item.label}</dt>
          <dd
            className={cn(
              "mt-0.5 tabular-nums",
              item.strong ? "text-[17px] font-semibold" : "text-[15px] font-medium",
              item.tone === "indigo" ? "text-indigo-700" : item.tone === "amber" ? "text-amber-700" : item.tone === "emerald" ? "text-emerald-700" : "text-zinc-900",
            )}
          >
            {item.value !== null ? numberFormat.format(item.value) : "—"}
          </dd>
          {item.note ? <dd className="truncate text-[11px] text-zinc-500">{item.note}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/**
 * The short popup an accept link opens (owner request, 2026-11-11): the same
 * details the message carried (link, need, current, stop) plus pay and the
 * Accept button. "Show all details" switches to the full popup.
 */
function TaskSummary({ task, onClose, onShowAll }: { task: WorkerTaskRow; onClose: () => void; onShowAll: () => void }) {
  const current = task.startingCount ?? 0;
  return (
    <div>
      <PopupHeader task={task} kicker={`New task · Order #${task.orderNumber}`} onClose={onClose} />

      <div className="space-y-4 px-5 py-5 text-[13px] sm:px-6">
        <LinkLine task={task} />
        {task.metricLabel && task.required !== null && task.targetCount !== null ? (
          <dl className="grid grid-cols-3 gap-2 rounded-[10px] bg-zinc-50 p-3.5 ring-1 ring-inset ring-zinc-200/70">
            <SummaryFigure label="Need" value={task.required} unit={task.metricLabel} strong />
            <SummaryFigure label={`Current ${task.metricLabel}`} value={current} />
            <SummaryFigure label="Stop at" value={task.targetCount} unit={task.metricLabel} />
          </dl>
        ) : null}
        {task.assignedAt ? <p className="text-xs text-zinc-500">Given {formatDeadlineDate(task.assignedAt)}</p> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-5 py-4 sm:px-6">
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

/**
 * Everything about one task (redesigned 2026-11-15 to match the list): the
 * ring and elapsed time up top, the link, the figures, deadline, YouTube
 * numbers, note and links. The next step is a button; the rest is in "⋯".
 */
function TaskDetails({ task, onClose, actions, busy }: { task: WorkerTaskRow; onClose: () => void; actions: TaskActions; busy: boolean }) {
  const menu = task.canAccept ? [] : taskMenu(task, actions, { inDetails: true, busy }).filter((item) => item === "separator" || !(item.tone === "primary" || item.label.startsWith("Refill done") || item.label === "Complete"));
  // No leading or doubled separators once the primary step is taken out.
  const tidy = menu.filter((item, i, all) => item !== "separator" || (i > 0 && i < all.length - 1 && all[i - 1] !== "separator"));
  // YouTube numbers other than the one already shown as Current.
  const otherStats = (task.stats ?? []).filter((stat) => !task.metricLabel || stat.label.toLowerCase() !== task.metricLabel.toLowerCase());

  return (
    <div>
      <PopupHeader task={task} kicker={`Order #${task.orderNumber}`} onClose={onClose} />

      {/* Compact (owner request, 2026-11-15): figures without captions, one line for given and deadline. */}
      <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4 text-[13px] sm:px-6">
        <LinkLine task={task} />

        {task.progressPercent !== null ? <Figures items={progressFigures(task)} /> : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
          <span className="inline-flex items-center gap-1.5 text-zinc-600">
            <Hourglass aria-hidden="true" className="size-3.5 text-zinc-400" />
            Given <span className="font-medium text-zinc-900">{task.assignedAt ? formatDeadlineDate(task.assignedAt) : "—"}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-zinc-600">
            <Clock aria-hidden="true" className="size-3.5 text-zinc-400" />
            Deadline
            {task.deadline ? <DeadlineCountdown deadline={task.deadline} finished={task.finished} /> : <span className="font-medium text-zinc-900">Not set</span>}
          </span>
        </div>

        {otherStats.length > 0 ? (
          <Fact icon={BarChart3} label={`On YouTube${task.statsAt ? ` · ${formatDeadlineDate(task.statsAt)}` : ""}`}>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {otherStats.map((s) => (
                <span key={s.label} className="flex items-baseline gap-1.5">
                  <span className="text-xs text-zinc-500">{s.label}</span>
                  <span className="font-semibold tabular-nums text-zinc-900">{s.value !== null ? numberFormat.format(s.value) : "Hidden"}</span>
                </span>
              ))}
            </div>
          </Fact>
        ) : null}

        {task.description ? (
          <Fact icon={StickyNote} label="Note">
            <p className="whitespace-pre-wrap text-zinc-700">{task.description}</p>
          </Fact>
        ) : null}

        {task.links.length > 0 ? (
          <Fact icon={FileText} label="Other links">
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
          </Fact>
        ) : null}

        <Flags task={task} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-5 py-3.5 sm:px-6">
        <Link href={`/orders/${task.orderId}`} className="text-[13px] font-medium text-zinc-600 hover:text-zinc-900 hover:underline">
          Open order page
        </Link>
        <div className="flex items-center gap-2">
          {task.canAccept ? (
            <>
              <RejectTaskButton itemId={task.id} serviceName={task.serviceName} />
              <AcceptItemsButton itemIds={[task.id]} size="md" />
            </>
          ) : (
            <>
              {tidy.length > 0 ? <ActionMenu label={`More actions for ${task.serviceName}`} items={tidy} buttonClassName="size-9 ring-1 ring-inset ring-zinc-200" /> : null}
              {task.canComplete ? <CompleteTaskButton itemId={task.id} refill={task.isRefill} blocker={task.completeBlocker} className="h-9" /> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function progressFigures(task: WorkerTaskRow): FigureItem[] {
  const { delivered, required } = task;
  const remaining = delivered !== null && required !== null ? Math.max(0, required - delivered) : null;
  return [
    { label: "Started at", value: task.startingCount },
    { label: "Current", value: task.currentCount },
    { label: "Completed", value: delivered, strong: true, tone: "indigo" },
    { label: "Remaining", value: remaining, strong: true, tone: remaining === 0 ? "emerald" : "amber" },
  ];
}

function Fact({ icon: Icon, label, children }: { icon: typeof Link2; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        <Icon aria-hidden="true" className="size-3.5" />
        {label}
      </p>
      <div className="text-zinc-800">{children}</div>
    </div>
  );
}
