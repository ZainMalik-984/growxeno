"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Small building blocks for the New Order form. Scoped to this page so the
 * app's shared, deliberately flat inputs (src/components/ui/input.tsx) keep
 * their look everywhere else.
 */

/** Field chrome shared by Input / Select / Textarea / CustomerPicker on this page. */
export const FIELD_CLASS = cn(
  "h-10 rounded-[8px] border-zinc-200 bg-white px-3 text-sm text-ink shadow-[0_1px_1px_rgba(16,24,40,0.03)]",
  "placeholder:text-zinc-400 hover:border-zinc-300",
  "focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10",
  "disabled:bg-zinc-50 aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-500/10",
);

/** Same as FIELD_CLASS but height follows the content (textareas). */
export const TEXTAREA_CLASS = cn(FIELD_CLASS, "h-auto min-h-20 resize-y py-2.5 leading-relaxed");

export function FormField({
  label,
  htmlFor,
  tag,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  /** Small text at the right of the label row: "Optional", or a requirement note. */
  tag?: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-zinc-800">
          {label}
        </label>
        {tag ? <span className="shrink-0 text-xs text-zinc-500">{tag}</span> : null}
      </div>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-zinc-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** "Optional" label tag. */
export function OptionalTag() {
  return <>Optional</>;
}

/**
 * Two-to-four option segmented control built on native radios, so keyboard
 * (arrow keys) and screen readers work without extra code.
 */
export function SegmentedControl<T extends string>({
  name,
  value,
  options,
  onChange,
  labelledBy,
}: {
  name: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; icon?: ReactNode }>;
  onChange: (value: T) => void;
  labelledBy: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="grid h-10 auto-cols-fr grid-flow-col gap-1 rounded-[9px] bg-zinc-100 p-1 ring-1 ring-inset ring-zinc-200/70"
    >
      {options.map((option) => (
        <label key={option.value} className="relative min-w-0">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span
            className={cn(
              "flex h-full cursor-pointer items-center justify-center gap-1.5 rounded-[6px] px-3 text-[13px] font-medium text-zinc-500 transition",
              "hover:text-zinc-800",
              "peer-checked:bg-white peer-checked:text-zinc-900 peer-checked:shadow-[0_1px_2px_rgba(16,24,40,0.08),0_0_0_1px_rgba(16,24,40,0.04)]",
              "peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500/40",
            )}
          >
            {option.icon}
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}

/** Light inset panel that visually attaches conditional fields to the control that revealed them. */
export function InsetPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "animate-fade-up rounded-[10px] border border-zinc-200/80 bg-zinc-50/80 p-4 [animation-duration:220ms] motion-reduce:animate-none",
        "relative before:absolute before:-top-px before:left-4 before:h-px before:w-10 before:bg-indigo-400/60",
        // Phones: no box inside the section (2026-11-12).
        "max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:before:hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Summary row in the side panel. */
export function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-[13px]">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-zinc-900">{children}</dd>
    </div>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <span className="font-normal text-zinc-500">{children}</span>;
}
