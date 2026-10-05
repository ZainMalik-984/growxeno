"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/** Date-range preset, same pattern as the Daily Statistics filter bar. */
export function FinanceRangeBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const currentQuery = searchParams.toString();
  const range = searchParams.get("range") ?? "30d";

  const setParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(currentQuery);
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === "") params.delete(key);
      else params.set(key, value);
    }
    startTransition(() => {
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    });
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-1">
        {(["today", "7d", "30d", "90d"] as const).map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setParams({ range: preset, from: undefined, to: undefined })}
            className={`h-7 rounded-[3px] px-2.5 text-[13px] transition-colors ${
              range === preset ? "bg-ink text-canvas" : "text-ink-muted hover:bg-canvas-subtle"
            }`}
          >
            {preset === "today" ? "Today" : preset === "7d" ? "7 Days" : preset === "30d" ? "30 Days" : "90 Days"}
          </button>
        ))}
        <label className="flex items-center gap-1.5 pl-2 text-[13px] text-ink-muted">
          <input
            type="date"
            value={searchParams.get("from") ?? ""}
            onChange={(event) => setParams({ range: "custom", from: event.target.value })}
            className="h-7 rounded-[3px] border border-line bg-canvas px-1.5 text-xs text-ink"
          />
          <span className="text-ink-faint">–</span>
          <input
            type="date"
            value={searchParams.get("to") ?? ""}
            onChange={(event) => setParams({ range: "custom", to: event.target.value })}
            className="h-7 rounded-[3px] border border-line bg-canvas px-1.5 text-xs text-ink"
          />
        </label>
      </div>
    </div>
  );
}
