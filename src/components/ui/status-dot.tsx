import { cn } from "@/lib/utils";

/**
 * Status indicator: a 4px dot plus a readable label.
 *
 * Specification Section 99 forbids colourful status pills. A table of thirty
 * rows full of filled badges is unreadable; a dot carries the same information
 * without shouting. Colour is a hint here, never the only signal — the label
 * always accompanies it, which is also what makes this work for colour-blind
 * users and screen readers.
 */

export type StatusTone =
  | "neutral"
  | "active"
  | "progress"
  | "review"
  | "ready"
  | "done"
  | "warning"
  | "danger";

const TONE_DOT: Record<StatusTone, string> = {
  neutral: "bg-status-neutral",
  active: "bg-status-active",
  progress: "bg-status-progress",
  review: "bg-status-review",
  ready: "bg-status-ready",
  done: "bg-status-done",
  warning: "bg-status-warning",
  danger: "bg-status-danger",
};

const TONE_TEXT: Record<StatusTone, string> = {
  neutral: "text-ink-muted",
  active: "text-ink",
  progress: "text-ink",
  review: "text-ink",
  ready: "text-ink",
  done: "text-ink",
  warning: "text-amber-700",
  danger: "text-red-700",
};

export function StatusDot({
  tone = "neutral",
  label,
  className,
}: {
  tone?: StatusTone;
  label: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px]", TONE_TEXT[tone], className)}>
      <span
        aria-hidden="true"
        className={cn("size-1 shrink-0 rounded-full", TONE_DOT[tone])}
      />
      {label}
    </span>
  );
}

const TONE_BADGE: Record<StatusTone, string> = {
  neutral: "bg-zinc-100 text-zinc-600",
  active: "bg-blue-50 text-blue-700",
  progress: "bg-indigo-50 text-indigo-700",
  review: "bg-amber-50 text-amber-700",
  ready: "bg-teal-50 text-teal-700",
  done: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
};

/**
 * Filled colour pill, same tone palette and dot-plus-label accessibility
 * shape as `StatusDot` (colour is reinforcement, never the only signal) —
 * for the pages that opted into visible colour (2026-10-14), alongside
 * `Card`. `StatusDot` is unchanged and still used everywhere else.
 */
export function StatusBadge({
  tone = "neutral",
  label,
  className,
}: {
  tone?: StatusTone;
  label: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", TONE_BADGE[tone], className)}>
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tone])} />
      {label}
    </span>
  );
}
