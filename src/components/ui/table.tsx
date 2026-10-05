import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Table primitives.
 *
 * Wide, borderless, editorial. A single hairline under each row; no grid boxes,
 * no zebra striping, no outer border. Wide content scrolls inside its own
 * container so the page body never scrolls horizontally.
 */

export function TableWrap({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-full overflow-x-auto", className)} {...props} />;
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("tabular w-full min-w-full border-collapse text-left text-[13px]", className)}
      {...props}
    />
  );
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("", className)} {...props} />;
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("", className)} {...props} />;
}

export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("border-b border-line-soft last:border-0", className)}
      {...props}
    />
  );
}

export function TH({ className, scope = "col", ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope={scope}
      className={cn(
        "border-b border-line px-3 py-2 text-left text-[11px] font-medium",
        "uppercase tracking-[0.06em] text-ink-faint",
        "first:pl-0 last:pr-0",
        className,
      )}
      {...props}
    />
  );
}

export function TD({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("px-3 py-2.5 align-middle text-ink first:pl-0 last:pr-0", className)}
      {...props}
    />
  );
}
