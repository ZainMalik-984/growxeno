import { cn } from "@/lib/utils";

/**
 * A thin aggregate-progress indicator for the orders list (confirmed
 * directly, 2026-10-05): "each row for order should have progress bar and
 * percentage."
 *
 * `rounded-full` is a deliberate, narrow exception to the no-pill rule in
 * docs/DESIGN_SYSTEM.md §1 — that rule targets pill-shaped buttons and
 * cards, not a progress bar's end-caps, which are a standard convention of
 * this exact shape everywhere else.
 */
export function ProgressBar({ percent, className }: { percent: number; className?: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      role="img"
      aria-label={`${clamped}% complete`}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-zinc-100", className)}
    >
      <div className="h-full rounded-full bg-status-progress" style={{ width: `${clamped}%` }} />
    </div>
  );
}
