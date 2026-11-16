"use client";

import { Bell } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * "There's a new update" on an order or item row (owner request, 2026-11-15).
 * Clicking it opens the updates, which marks them read and removes the badge.
 */
export function UnreadBadge({ count, onClick, className }: { count: number; onClick: () => void; className?: string }) {
  if (count <= 0) return null;
  const label = `${count} new ${count === 1 ? "update" : "updates"}`;
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={`${label}. Open`}
      className={cn(
        "relative inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 text-[11px] font-semibold tabular-nums text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-100",
        className,
      )}
    >
      <span aria-hidden="true" className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:hidden" />
        <span className="relative inline-flex size-2 rounded-full bg-red-500" />
      </span>
      <Bell aria-hidden="true" className="size-3" />
      {count}
    </button>
  );
}
