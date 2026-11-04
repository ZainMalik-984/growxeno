"use client";

import { Clock } from "lucide-react";
import { useSyncExternalStore } from "react";

import { describeDeadline, type DeadlineUrgency } from "@/lib/time/countdown";
import { cn } from "@/lib/utils";

/**
 * A deadline shown as time left ("3d 4h 12m left") with the exact date and
 * time beside it, in the viewer's own timezone. Updates every minute.
 *
 * The server does not know the viewer's clock or timezone, so the first
 * render (server and hydration) shows a quiet placeholder; the real values
 * appear right after, without a hydration mismatch.
 */

const subscribers = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(callback: () => void) {
  subscribers.add(callback);
  if (!timer) timer = setInterval(() => subscribers.forEach((fn) => fn()), 30_000);
  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Current time rounded to the minute, so React re-renders at most once a minute. */
const getSnapshot = () => Math.floor(Date.now() / 60_000) * 60_000;
const getServerSnapshot = () => null;

export function useNowMinute(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const URGENCY_CLASS: Record<DeadlineUrgency, string> = {
  overdue: "bg-red-50 text-red-700 ring-red-200/80",
  soon: "bg-amber-50 text-amber-800 ring-amber-200/80",
  near: "bg-amber-50/60 text-amber-800 ring-amber-200/60",
  later: "bg-emerald-50 text-emerald-800 ring-emerald-200/70",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDeadlineDate(value: Date | string): string {
  return dateFormat.format(new Date(value));
}

export function DeadlineCountdown({
  deadline,
  finished = false,
  showDate = true,
  stacked = false,
  className,
}: {
  deadline: Date | string;
  /** The work is done: show the date only, no countdown. */
  finished?: boolean;
  showDate?: boolean;
  /** Date on its own line under the pill. */
  stacked?: boolean;
  className?: string;
}) {
  const now = useNowMinute();
  const date = new Date(deadline);

  if (now === null) {
    return <span aria-hidden="true" className={cn("inline-block h-5 w-28 animate-pulse rounded-full bg-zinc-100", className)} />;
  }

  const dateText = formatDeadlineDate(date);
  if (finished) {
    return <span className={cn("tabular-nums text-zinc-700", className)}>{dateText}</span>;
  }

  const { label, urgency } = describeDeadline(date, now);
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-0.5", stacked && "flex-col items-end", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset",
          URGENCY_CLASS[urgency],
        )}
      >
        <Clock aria-hidden="true" className="size-3" />
        {label}
      </span>
      {showDate ? <span className="whitespace-nowrap text-xs font-normal tabular-nums text-zinc-500">{dateText}</span> : null}
    </span>
  );
}
