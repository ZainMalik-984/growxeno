"use client";

import { History, UserCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CompactEmpty } from "@/components/ui/metric";
import { StatusBadge, type StatusTone } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";

/**
 * Recent activity and the work this employee handed out, in one card
 * switched by tabs (2026-11-04). Dates arrive pre-formatted from the server
 * so both renders match.
 */

export type ActivityEntry = { id: string; summary: string; when: string };
export type AssignmentEntry = {
  id: string;
  orderId: string;
  orderNumber: number;
  serviceName: string;
  workerName: string;
  statusLabel: string;
  statusTone: StatusTone;
  when: string | null;
};

export function ActivityTabs({ activity, assignments }: { activity: ActivityEntry[]; assignments: AssignmentEntry[] }) {
  const [tab, setTab] = useState<"activity" | "assignments">("activity");
  const tabs = [
    { key: "activity" as const, label: "Recent activity", count: activity.length },
    { key: "assignments" as const, label: "Assignments", count: assignments.length },
  ];

  return (
    <div>
      <div role="tablist" aria-label="Activity" className="mb-4 inline-flex gap-1 rounded-[9px] bg-zinc-100 p-1 ring-1 ring-inset ring-zinc-200/70">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`employee-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`employee-panel-${t.key}`}
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40",
              tab === t.key ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-zinc-500 hover:text-zinc-800",
            )}
          >
            {t.label}
            <span className="rounded-full bg-zinc-200/70 px-1.5 text-[11px] tabular-nums text-zinc-600">{t.count}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`employee-panel-${tab}`} aria-labelledby={`employee-tab-${tab}`}>
        {tab === "activity" ? (
          activity.length === 0 ? (
            <CompactEmpty icon={History} title="No activity yet" description="Orders this person creates or changes show up here." />
          ) : (
            <ol className="relative ml-1.5 space-y-3.5 border-l border-zinc-200 pl-5">
              {activity.map((entry) => (
                <li key={entry.id} className="relative">
                  <span aria-hidden="true" className="absolute -left-[25px] top-1.5 size-2.5 rounded-full bg-white ring-2 ring-indigo-400" />
                  <p className="text-[13px] text-zinc-800">{entry.summary}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{entry.when}</p>
                </li>
              ))}
            </ol>
          )
        ) : assignments.length === 0 ? (
          <CompactEmpty icon={UserCheck} title="Nothing assigned yet" description="Items this person hands to a worker appear here." />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {assignments.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-[13px]">
                <div className="min-w-0">
                  <Link href={`/orders/${item.orderId}`} className="font-medium text-zinc-900 hover:text-indigo-600 hover:underline">
                    #{item.orderNumber} · {item.serviceName}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    to {item.workerName}
                    {item.when ? ` · ${item.when}` : ""}
                  </p>
                </div>
                <StatusBadge tone={item.statusTone} label={item.statusLabel} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
