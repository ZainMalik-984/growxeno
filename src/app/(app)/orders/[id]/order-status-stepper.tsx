import { Check, CircleSlash, Zap } from "lucide-react";

import type { OrderStatus } from "@/generated/prisma/client";
import { CALCULATED_ORDER_STATUSES } from "@/lib/orders/state-machine";
import { cn } from "@/lib/utils";

/**
 * Where an order is in its lifecycle, at a glance (2026-11-03 rework).
 * The first five steps follow the items automatically; Delivered and
 * Finalized are set by an admin. Refunded / Cancelled stops the line.
 */
const STEPS: ReadonlyArray<{ status: OrderStatus; label: string }> = [
  { status: "PENDING", label: "Pending" },
  { status: "ASSIGNED", label: "Assigned" },
  { status: "PROCESSING", label: "Processing" },
  { status: "PARTIALLY_COMPLETED", label: "Partially done" },
  { status: "COMPLETED", label: "Completed" },
  { status: "DELIVERED", label: "Delivered" },
  { status: "FINALIZED", label: "Finalized" },
];

export function OrderStatusStepper({ status }: { status: OrderStatus }) {
  const isCancelled = status === "CANCELLED";
  const currentIndex = STEPS.findIndex((s) => s.status === status);
  const automatic = CALCULATED_ORDER_STATUSES.includes(status);

  return (
    <div className="rounded-[12px] border border-zinc-200/80 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:px-6">
      {isCancelled ? (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
          <CircleSlash aria-hidden="true" className="size-3.5" />
          This order was refunded or cancelled.
        </p>
      ) : null}

      <ol aria-label="Order progress" className="flex items-start overflow-x-auto pb-1 [scrollbar-width:thin]">
        {STEPS.map((step, index) => {
          const done = !isCancelled && currentIndex > index;
          const current = !isCancelled && currentIndex === index;
          const last = index === STEPS.length - 1;
          return (
            <li key={step.status} className={cn("flex min-w-[84px] flex-1 items-start", last && "flex-none")}>
              <div className="flex flex-col items-center gap-1.5">
                <span
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold ring-1 ring-inset transition",
                    done && "bg-indigo-600 text-white ring-indigo-600",
                    current && "bg-white text-indigo-700 ring-2 ring-indigo-500 shadow-[0_0_0_4px_rgba(99,102,241,0.12)]",
                    !done && !current && "bg-white text-zinc-400 ring-zinc-200",
                  )}
                >
                  {done ? <Check aria-hidden="true" className="size-3.5" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-center text-[11px] font-medium",
                    current ? "text-zinc-900" : done ? "text-zinc-700" : "text-zinc-500",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {!last ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mx-1 mt-3.5 h-0.5 flex-1 rounded-full",
                    done ? "bg-indigo-500" : "bg-zinc-200",
                    // The hand-set part of the line starts after Completed.
                    index === 4 && !done && "bg-[repeating-linear-gradient(90deg,#e4e4e7_0_4px,transparent_4px_7px)]",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {automatic ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
          <Zap aria-hidden="true" className="size-3.5 text-indigo-500" />
          Updates on its own as items are assigned, accepted and done. Delivered and Finalized are set by hand.
        </p>
      ) : null}
    </div>
  );
}
