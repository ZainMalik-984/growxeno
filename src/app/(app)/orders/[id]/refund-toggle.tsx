"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setOrderRefundedAction } from "@/lib/finance/actions";

/**
 * Whole-order, boolean, no partial refund (docs/REQUIREMENTS.md D4 follow-up).
 * A refunded order keeps its real status — this just excludes it from
 * recognized revenue.
 */
export function RefundToggle({ orderId, refunded }: { orderId: string; refunded: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    startTransition(async () => {
      const result = await setOrderRefundedAction({ orderId, refunded: !refunded });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Button variant={refunded ? "secondary" : "dangerGhost"} size="sm" onClick={toggle} disabled={pending}>
      {refunded ? "Clear refund flag" : "Mark as refunded"}
    </Button>
  );
}
