"use client";

import { BadgePercent, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveFiverrFeeSettingsAction } from "@/lib/settings/actions";
import { fiverrFeeSettingsSchema, type FiverrFeeSettings } from "@/lib/settings/fiverr-fee";
import { cn } from "@/lib/utils";
import { SaveBar, useUnsavedWarning } from "./settings-ui";

/** The Fiverr fee (2026-11-04): taken off Fiverr orders before employee commission. */
export function FiverrFeeForm({ initial, canEdit }: { initial: FiverrFeeSettings; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(String(initial.percent));
  const [error, setError] = useState<string | undefined>();

  const parsed = fiverrFeeSettingsSchema.safeParse({ percent: value.trim() === "" ? undefined : value });
  const percent = parsed.success ? parsed.data.percent : null;
  const dirty = value.trim() !== String(initial.percent);
  useUnsavedWarning(dirty);

  const save = () => {
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a percentage.");
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await saveFiverrFeeSettingsAction(parsed.data);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const example = 100;
  const kept = percent !== null ? example * (1 - percent / 100) : null;

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader icon={BadgePercent} tone="emerald" title="Fee per order" description="A percentage of the order price." />

      <fieldset disabled={!canEdit || pending} className="space-y-5">
        <div>
          <label htmlFor="fiverr-fee" className="text-[13px] font-medium text-zinc-900">
            Fiverr fee
          </label>
          <div className="relative mt-1.5 w-36">
            <Input
              id="fiverr-fee"
              inputMode="decimal"
              className="h-10 rounded-[8px] pr-8 tabular-nums"
              value={value}
              aria-invalid={error ? true : undefined}
              onChange={(event) => {
                setValue(event.target.value);
                setError(undefined);
              }}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-zinc-500">%</span>
          </div>
          {error ? (
            <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
              {error}
            </p>
          ) : null}
        </div>

        <div className="rounded-[10px] bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200/70">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Example</p>
          <dl className={cn("mt-2 grid grid-cols-3 gap-3 text-[13px]", kept === null && "opacity-50")}>
            <div>
              <dt className="text-zinc-500">Fiverr order</dt>
              <dd className="font-semibold tabular-nums text-zinc-900">{example.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">After the fee</dt>
              <dd className="font-semibold tabular-nums text-zinc-900">{kept !== null ? kept.toFixed(2) : "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">10% commission</dt>
              <dd className="font-semibold tabular-nums text-emerald-700">{kept !== null ? (kept * 0.1).toFixed(2) : "—"}</dd>
            </div>
          </dl>
        </div>

        <p className="flex items-start gap-2 rounded-[8px] bg-indigo-50/60 px-3 py-2.5 text-xs text-indigo-900 ring-1 ring-inset ring-indigo-200/60">
          <Info aria-hidden="true" className="mt-px size-3.5 shrink-0 text-indigo-600" />
          External orders don&apos;t go through Fiverr, so commission on them uses the full price. Changing the fee updates
          every commission figure straight away.
        </p>
      </fieldset>

      {/* Errors show under the field itself, so the bar only carries the actions. */}
      <SaveBar
        dirty={dirty}
        pending={pending}
        canEdit={canEdit}
        onSave={save}
        onDiscard={() => {
          setValue(String(initial.percent));
          setError(undefined);
        }}
      />
    </Card>
  );
}
