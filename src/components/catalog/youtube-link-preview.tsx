"use client";

import { AlertTriangle, BarChart3, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SiYoutube } from "react-icons/si";

import { platformOf } from "@/lib/services/link-field";
import type { ServiceMetricType } from "@/lib/services/metric-type";
import { cn } from "@/lib/utils";
import { lookupYoutubeLinkAction, type YoutubePreviewResult } from "@/lib/youtube/actions";
import { kindMismatch, metricValueFrom, parseYoutubeLink } from "@/lib/youtube/link";

/**
 * Live look-up of a YouTube link while an item is being filled in (owner
 * request, 2026-11-10): "when I enter a YouTube channel link, it should get
 * the channel ID and subscribers; for a video, the current views, likes and
 * comments." Shows what the link points at and its public numbers, fills the
 * current-count field when it is still empty, and for watch hours links the
 * channel's YouTube Studio analytics. Renders nothing for other platforms.
 */

const numberFormat = new Intl.NumberFormat("en-US");
const DEBOUNCE_MS = 600;

export function YoutubeLinkPreview({
  url,
  serviceId,
  metricType,
  categoryName,
  currentValue,
  onUseValue,
}: {
  url: string;
  serviceId: string;
  metricType: ServiceMetricType | null;
  categoryName: string | null | undefined;
  /** The form's current-count field, so an empty one can be filled in. */
  currentValue: string;
  onUseValue: (value: number) => void;
}) {
  const isYoutube = platformOf(categoryName) === "youtube";
  const trimmed = url.trim();

  const local = useMemo(() => {
    if (!isYoutube || !trimmed) return null;
    const parsed = parseYoutubeLink(trimmed);
    if (!parsed.ok) return { error: parsed.error };
    const mismatch = kindMismatch(metricType, parsed.target);
    return mismatch ? { error: mismatch } : { error: null };
  }, [isYoutube, trimmed, metricType]);

  // What to look up; null when there is nothing valid to ask about.
  const key = local && local.error === null ? JSON.stringify([serviceId, trimmed]) : null;
  const [result, setResult] = useState<{ key: string; value: YoutubePreviewResult } | null>(null);

  // Latest callbacks for the async result (never read during render).
  const latest = useRef({ currentValue, onUseValue, metricType });
  useEffect(() => {
    latest.current = { currentValue, onUseValue, metricType };
  });

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const [sid, link] = JSON.parse(key) as [string, string];
    const timer = setTimeout(async () => {
      const value = await lookupYoutubeLinkAction({ url: link, serviceId: sid || undefined }).catch(
        (): YoutubePreviewResult => ({ ok: false, error: "Couldn't look up that link." }),
      );
      if (cancelled) return;
      setResult({ key, value });
      if (value.ok) {
        const { currentValue: current, onUseValue: use, metricType: metric } = latest.current;
        const reading = metricValueFrom(value.data, metric);
        if (reading !== null && current.trim() === "") use(reading);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key]);

  if (!local) return null;
  if (local.error) {
    return (
      <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800">
        <AlertTriangle aria-hidden="true" className="mt-px size-3.5 shrink-0 text-amber-600" />
        {local.error}
      </p>
    );
  }

  const current = result && result.key === key ? result.value : null;
  if (!current) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500" role="status">
        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
        Looking up on YouTube…
      </p>
    );
  }
  if (!current.ok) {
    return (
      <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800" role="status">
        <AlertTriangle aria-hidden="true" className="mt-px size-3.5 shrink-0 text-amber-600" />
        {current.error}
      </p>
    );
  }

  const d = current.data;
  const reading = metricValueFrom(d, metricType);
  const stats: { label: string; value: number | null }[] =
    d.kind === "CHANNEL"
      ? [
          { label: "Subscribers", value: d.subscribers },
          { label: "Total views", value: d.views },
        ]
      : [
          { label: "Views", value: d.views },
          { label: "Likes", value: d.likes },
          { label: "Comments", value: d.comments },
        ];

  return (
    <div className="mt-2 rounded-[10px] border border-zinc-200/80 bg-zinc-50/70 p-3" role="status">
      <div className="flex items-start gap-2">
        <SiYoutube aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#FF0000]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-zinc-900">{d.title}</p>
          <p className="truncate text-xs text-zinc-500">
            {d.kind === "CHANNEL" ? "Channel ID" : `Video on ${d.channelTitle || "YouTube"} · ID`}{" "}
            <code className="font-mono text-[11px] text-zinc-700">{d.id}</code>
          </p>
        </div>
      </div>
      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
        {stats.map((s) => (
          <div key={s.label} className="flex items-baseline gap-1.5">
            <dt className="text-zinc-500">{s.label}</dt>
            <dd className="font-semibold tabular-nums text-zinc-900">{s.value !== null ? numberFormat.format(s.value) : "Hidden"}</dd>
          </div>
        ))}
      </dl>
      {reading !== null && currentValue.trim() !== String(reading) ? (
        <button
          type="button"
          onClick={() => onUseValue(reading)}
          className={cn("mt-2 text-xs font-medium text-indigo-600 hover:underline")}
        >
          Use {numberFormat.format(reading)} as the current count
        </button>
      ) : null}
      {metricType === "WATCH_HOURS" && d.channelId ? (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-zinc-600">
          <BarChart3 aria-hidden="true" className="size-3.5 text-zinc-400" />
          Watch hours are private.
          <a
            href={d.studioUrl ?? undefined}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline"
          >
            Studio analytics
            <ExternalLink aria-hidden="true" className="size-3" />
          </a>
        </p>
      ) : null}
    </div>
  );
}
