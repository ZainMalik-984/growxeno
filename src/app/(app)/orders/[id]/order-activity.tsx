"use client";

import {
  ArrowRight,
  Ban,
  Camera,
  CircleDot,
  MessageSquareText,
  PackagePlus,
  RefreshCw,
  Repeat2,
  Sparkles,
  StickyNote,
  UserPlus,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { formatDeadlineDate, useNowMinute } from "@/components/ui/deadline";
import { StatusBadge, type StatusTone } from "@/components/ui/status-dot";
import type { OrderItemStatus, OrderStatus } from "@/generated/prisma/client";
import { describeActivity, type ActivityKind, type ActivityParts } from "@/lib/orders/describe-activity";
import type { OrderActivityRow } from "@/lib/orders/queries";
import { ORDER_ITEM_STATUS_LABELS, ORDER_STATUS_LABELS } from "@/lib/orders/state-machine";
import { ITEM_STATUS_TONE, ORDER_STATUS_TONE } from "@/lib/orders/status-tone";
import { formatDuration } from "@/lib/time/countdown";
import { cn } from "@/lib/utils";

/**
 * The order's activity as a readable timeline (owner request, 2026-11-16:
 * "simple text, can't really tell the context"). Each entry gets an icon for
 * what kind of thing happened, who did it, the item it was about, and the
 * details laid out (status from → to as badges, who it went to and for how
 * much). Grouped by day, newest first, with how long ago on each entry.
 */

const KIND: Record<ActivityKind, { icon: LucideIcon; tone: string }> = {
  created: { icon: Sparkles, tone: "bg-indigo-50 text-indigo-600 ring-indigo-200" },
  "order-status": { icon: Workflow, tone: "bg-zinc-100 text-zinc-500 ring-zinc-200" },
  "item-added": { icon: PackagePlus, tone: "bg-sky-50 text-sky-600 ring-sky-200" },
  "item-status": { icon: CircleDot, tone: "bg-violet-50 text-violet-600 ring-violet-200" },
  assigned: { icon: UserPlus, tone: "bg-emerald-50 text-emerald-600 ring-emerald-200" },
  reassigned: { icon: Repeat2, tone: "bg-amber-50 text-amber-600 ring-amber-200" },
  update: { icon: MessageSquareText, tone: "bg-indigo-50 text-indigo-600 ring-indigo-200" },
  stats: { icon: RefreshCw, tone: "bg-red-50 text-red-500 ring-red-200" },
  screenshots: { icon: Camera, tone: "bg-amber-50 text-amber-600 ring-amber-200" },
  withdraw: { icon: Ban, tone: "bg-red-50 text-red-600 ring-red-200" },
  note: { icon: StickyNote, tone: "bg-zinc-100 text-zinc-600 ring-zinc-200" },
  other: { icon: CircleDot, tone: "bg-zinc-100 text-zinc-500 ring-zinc-200" },
};

// Status labels back to their badge colour (item labels win: "Done", "Refill", …).
const TONE_BY_LABEL = new Map<string, StatusTone>([
  ...(Object.entries(ORDER_STATUS_LABELS) as [OrderStatus, string][]).map(([s, label]) => [label, ORDER_STATUS_TONE[s]] as const),
  ...(Object.entries(ORDER_ITEM_STATUS_LABELS) as [OrderItemStatus, string][]).map(([s, label]) => [label, ITEM_STATUS_TONE[s]] as const),
]);

const PAGE = 12;
const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" });
const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(date);

export function OrderActivityFeed({ entries }: { entries: readonly OrderActivityRow[] }) {
  const now = useNowMinute();
  const [showAll, setShowAll] = useState(false);
  if (entries.length === 0) return <p className="text-[13px] text-zinc-500">No activity yet.</p>;

  const shown = showAll ? entries : entries.slice(0, PAGE);
  const days: { key: string; date: Date; rows: OrderActivityRow[] }[] = [];
  for (const entry of shown) {
    const date = new Date(entry.createdAt);
    const key = dayKey(date);
    const last = days.at(-1);
    if (last && last.key === key) last.rows.push(entry);
    else days.push({ key, date, rows: [entry] });
  }

  return (
    <div className="space-y-5">
      {days.map((day) => (
        <section key={day.key} aria-label={dayLabel(day.date, now)}>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{dayLabel(day.date, now)}</h3>
          <ol className="relative space-y-1">
            {day.rows.map((entry, index) => (
              <Entry key={entry.id} entry={entry} now={now} last={index === day.rows.length - 1} />
            ))}
          </ol>
        </section>
      ))}
      {entries.length > PAGE ? (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[13px] font-medium text-indigo-600 hover:underline">
          {showAll ? "Show less" : `Show all ${entries.length}`}
        </button>
      ) : null}
    </div>
  );
}

function Entry({ entry, now, last }: { entry: OrderActivityRow; now: number | null; last: boolean }) {
  const parts = describeActivity(entry.action, entry.summary, entry.actorLabel);
  const { icon: Icon, tone } = KIND[parts.kind];
  const at = new Date(entry.createdAt);
  return (
    <li className="relative flex gap-3 pb-3">
      {/* The line joining entries of the same day. */}
      {!last ? <span aria-hidden="true" className="absolute left-[13px] top-8 bottom-0 w-px bg-zinc-200" /> : null}
      <span aria-hidden="true" className={cn("relative mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ring-1 ring-inset", tone)}>
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] leading-6 text-zinc-700">
          <Headline parts={parts} />
          {parts.item ? <ItemChip name={parts.item} /> : null}
          <Detail parts={parts} />
        </p>
        <p className="text-xs text-zinc-500" title={`${formatDeadlineDate(at)} (PKT)`}>
          {timeLabel(at, now)}
          {parts.automatic ? <span className="ml-1.5 rounded bg-zinc-100 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-zinc-500">Auto</span> : null}
        </p>
      </div>
    </li>
  );
}

