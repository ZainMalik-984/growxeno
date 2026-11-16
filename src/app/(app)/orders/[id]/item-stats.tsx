"use client";

import { AlertTriangle, ChevronDown, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useNowMinute } from "@/components/ui/deadline";
import type { ItemStats, ItemStatsReading } from "@/lib/orders/queries";
import type { ServiceMetricType } from "@/lib/services/metric-type";
import { cn } from "@/lib/utils";
import { refreshOrderItemStatsAction } from "@/lib/youtube/actions";
import { isDayEndReading } from "@/lib/youtube/stat-day";
import { GrowXenoLoader } from "@/components/brand/grow-xeno-loader";

/**
 * An item's public YouTube stats (owner request, 2026-11-10): the latest
 * numbers, how much each has moved since the first reading, a Refresh button
 * anyone who can see the item may use, the full reading history, and — for
 * watch hours, which YouTube keeps private — a link to the channel's Studio
 * analytics.
 */

type StatKey = "subscribers" | "views" | "likes" | "comments";

const STAT_LABELS: Record<StatKey, string> = { subscribers: "Subscribers", views: "Views", likes: "Likes", comments: "Comments" };
const statLabel = (key: StatKey, kind: ItemStats["kind"]) => (key === "views" && kind === "CHANNEL" ? "Total views" : STAT_LABELS[key]);

const METRIC_STAT: Partial<Record<ServiceMetricType, StatKey>> = {
  SUBSCRIBERS: "subscribers",
  FOLLOWERS: "subscribers",
  VIEWS: "views",
  LIKES: "likes",
  COMMENTS: "comments",
};

const numberFormat = new Intl.NumberFormat("en-US");
const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
// History is one row per Pakistan day (2026-11-13), so it's shown in Pakistan time.
const pktDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" });
const pktTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" });

function ago(date: Date, now: number | null): string {
  if (now === null) return dateTime.format(date);
  const minutes = Math.round((date.getTime() - now) / 60_000);
  if (Math.abs(minutes) < 1) return "just now";
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}

