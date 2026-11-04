import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Elevated card container — owner-directed, 2026-10-14: "the design is too
 * flat", asking for real depth (border + shadow + colour) on the order
 * creation and order detail pages specifically, not a change to the rest of
 * the app's deliberately flat `docs/DESIGN_SYSTEM.md` language. Scoped to
 * wherever it's actually imported, not a global style change.
 */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-[12px] border border-zinc-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-14px_rgba(16,24,40,0.12)] sm:p-7", className)}>
      {children}
    </div>
  );
}

const ICON_TONE: Record<"indigo" | "emerald" | "amber", string> = {
  indigo: "bg-indigo-50 text-indigo-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
};

export function CardHeader({
  icon: Icon,
  title,
  description,
  actions,
  tone = "indigo",
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  tone?: "indigo" | "emerald" | "amber";
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-[8px]", ICON_TONE[tone])}>
            <Icon aria-hidden="true" className="size-[18px]" />
          </div>
        ) : null}
        <div>
          <h2 className="text-[15px] font-semibold text-zinc-900">{title}</h2>
          {description ? <p className="mt-0.5 text-[13px] text-zinc-500">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
