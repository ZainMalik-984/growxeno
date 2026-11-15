"use client";

import type { ServiceMetricType } from "@/lib/services/metric-type";
import { metricStatKey, STAT_KEY_LABELS, STAT_KEYS, type StatKey } from "@/lib/services/tracked-stats";
import { cn } from "@/lib/utils";

/**
 * On/off switches for the YouTube numbers a service follows (owner request,
 * 2026-11-13). The stat that measures the service's progress is always on.
 */
export function TrackedStatsSwitches({
  metricType,
  value,
  onChange,
  disabled,
}: {
  metricType: ServiceMetricType | null;
  value: readonly StatKey[];
  onChange: (next: StatKey[]) => void;
  disabled?: boolean;
}) {
  const locked = metricStatKey(metricType);
  return (
    <fieldset className="space-y-2">
      <legend className="text-[13px] font-medium text-ink">YouTube stats to track</legend>
      <p className="text-xs text-ink-muted">
        Only these are read, saved and shown on this service&apos;s order items.
        {metricType === "WATCH_HOURS" ? " Watch hours are private on YouTube, so they're never read here." : ""}
      </p>
      <ul className="divide-y divide-zinc-100 rounded-[10px] border border-zinc-200">
        {STAT_KEYS.map((key) => {
          const isLocked = key === locked;
          const on = isLocked || value.includes(key);
          return (
            <li key={key} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="text-[13px] text-ink">
                {STAT_KEY_LABELS[key]}
                {isLocked ? <span className="ml-1.5 text-xs text-ink-muted">· progress, always on</span> : null}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`Track ${STAT_KEY_LABELS[key].toLowerCase()}`}
                disabled={disabled || isLocked}
                onClick={() => onChange(on ? value.filter((k) => k !== key) : [...value, key])}
                className={cn("h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-60", on ? "bg-indigo-600" : "bg-zinc-200")}
              >
                <span className={cn("block size-4 rounded-full bg-white shadow-sm transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} />
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
