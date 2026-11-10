import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Small, shared building blocks for profile/overview pages (2026-11-04):
 * the same look as the outsourced-worker page's tiles, so profile pages
 * stay consistent.
 */

const CHIP = {
  indigo: "bg-indigo-50 text-indigo-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  zinc: "bg-zinc-100 text-zinc-500",
} as const;

export type MetricTone = keyof typeof CHIP;

/** Count with an icon, e.g. "Overdue · 2". */
export function MetricTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "indigo",
  emphasize = false,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: MetricTone;
  /** Draws attention when the value matters (e.g. overdue > 0). */
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-[12px] border bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-14px_rgba(16,24,40,0.12)] sm:p-4",
        emphasize ? "border-red-200" : "border-zinc-200/80",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-zinc-600 sm:text-[13px]">{label}</span>
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-[8px]", CHIP[tone])}>
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </div>
      <p className={cn("mt-2 text-2xl font-semibold tracking-tight tabular-nums", emphasize ? "text-red-700" : "text-zinc-900")}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

/** A money figure (already formatted per currency). */
export function MoneyTile({
  icon: Icon,
  label,
  value,
  tone = "zinc",
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  tone?: "zinc" | "emerald" | "amber";
}) {
  const box = {
    zinc: "bg-zinc-50 ring-zinc-200/70 text-zinc-500",
    emerald: "bg-emerald-50/70 ring-emerald-200/70 text-emerald-700",
    amber: "bg-amber-50 ring-amber-200/80 text-amber-800",
  }[tone];
  return (
    <div className={cn("min-w-0 rounded-[10px] px-3.5 py-3 ring-1 ring-inset", box)}>
      <p className="flex items-center gap-1.5 text-xs font-medium">
        <Icon aria-hidden="true" className="size-3.5" />
        {label}
      </p>
      <p className="mt-1 break-words text-lg font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}

/** A short, low-height empty state for a section inside a card. */
export function CompactEmpty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-dashed border-zinc-200 px-4 py-3.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-500">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-zinc-800">{title}</p>
        {description ? <p className="text-xs text-zinc-500">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
