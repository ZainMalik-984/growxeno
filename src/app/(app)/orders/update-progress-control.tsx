"use client";

import { Loader2, PencilLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateOrderItemProgressAction } from "@/lib/orders/actions";
import { cn } from "@/lib/utils";

/**
 * Lets the assigned worker record where their task stands now (owner request,
 * 2026-11-11: "the update button should be there as well, so the worker can
 * change the data according to what he has done"). Same action and rules as
 * Update on the order page: the worker's own item only.
 */
export function UpdateProgressControl({
  itemId,
  currentCount,
  targetCount,
  metricLabel,
  className,
}: {
  itemId: string;
  currentCount: number | null;
  targetCount: number | null;
  metricLabel: string;
  className?: string;
}) {
  const router = useRouter();
  const inputId = useId();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    setValue(String(currentCount ?? 0));
    setError(null);
    setEditing(true);
  };

  const save = () => {
    const cleaned = value.replace(/[,\s]/g, "");
    if (!/^\d+$/.test(cleaned)) {
      setError("Enter a whole number.");
      return;
    }
    startTransition(async () => {
      const result = await updateOrderItemProgressAction({ itemId, currentCount: Number(cleaned) });
      if (result.ok) {
        toast.success("Progress updated.");
        setEditing(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={open}
        className={cn("inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline", className)}
      >
        <PencilLine aria-hidden="true" className="size-3.5" />
        Update
      </button>
    );
  }

  return (
    <form
      className={cn("mt-1.5", className)}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        Current {metricLabel}
      </label>
      <div className="flex items-center gap-1.5">
        <Input
          id={inputId}
          inputMode="numeric"
          autoFocus
          value={value}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditing(false);
          }}
          className="h-8 w-28 rounded-[6px] px-2 text-[13px] tabular-nums"
        />
        <span className="whitespace-nowrap text-xs text-zinc-500">
          / {(targetCount ?? 0).toLocaleString("en-US")} {metricLabel}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <Button type="submit" variant="accent" size="sm" className="h-7 rounded-[6px] px-2.5" disabled={pending}>
          {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditing(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </form>
  );
}
