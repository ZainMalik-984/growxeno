"use client";

import type { OrderStatus } from "@/generated/prisma/client";
import { CircleSlash, PackageCheck, Stamp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { changeOrderStatusAction } from "@/lib/orders/actions";
import { ORDER_STATUS_LABELS, ORDER_TRANSITIONS } from "@/lib/orders/state-machine";

/**
 * The only order statuses anyone sets by hand (owner-directed rework,
 * 2026-11-03): Mark delivered (once every item is done), Finalize, and
 * Refund / Cancel. Everything before Completed follows the items on its own.
 */
const ACTION: Partial<Record<OrderStatus, { label: string; confirm: string; icon: typeof Stamp }>> = {
  DELIVERED: { label: "Mark delivered", confirm: "Mark this order as delivered?", icon: PackageCheck },
  FINALIZED: { label: "Finalize", confirm: "Finalize this order?", icon: Stamp },
  CANCELLED: { label: "Refund / Cancel", confirm: "Refund or cancel this order?", icon: CircleSlash },
};

export function OrderStatusActions({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();

  const close = () => {
    setTarget(null);
    setReason("");
    setError(undefined);
  };

  const run = (to: OrderStatus) => {
    startTransition(async () => {
      const result = await changeOrderStatusAction({ orderId, status: to, reason: reason.trim() || undefined });
      if (result.ok) {
        toast.success(result.message);
        close();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const next = ORDER_TRANSITIONS[status].filter((to) => ACTION[to]);
  if (next.length === 0) return null;
  const needsReason = target === "CANCELLED";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {next.map((to) => {
          const action = ACTION[to]!;
          const cancel = to === "CANCELLED";
          return (
            <Button
              key={to}
              variant={cancel ? "secondary" : "primary"}
              className={cancel ? "border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700" : undefined}
              onClick={() => {
                setError(undefined);
                setReason("");
                setTarget(to);
              }}
              disabled={pending}
            >
              <action.icon aria-hidden="true" />
              {action.label}
            </Button>
          );
        })}
      </div>

      <Modal open={target !== null} onClose={close} labelledBy="order-status-title">
        {target ? (
          <>
            <h2 id="order-status-title" className="text-base font-semibold text-zinc-900">
              {ACTION[target]?.confirm}
            </h2>
            <p className="mt-1 text-[13px] text-zinc-500">
              The order moves from {ORDER_STATUS_LABELS[status]} to {ORDER_STATUS_LABELS[target]}.
              {target === "CANCELLED" ? " It stops counting toward revenue." : ""}
            </p>
            {needsReason ? (
              <div className="mt-4">
                <Field label="Reason" htmlFor="status-change-reason">
                  <Textarea
                    id="status-change-reason"
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    autoFocus
                  />
                </Field>
              </div>
            ) : null}
            {error ? (
              <p role="alert" className="mt-2 text-[13px] text-red-600">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={close} disabled={pending}>
                Back
              </Button>
              <Button
                variant={target === "CANCELLED" ? "danger" : "primary"}
                onClick={() => run(target)}
                disabled={pending || (needsReason && !reason.trim())}
              >
                {pending ? "Saving…" : "Confirm"}
              </Button>
            </div>
          </>
        ) : null}
      </Modal>
    </>
  );
}
