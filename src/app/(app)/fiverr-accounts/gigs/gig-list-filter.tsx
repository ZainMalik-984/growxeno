"use client";

import { Search } from "lucide-react";
import { useState } from "react";

import { GigStatsPanel } from "./gig-stats-panel";
import type { GigStatRow, GigWithAccount } from "@/lib/fiverr-accounts/queries";

type PanelProps = {
  key: string;
  gig: GigWithAccount;
  initialStats: GigStatRow[];
  canManage: boolean;
  canManageStats: boolean;
};

export function GigListFilter({ panels }: { panels: PanelProps[] }) {
  const [query, setQuery] = useState("");

  const normalised = query.trim().toLowerCase();
  const visible = normalised
    ? panels.filter(
        ({ gig }) =>
          gig.name.toLowerCase().includes(normalised) ||
          gig.fiverrAccountName.toLowerCase().includes(normalised),
      )
    : panels;

  return (
    <>
      {panels.length > 1 && (
        <div className="relative mb-6 max-w-xs">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            placeholder="Search by account or gig name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-[13px] text-zinc-500">No gigs match your search.</p>
      ) : (
        <div className="space-y-10">
          {visible.map(({ key, gig, initialStats, canManage, canManageStats }) => (
            <GigStatsPanel
              key={key}
              gig={gig}
              initialStats={initialStats}
              canManage={canManage}
              canManageStats={canManageStats}
            />
          ))}
        </div>
      )}
    </>
  );
}