function Headline({ parts }: { parts: ActivityParts }) {
  if (parts.kind === "other") return <span>{parts.verb}</span>;
  if (!parts.actor) return <span className="font-medium text-zinc-900">{parts.verb}</span>;
  return (
    <>
      <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-900">
        <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-semibold text-white">
          {initials(parts.actor)}
        </span>
        {parts.actor}
      </span>
      <span>{parts.verb}</span>
    </>
  );
}

function Detail({ parts }: { parts: ActivityParts }) {
  const d = parts.detail;
  if (!d) return null;
  if (d.type === "change") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        {d.from ? (
          <>
            <Status label={d.from} muted />
            <ArrowRight aria-label="to" className="size-3.5 text-zinc-400" />
          </>
        ) : null}
        <Status label={d.to} />
      </span>
    );
  }
  if (d.type === "person") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span>to</span>
        <span className="font-semibold text-zinc-900">{d.name}</span>
        {d.extra ? <span className="rounded-full bg-emerald-50 px-2 py-px text-xs font-semibold tabular-nums text-emerald-700 ring-1 ring-inset ring-emerald-200">{d.extra}</span> : null}
      </span>
    );
  }
  if (d.type === "handover") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className="text-zinc-900">{d.from}</span>
        <ArrowRight aria-label="to" className="size-3.5 text-zinc-400" />
        <span className="font-semibold text-zinc-900">{d.to}</span>
      </span>
    );
  }
  return <span className="rounded-[6px] bg-zinc-100 px-1.5 py-px text-xs text-zinc-700">{d.text}</span>;
}

function Status({ label, muted = false }: { label: string; muted?: boolean }) {
  const tone = TONE_BY_LABEL.get(label);
  if (!tone) return <span className="font-medium text-zinc-900">{label}</span>;
  return <StatusBadge tone={tone} label={label} className={cn("px-2 py-0", muted && "opacity-70")} />;
}

/** "Youtube · Subscribers" shows as "Subscribers"; the full name on hover. */
function ItemChip({ name }: { name: string }) {
  const short = name.includes(" · ") ? name.split(" · ").slice(1).join(" · ") : name;
  return (
    <span title={name} className="inline-flex max-w-full items-center rounded-[6px] bg-zinc-100 px-1.5 py-px text-xs font-medium text-zinc-800 ring-1 ring-inset ring-zinc-200">
      <span className="truncate">{short}</span>
    </span>
  );
}

function dayLabel(date: Date, now: number | null): string {
  if (now !== null) {
    const today = dayKey(new Date(now));
    const yesterday = dayKey(new Date(now - 86_400_000));
    const key = dayKey(date);
    if (key === today) return "Today";
    if (key === yesterday) return "Yesterday";
  }
  return dayFormat.format(date);
}

function timeLabel(date: Date, now: number | null): string {
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" }).format(date);
  if (now === null) return time;
  const ago = now - date.getTime();
  if (ago < 60_000) return `${time} · just now`;
  if (ago < 86_400_000) return `${time} · ${formatDuration(ago)} ago`;
  return time;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}
