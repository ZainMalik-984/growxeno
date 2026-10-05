"use client";

import type { OrderStatus } from "@/generated/prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { changeOrderStatusAction, processOrderAction } from "@/lib/orders/actions";
import { ORDER_STATUS_LABELS, ORDER_TRANSITIONS } from "@/lib/orders/state-machine";

const REASON_REQUIRED: readonly OrderStatus[] = ["CANCELLED", "REVISION"];

export function OrderStatusActions({
  orderId,
  status,
  canChangeStatus,
  canProcess,
}: {
  orderId: string;
  status: OrderStatus;
  canChangeStatus: boolean;
  canProcess: boolean;
}) {
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

  const runTransition = (to: OrderStatus, transitionReason?: string) => {
    startTransition(async () => {
      const result = await changeOrderStatusAction({ orderId, status: to, reason: transitionReason });
      if (result.ok) {
        toast.success(result.message);
        setTarget(null);
        setReason("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const runProcess = () => {
    startTransition(async () => {
      const result = await processOrderAction({ orderId });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const availableTransitions = canChangeStatus ? ORDER_TRANSITIONS[status] : [];
  // "Process" is its own button — PENDING -> PROCESSING is triggered by
  // Process Order, not the generic status dropdown, per specification §42.
  const genericTransitions = availableTransitions.filter(
    (next) => !(status === "PENDING" && next === "PROCESSING"),
  );

  if (!canChangeStatus && !canProcess) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {canProcess && status === "PENDING" ? (
          <Button variant="primary" onClick={runProcess} disabled={pending}>
            {pending ? "Processing…" : "Process order"}
          </Button>
        ) : null}
        {genericTransitions.map((next) => (
          <Button
            key={next}
            variant={next === "CANCELLED" ? "dangerGhost" : "secondary"}
            onClick={() => {
              setError(undefined);
              setReason("");
              setTarget(next);
            }}
            disabled={pending}
          >
            {ORDER_STATUS_LABELS[next]}
          </Button>
        ))}
      </div>

      <Modal open={target !== null} onClose={close} labelledBy="order-status-title">
        {target ? (
          <>
            <h2 id="order-status-title" className="text-[15px] font-medium text-ink-strong">
              Move to {ORDER_STATUS_LABELS[target]}?
            </h2>
            {REASON_REQUIRED.includes(target) ? (
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
                Cancel
              </Button>
              <Button
                variant={target === "CANCELLED" ? "danger" : "primary"}
                onClick={() => runTransition(target, reason || undefined)}
                disabled={pending || (REASON_REQUIRED.includes(target) && !reason.trim())}
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
