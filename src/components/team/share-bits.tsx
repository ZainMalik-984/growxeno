"use client";

import { MessageCircle } from "lucide-react";

import { whatsappUrl } from "@/lib/orders/assignment-message";
import type { TeamShareStatus } from "@/lib/team/rules";
import { cn } from "@/lib/utils";

/**
 * Small shared pieces for an outsourced worker's team popups (2026-11-17):
 * the two-state pill and the WhatsApp link. Used by My team and the Orders
 * page's Team popup.
 */

export function ShareStatusPill({ status }: { status: TeamShareStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "DONE" ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700",
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", status === "DONE" ? "bg-emerald-500" : "bg-indigo-500")} />
      {status === "DONE" ? "Done" : "Processing"}
    </span>
  );
}

/** A WhatsApp chat with the number (and a message, when given); nothing when there's no number. */
export function WhatsAppLink({ number, text = "", label, className, children }: { number: string | null; text?: string; label: string; className?: string; children?: React.ReactNode }) {
  const href = whatsappUrl(number, text);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-[8px] text-emerald-700 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20",
        children ? "h-8 px-2.5 text-xs font-medium" : "size-8",
        className,
      )}
    >
      <MessageCircle aria-hidden className="size-4" />
      {children}
    </a>
  );
}
