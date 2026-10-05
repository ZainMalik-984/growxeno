"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A titled band of content the person opts into seeing, closed by default.
 *
 * Used where a page has one thing that matters most (an order's items, say)
 * and other real but secondary information (financial summaries, expenses)
 * that does not need to compete with it for space on every visit — confirmed
 * directly, 2026-09-28: "summary financials and expenses should be hidden
 * under a dropdown toggle shown only when selected."
 */
export function Disclosure({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-line pt-4">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="section-title">{title}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 shrink-0 text-ink-faint transition-transform", open && "rotate-180")}
        />
      </button>
      {description ? <p className="mt-1 text-[13px] text-ink-muted">{description}</p> : null}
      {open ? <div className="mt-4 space-y-8">{children}</div> : null}
    </div>
  );
}
