"use client";

import { CircleAlert, Loader2 } from "lucide-react";
import { type ReactNode, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared pieces for every Settings section (2026-11-04 redesign), so each
 * setting saves the same way: edit freely, then a sticky bar offers Discard /
 * Save changes while there is something unsaved.
 */

/** Warns before leaving the page (reload, close tab, typed URL) with unsaved edits. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}

export function SaveBar({
  dirty,
  pending,
  error,
  onSave,
  onDiscard,
  canEdit,
  saveDisabled = false,
}: {
  dirty: boolean;
  pending: boolean;
  error?: string;
  onSave: () => void;
  onDiscard: () => void;
  canEdit: boolean;
  /** e.g. while a field is invalid. */
  saveDisabled?: boolean;
}) {
  if (!canEdit) {
    return <p className="mt-4 text-xs text-zinc-500">You can view these settings but not change them.</p>;
  }
  if (!dirty && !error) return null;
  return (
    <div className="sticky bottom-3 z-20 mt-5">
      <div
        role="region"
        aria-label="Unsaved changes"
        className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-zinc-200/80 bg-white/95 px-4 py-3 shadow-[0_10px_30px_-10px_rgba(16,24,40,0.25)] backdrop-blur"
      >
        <p className={cn("flex items-center gap-2 text-[13px]", error ? "text-red-700" : "text-zinc-700")}>
          {error ? (
            <>
              <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
              <span role="alert">{error}</span>
            </>
          ) : (
            <>
              <span aria-hidden="true" className="size-2 rounded-full bg-amber-500" />
              You have unsaved changes.
            </>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="rounded-[8px]" onClick={onDiscard} disabled={pending}>
            Discard
          </Button>
          <Button variant="accent" className="rounded-[8px]" onClick={onSave} disabled={pending || saveDisabled || !dirty}>
            {pending ? (
              <>
                <Loader2 aria-hidden="true" className="animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** A titled block inside a section's card. */
export function SettingsGroup({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[12px] border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6", className)}>
      <h3 className="text-[14px] font-semibold text-zinc-900">{title}</h3>
      {description ? <p className="mt-0.5 text-[13px] text-zinc-500">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}
