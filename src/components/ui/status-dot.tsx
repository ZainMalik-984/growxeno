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
