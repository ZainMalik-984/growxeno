"use client";

import { CheckCircle2, Info, KeyRound, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { saveYoutubeStatsSettingsAction } from "@/lib/settings/actions";
import { formatInterval, YOUTUBE_STATS_INTERVAL_OPTIONS, type YoutubeStatsSettings } from "@/lib/settings/youtube-stats";
import { cn } from "@/lib/utils";
import { SaveBar, useUnsavedWarning } from "./settings-ui";

/** How often YouTube stats refresh by themselves (2026-11-10). */
export function YoutubeStatsForm({
  initial,
  canEdit,
  apiKeyConfigured,
}: {
  initial: YoutubeStatsSettings;
  canEdit: boolean;
  apiKeyConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [hours, setHours] = useState(initial.intervalHours);
  const dirty = enabled !== initial.enabled || hours !== initial.intervalHours;
  useUnsavedWarning(dirty);

  const options: number[] = [...YOUTUBE_STATS_INTERVAL_OPTIONS];
  if (!options.includes(hours)) options.push(hours);
  options.sort((a, b) => a - b);

  const save = () => {
    startTransition(async () => {
      const result = await saveYoutubeStatsSettingsAction({ enabled, intervalHours: hours });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "flex items-start gap-2.5 rounded-[10px] px-4 py-3 text-[13px] ring-1 ring-inset",
          apiKeyConfigured ? "bg-emerald-50/70 text-emerald-900 ring-emerald-200/70" : "bg-amber-50 text-amber-900 ring-amber-200/70",
        )}
      >
        {apiKeyConfigured ? (
          <CheckCircle2 aria-hidden="true" className="mt-px size-4 shrink-0 text-emerald-600" />
        ) : (
          <KeyRound aria-hidden="true" className="mt-px size-4 shrink-0 text-amber-600" />
        )}
        <p>
          {apiKeyConfigured ? (
            "Connected to the YouTube Data API."
          ) : (
            <>
              Not connected yet. Add <code className="font-mono text-xs">YOUTUBE_API_KEY</code> to the server&apos;s environment
              (a Google Cloud API key with the YouTube Data API v3 enabled) and restart the app.
            </>
          )}
        </p>
      </div>

      <Card className="p-5 sm:p-6">
        <CardHeader icon={RefreshCw} tone="indigo" title="Automatic refresh" description="For YouTube items on open orders." />

        <fieldset disabled={!canEdit || pending} className="space-y-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            <span>
              <span className="block text-[13px] font-medium text-zinc-900">Refresh stats automatically</span>
              <span className="block text-xs text-zinc-500">When off, stats change only when someone presses Refresh on an item.</span>
            </span>
          </label>

          <div>
            <label htmlFor="youtube-interval" className="text-[13px] font-medium text-zinc-900">
              Refresh every
            </label>
            <Select
              id="youtube-interval"
              className="mt-1.5 h-10 w-48 rounded-[8px]"
              value={hours}
              disabled={!enabled}
              onChange={(event) => setHours(Number(event.target.value))}
            >
              {options.map((h) => (
                <option key={h} value={h}>
                  {formatInterval(h)}
                </option>
              ))}
            </Select>
          </div>

          <p className="flex items-start gap-2 rounded-[8px] bg-indigo-50/60 px-3 py-2.5 text-xs text-indigo-900 ring-1 ring-inset ring-indigo-200/60">
            <Info aria-hidden="true" className="mt-px size-3.5 shrink-0 text-indigo-600" />
            <span>
              Each refresh is saved in the item&apos;s history, so you can see how the numbers moved since the first reading.
              Items on finalized or cancelled orders, and cancelled items, are no longer refreshed. Anyone who can see an
              item can refresh it by hand at any time.
            </span>
          </p>
        </fieldset>

        <SaveBar
          dirty={dirty}
          pending={pending}
          canEdit={canEdit}
          onSave={save}
          onDiscard={() => {
            setEnabled(initial.enabled);
            setHours(initial.intervalHours);
          }}
        />
      </Card>
    </div>
  );
}
