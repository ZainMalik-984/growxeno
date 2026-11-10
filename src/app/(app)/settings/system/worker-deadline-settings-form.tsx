"use client";

import { ArrowRight, Info, Plus, Timer, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SaveBar, useUnsavedWarning } from "./settings-ui";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveWorkerDeadlineSettingsAction } from "@/lib/settings/actions";
import {
  computeWorkerDeadline,
  workerDeadlineSettingsSchema,
  type WorkerDeadlineSettings,
} from "@/lib/settings/worker-deadline";
import { cn } from "@/lib/utils";

type DraftTier = { key: number; minLeadDays: string; bufferDays: string };

const NUMBER_FIELD =
  "h-9 w-20 rounded-[8px] text-center tabular-nums focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 aria-[invalid=true]:border-red-400";

/** Example order lengths for the live preview. */
const PREVIEW_DAYS = [2, 7, 15, 30, 60];
const DAY = 24 * 60 * 60 * 1000;

const dayLabel = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

function formatSpan(ms: number): string {
  const totalHours = Math.round(ms / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days === 0) return `${hours}h`;
  return hours === 0 ? dayLabel(days) : `${days}d ${hours}h`;
}

export function WorkerDeadlineSettingsForm({
  initial,
  canEdit,
}: {
  initial: WorkerDeadlineSettings;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nextKey, setNextKey] = useState(initial.tiers.length);
  const [defaultDays, setDefaultDays] = useState(String(initial.defaultDays));
  const [tiers, setTiers] = useState<DraftTier[]>(() =>
    initial.tiers.map((t, i) => ({ key: i, minLeadDays: String(t.minLeadDays), bufferDays: String(t.bufferDays) })),
  );
  const [error, setError] = useState<string | undefined>();

  const parsed = useMemo(
    () =>
      workerDeadlineSettingsSchema.safeParse({
        defaultDays,
        tiers: tiers.map((t) => ({ minLeadDays: t.minLeadDays, bufferDays: t.bufferDays })),
      }),
    [defaultDays, tiers],
  );
  const valid = parsed.success ? parsed.data : null;
  const dirty =
    defaultDays !== String(initial.defaultDays) ||
    JSON.stringify(tiers.map((t) => [t.minLeadDays, t.bufferDays])) !==
      JSON.stringify(initial.tiers.map((t) => [String(t.minLeadDays), String(t.bufferDays)]));

  useUnsavedWarning(dirty);

  const updateTier = (key: number, patch: Partial<DraftTier>) =>
    setTiers((current) => current.map((t) => (t.key === key ? { ...t, ...patch } : t)));

  const addTier = () => {
    setTiers((current) => [...current, { key: nextKey, minLeadDays: "", bufferDays: "" }]);
    setNextKey((k) => k + 1);
  };

  const save = () => {
    if (!valid) {
      setError(parsed.error?.issues[0]?.message ?? "Check the values.");
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await saveWorkerDeadlineSettingsAction(valid);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const reset = () => {
    setDefaultDays(String(initial.defaultDays));
    setTiers(initial.tiers.map((t, i) => ({ key: nextKey + i, minLeadDays: String(t.minLeadDays), bufferDays: String(t.bufferDays) })));
    setNextKey((k) => k + initial.tiers.length);
    setError(undefined);
  };

  const invalidNumber = (value: string, min: number) => value.trim() === "" || !/^\d+$/.test(value.trim()) || Number(value) < min;

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="p-5 sm:p-6">
        <CardHeader icon={Timer} tone="indigo" title="Gap rules" description="Pick the default, then add rules for longer orders." />

        <fieldset disabled={!canEdit || pending} className="space-y-6">
          {/* Default gap */}
          <div className="rounded-[10px] border border-zinc-200/80 bg-zinc-50/70 p-4">
            <p className="text-[13px] font-medium text-zinc-900">Default</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-zinc-600">
              <span>Worker deadline is</span>
              <Input
                aria-label="Default days early"
                inputMode="numeric"
                className={NUMBER_FIELD}
                value={defaultDays}
                aria-invalid={invalidNumber(defaultDays, 0) || undefined}
                onChange={(event) => setDefaultDays(event.target.value)}
              />
              <span>days before the order deadline.</span>
            </div>
            <p className="mt-2 text-xs text-zinc-500">Used when no rule below matches.</p>
          </div>

          {/* Tiers */}
          <div>
            <div className="mb-2 flex items-end justify-between gap-3">
              <div>
                <p className="text-[13px] font-medium text-zinc-900">Rules for longer orders</p>
                <p className="text-xs text-zinc-500">
                  Counted from when the order is created to its deadline. The rule with the most days that fits wins.
                </p>
              </div>
            </div>

            {tiers.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-zinc-200 px-4 py-3 text-[13px] text-zinc-500">
                No rules. Every order uses the default.
              </p>
            ) : (
              <ul className="space-y-2">
                {tiers.map((tier) => (
                  <li
                    key={tier.key}
                    className="flex flex-wrap items-center gap-2 rounded-[10px] border border-zinc-200/80 bg-white px-3 py-2.5 text-[13px] text-zinc-600 shadow-[0_1px_1px_rgba(16,24,40,0.03)]"
                  >
                    <span>If the order has at least</span>
                    <Input
                      aria-label="Minimum days until the order deadline"
                      inputMode="numeric"
                      className={NUMBER_FIELD}
                      value={tier.minLeadDays}
                      aria-invalid={invalidNumber(tier.minLeadDays, 1) || undefined}
                      onChange={(event) => updateTier(tier.key, { minLeadDays: event.target.value })}
                    />
                    <span>days</span>
                    <ArrowRight aria-hidden="true" className="size-3.5 text-zinc-400" />
                    <Input
                      aria-label="Days early for the worker"
                      inputMode="numeric"
                      className={NUMBER_FIELD}
                      value={tier.bufferDays}
                      aria-invalid={invalidNumber(tier.bufferDays, 0) || undefined}
                      onChange={(event) => updateTier(tier.key, { bufferDays: event.target.value })}
                    />
                    <span>days early</span>
                    {canEdit ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto rounded-[6px] text-zinc-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove rule"
                        onClick={() => setTiers((current) => current.filter((t) => t.key !== tier.key))}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {canEdit ? (
              <button
                type="button"
                onClick={addTier}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-zinc-300 px-3 py-2 text-[13px] font-medium text-zinc-600 transition hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700"
              >
                <Plus aria-hidden="true" className="size-4" />
                Add rule
              </button>
            ) : null}
          </div>

          <p className="flex items-start gap-2 rounded-[8px] bg-indigo-50/60 px-3 py-2.5 text-xs text-indigo-900 ring-1 ring-inset ring-indigo-200/60">
            <Info aria-hidden="true" className="mt-px size-3.5 shrink-0 text-indigo-600" />
            Saving updates every open order straight away. Item deadlines someone set by hand keep their date. A worker
            deadline is never moved earlier than halfway through the order.
          </p>

        </fieldset>

        <SaveBar dirty={dirty} pending={pending} error={error} canEdit={canEdit} onSave={save} onDiscard={reset} saveDisabled={!valid} />
      </Card>

      {/* Live preview */}
      <Card className="p-5 sm:p-6 xl:sticky xl:top-20">
        <h2 className="text-[15px] font-semibold text-zinc-900">Preview</h2>
        <p className="mt-0.5 text-xs text-zinc-500">What a worker sees for orders of different lengths.</p>
        <table className="mt-4 w-full text-[13px]">
          <thead>
            <tr className="text-left text-xs text-zinc-500">
              <th className="pb-2 font-medium">Order due in</th>
              <th className="pb-2 text-right font-medium">Worker due in</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {PREVIEW_DAYS.map((days) => {
              const created = new Date(0);
              const deadline = new Date(days * DAY);
              const worker = valid ? computeWorkerDeadline(deadline, created, valid) : null;
              const early = worker ? deadline.getTime() - worker.getTime() : 0;
              return (
                <tr key={days}>
                  <td className="py-2 tabular-nums text-zinc-700">{dayLabel(days)}</td>
                  <td className={cn("py-2 text-right tabular-nums", valid ? "font-medium text-zinc-900" : "text-zinc-400")}>
                    {worker ? (
                      <>
                        {formatSpan(worker.getTime())}
                        <span className="ml-1.5 text-xs font-normal text-emerald-700">−{formatSpan(early)}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