function signed(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : "±"}${numberFormat.format(Math.abs(n))}`;
}

function triggerLabel(reading: ItemStatsReading): string {
  if (reading.trigger === "INITIAL") return "Starting point";
  if (reading.trigger === "SCHEDULED") return isDayEndReading(reading.takenAt) ? "End of day" : "Automatic";
  return reading.by ? `Refreshed by ${reading.by}` : "Refreshed";
}

/** Whether the stats block has anything (an error, or followed stats once read). */
export function hasStatsToShow(stats: ItemStats): boolean {
  return Boolean(stats.error) || (stats.readings.length > 0 && stats.tracked.length > 0);
}

/**
 * Re-reads the item's numbers from YouTube; sits beside the progress bar
 * (owner request, 2026-11-14). When it last read shows on hover.
 */
export function RefreshStatsButton({ itemId, fetchedAt }: { itemId: string; fetchedAt: Date | null }) {
  const router = useRouter();
  const now = useNowMinute();
  const [pending, startTransition] = useTransition();
  const refresh = () => {
    startTransition(async () => {
      const result = await refreshOrderItemStatsAction({ itemId });
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
      router.refresh();
    });
  };
  return (
    <button
      type="button"
      onClick={refresh}
      disabled={pending}
      title={fetchedAt ? `Updated ${ago(fetchedAt, now)}` : "Not read from YouTube yet"}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 shadow-[0_1px_1px_rgba(16,24,40,0.04)] hover:bg-zinc-50 disabled:opacity-60"
    >
      {pending ? <GrowXenoLoader size="xs" label="" /> : <RefreshCw aria-hidden="true" className="size-3.5" />}
      {pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}

export function ItemStatsPanel({
  stats,
  metricType,
}: {
  stats: ItemStats;
  metricType: ServiceMetricType | null;
}) {
  const [showHistory, setShowHistory] = useState(false);

  const readings = stats.readings;
  const first = readings[0] ?? null;
  const latest = readings.at(-1) ?? null;
  // Only what the service follows (2026-11-13); watch hours follow none.
  const keys: StatKey[] = stats.tracked;
  const primary = metricType ? METRIC_STAT[metricType] : undefined;
  // The progress stat already shows as Current above the panel (2026-11-15): the tiles show the others.
  const tiles = keys.filter((key) => key !== primary);
  if (!hasStatsToShow(stats)) return null;

  return (
    <div className="[&>*:first-child]:mt-0">
      {stats.error ? (
        <p role="status" className="mt-2.5 flex items-start gap-1.5 rounded-[8px] bg-amber-50 px-2.5 py-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-200/70">
          <AlertTriangle aria-hidden="true" className="mt-px size-3.5 shrink-0 text-amber-600" />
          {stats.error}
        </p>
      ) : null}

      {latest && tiles.length > 0 ? (
        <dl className={cn("mt-3 grid divide-x divide-zinc-200/80 rounded-[10px] bg-zinc-50 ring-1 ring-inset ring-zinc-200/70 max-sm:rounded-none max-sm:bg-transparent max-sm:ring-0 max-sm:[&>div:first-child]:pl-0", tiles.length >= 4 ? "grid-cols-2 sm:grid-cols-4" : tiles.length === 3 ? "grid-cols-3" : tiles.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
          {tiles.map((key) => {
            const value = latest[key];
            const start = first?.[key] ?? null;
            const change = value !== null && start !== null && readings.length > 1 ? value - start : null;
            return (
              <div key={key} className="min-w-0 px-3 py-2.5">
                <dt className={cn("truncate text-[11px] font-medium uppercase tracking-wide", key === primary ? "text-indigo-600" : "text-zinc-500")}>
                  {statLabel(key, stats.kind)}
                </dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums text-zinc-900">
                  {value !== null ? numberFormat.format(value) : <span className="text-[13px] font-normal text-zinc-400">Hidden</span>}
                </dd>
                {change !== null ? (
                  <dd className={cn("truncate text-xs tabular-nums", change > 0 ? "text-emerald-700" : change < 0 ? "text-red-600" : "text-zinc-500")}>
                    {signed(change)} since start
                  </dd>
                ) : null}
              </div>
            );
          })}
        </dl>
      ) : null}

      {readings.length > 0 && keys.length > 0 ? (
        <div className="mt-3">
          <button
            type="button"
            aria-expanded={showHistory}
            onClick={() => setShowHistory((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900"
          >
            <ChevronDown aria-hidden="true" className={cn("size-3.5 transition-transform", showHistory && "rotate-180")} />
            History · {readings.length} {readings.length === 1 ? "reading" : "readings"}
          </button>
          {showHistory ? (
            <div className="mt-2 overflow-x-auto rounded-[8px] bg-white ring-1 ring-inset ring-zinc-200/80">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead className="border-b border-zinc-100 text-[11px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Day (PKT)</th>
                    {keys.map((key) => (
                      <th key={key} scope="col" className="px-3 py-2 text-right font-medium">
                        {statLabel(key, stats.kind)}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-2 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {[...readings].reverse().map((reading) => (
                    <tr key={reading.id} className={reading.trigger === "INITIAL" ? "bg-indigo-50/40" : undefined}>
                      <td className="whitespace-nowrap px-3 py-1.5 text-zinc-600">
                        <span className="font-medium text-zinc-800">{pktDate.format(reading.takenAt)}</span>
                        <span className="ml-1.5 text-zinc-400">{isDayEndReading(reading.takenAt) ? "day end" : pktTime.format(reading.takenAt)}</span>
                      </td>
                      {keys.map((key) => {
                        const value = reading[key];
                        const start = first?.[key] ?? null;
                        const change = value !== null && start !== null && reading !== first ? value - start : null;
                        return (
                          <td key={key} className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-zinc-900">
                            {value !== null ? numberFormat.format(value) : "—"}
                            {change !== null && change !== 0 ? (
                              <span className={cn("ml-1", change > 0 ? "text-emerald-700" : "text-red-600")}>({signed(change)})</span>
                            ) : null}
                          </td>
                        );
                      })}
                      <td className="whitespace-nowrap px-3 py-1.5 text-zinc-500">{triggerLabel(reading)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
