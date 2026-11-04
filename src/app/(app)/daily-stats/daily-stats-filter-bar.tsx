"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/**
 * Date-range preset + user filter, both represented in the URL (specification
 * Section 30) — server-side filtering on the next render, same discipline as
 * the Orders filter bar.
 */
export function DailyStatsFilterBar({
  users,
  showUserFilter,
}: {
  users: readonly { id: string; label: string }[];
  showUserFilter: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const currentQuery = searchParams.toString();
  const range = searchParams.get("range") ?? "7d";

  const setParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(currentQuery);
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === "") params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    startTransition(() => {
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    });
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-4">
      <div className="flex flex-wrap items-center gap-1 rounded-[10px] bg-zinc-200/50 p-1 ring-1 ring-inset ring-zinc-200/70">
        {(["today", "7d", "30d", "90d"] as const).map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setParams({ range: preset, from: undefined, to: undefined })}
            className={`h-8 rounded-[7px] px-3 text-[13px] font-medium transition ${
              range === preset ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(16,24,40,0.08),0_0_0_1px_rgba(16,24,40,0.04)]" : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            {preset === "today" ? "Today" : preset === "7d" ? "7 Days" : preset === "30d" ? "30 Days" : "90 Days"}
          </button>
        ))}
        <label className="flex items-center gap-1.5 px-1.5 text-[13px] text-zinc-500">
          <input
            type="date"
            value={searchParams.get("from") ?? ""}
            onChange={(event) => setParams({ range: "custom", from: event.target.value })}
            className="h-8 rounded-[7px] border border-zinc-200 bg-white px-2 text-xs text-ink focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          />
          <span className="text-ink-faint">–</span>
          <input
            type="date"
            value={searchParams.get("to") ?? ""}
            onChange={(event) => setParams({ range: "custom", to: event.target.value })}
            className="h-8 rounded-[7px] border border-zinc-200 bg-white px-2 text-xs text-ink focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          />
        </label>
      </div>

      {showUserFilter ? (
        <select
          aria-label="Filter by user"
          value={searchParams.get("user") ?? ""}
          onChange={(event) => setParams({ user: event.target.value || undefined })}
          className="h-10 rounded-[8px] border border-zinc-200 bg-white px-3 text-[13px] text-ink shadow-[0_1px_1px_rgba(16,24,40,0.03)] hover:border-zinc-300 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
        >
          <option value="">Every user</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
