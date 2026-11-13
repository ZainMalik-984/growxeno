"use client";

import { AlertTriangle, BarChart3, Check, ChevronDown, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SiYoutube } from "react-icons/si";
import { toast } from "sonner";

import { useNowMinute } from "@/components/ui/deadline";
import { safeExternalHref } from "@/lib/orders/url-normalize";
import type { ItemStats, ItemStatsReading } from "@/lib/orders/queries";
import type { ServiceMetricType } from "@/lib/services/metric-type";
import { cn } from "@/lib/utils";
import { refreshOrderItemStatsAction } from "@/lib/youtube/actions";
import { studioAnalyticsUrl } from "@/lib/youtube/link";

/**
 * An item's public YouTube stats (owner request, 2026-11-10): the latest
 * numbers, how much each has moved since the first reading, a Refresh button
 * anyone who can see the item may use, the full reading history, and — for
 * watch hours, which YouTube keeps private — a link to the channel's Studio
 * analytics.
 */

type StatKey = "subscribers" | "views" | "likes" | "comments";

const STAT_LABELS: Record<StatKey, string> = { subscribers: "Subscribers", views: "Views", likes: "Likes", comments: "Comments" };

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
  if (reading.trigger === "SCHEDULED") return "Automatic";
  return reading.by ? `Refreshed by ${reading.by}` : "Refreshed";
}

export function ItemStatsPanel({
  itemId,
  stats,
  metricType,
  link,
}: {
  itemId: string;
  stats: ItemStats;
  metricType: ServiceMetricType | null;
  link: string | null;
}) {
  const router = useRouter();
  const now = useNowMinute();
  const [pending, startTransition] = useTransition();
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);

  const readings = stats.readings;
  const first = readings[0] ?? null;
  const latest = readings.at(-1) ?? null;
  const keys: StatKey[] = stats.kind === "VIDEO" ? ["views", "likes", "comments"] : ["subscribers", "views"];
  const primary = metricType ? METRIC_STAT[metricType] : undefined;
  const isChannel = stats.kind === "CHANNEL";
  const studio = isChannel && stats.sourceId ? studioAnalyticsUrl(stats.sourceId) : null;

  const refresh = () => {
    startTransition(async () => {
      const result = await refreshOrderItemStatsAction({ itemId });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
        router.refresh();
      }
    });
  };

  const copyId = async () => {
    if (!stats.sourceId) return;
    try {
      await navigator.clipboard.writeText(stats.sourceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy.");
    }
  };

  return (
    <div>
      <div className="flex items-start gap-3">
        <SiYoutube aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#FF0000]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-zinc-900">
            {stats.title ? (
              <a href={safeExternalHref(link ?? "") ?? undefined} target="_blank" rel="noreferrer noopener" className="hover:underline">
                {stats.title}
              </a>
            ) : (
              "YouTube stats"
            )}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
            {stats.sourceId ? (
              <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                <span className="shrink-0">{isChannel ? "Channel ID" : "Video ID"}</span>
                <code className="truncate rounded bg-zinc-100 px-1 font-mono text-[11px] text-zinc-700">{stats.sourceId}</code>
                <button type="button" onClick={copyId} aria-label={`Copy ${isChannel ? "channel" : "video"} ID`} className="text-zinc-400 hover:text-zinc-700">
                  {copied ? <Check aria-hidden="true" className="size-3.5 text-emerald-600" /> : <Copy aria-hidden="true" className="size-3.5" />}
                </button>
              </span>
            ) : null}
            <span>{stats.fetchedAt ? `Updated ${ago(stats.fetchedAt, now)}` : "Not read yet"}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={pending}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 shadow-[0_1px_1px_rgba(16,24,40,0.04)] hover:bg-zinc-50 disabled:opacity-60"
        >
          <RefreshCw aria-hidden="true" className={cn("size-3.5", pending && "animate-spin")} />
          {pending ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {stats.error ? (
        <p role="status" className="mt-2.5 flex items-start gap-1.5 rounded-[8px] bg-amber-50 px-2.5 py-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-200/70">
          <AlertTriangle aria-hidden="true" className="mt-px size-3.5 shrink-0 text-amber-600" />
          {stats.error}
        </p>
      ) : null}

      {latest ? (
        <dl className={cn("mt-3 grid divide-x divide-zinc-200/80 rounded-[10px] bg-zinc-50 ring-1 ring-inset ring-zinc-200/70 max-sm:rounded-none max-sm:bg-transparent max-sm:ring-0 max-sm:[&>div:first-child]:pl-0", keys.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
          {keys.map((key) => {
            const value = latest[key];
            const start = first?.[key] ?? null;
            const change = value !== null && start !== null && readings.length > 1 ? value - start : null;
            return (
              <div key={key} className="min-w-0 px-3 py-2.5">
                <dt className={cn("truncate text-[11px] font-medium uppercase tracking-wide", key === primary ? "text-indigo-600" : "text-zinc-500")}>
                  {STAT_LABELS[key]}
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

      {metricType === "WATCH_HOURS" ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-600">
          <BarChart3 aria-hidden="true" className="size-3.5 text-zinc-400" />
          Watch hours are private to the channel owner.
          {studio ? (
            <a href={studio} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline">
              Open Studio analytics
              <ExternalLink aria-hidden="true" className="size-3" />
            </a>
          ) : (
            <span className="text-zinc-400">The Studio link appears once the channel has been read.</span>
          )}
        </p>
      ) : null}

      {readings.length > 0 ? (
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
                    <th scope="col" className="px-3 py-2 font-medium">When</th>
                    {keys.map((key) => (
                      <th key={key} scope="col" className="px-3 py-2 text-right font-medium">
                        {STAT_LABELS[key]}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-2 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {[...readings].reverse().map((reading) => (
                    <tr key={reading.id} className={reading.trigger === "INITIAL" ? "bg-indigo-50/40" : undefined}>
                      <td className="whitespace-nowrap px-3 py-1.5 text-zinc-600">{dateTime.format(reading.takenAt)}</td>
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
