import type { InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Form primitives.
 *
 * Inputs are razor-thin bordered with a strong, non-glowing focus state. No
 * rounded card wrapper, no floating label, no decorative icon well.
 */

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-8 w-full rounded-[3px] border border-line bg-canvas px-2.5 text-[13px] text-ink",
        "transition-colors placeholder:text-ink-faint",
        "hover:border-zinc-300",
        "focus:border-zinc-900 focus:outline-none focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:bg-canvas-subtle disabled:text-ink-faint",
        "aria-[invalid=true]:border-red-500",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Same visual weight as `Input`, for a closed set of choices — a currency
 * code, say, where free text let a typo through un-caught (`"USD "`, `"usd"`,
 * `"UDS"`) all the way to a stored row.
 */
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-8 w-full rounded-[3px] border border-line bg-canvas px-2.5 text-[13px] text-ink",
        "transition-colors",
        "hover:border-zinc-300",
        "focus:border-zinc-900 focus:outline-none focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:bg-canvas-subtle disabled:text-ink-faint",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-[3px] border border-line bg-canvas px-2.5 py-2 text-[13px] text-ink",
        "transition-colors placeholder:text-ink-faint",
        "hover:border-zinc-300",
        "focus:border-zinc-900 focus:outline-none focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:bg-canvas-subtle disabled:text-ink-faint",
        "aria-[invalid=true]:border-red-500",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-[13px] font-medium text-ink", className)}
      {...props}
    />
  );
}

/** Field wrapper: label, control, optional hint and error, in a consistent rhythm. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
