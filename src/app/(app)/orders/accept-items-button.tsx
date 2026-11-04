"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { changeOrderItemStatusAction } from "@/lib/orders/actions";
import { cn } from "@/lib/utils";

/**
 * Accepts one or more of the signed-in worker's own pending items, moving them
 * straight to Processing (owner request, 2026-11-03: accept from the orders
 * list without opening the order). Uses the same server action and rules as
 * the Accept button on the order page, so nothing new is allowed here.
 */
export function AcceptItemsButton({
  itemIds,
  label = "Accept",
  size = "sm",
  className,
}: {
  itemIds: readonly string[];
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const accept = () => {
    startTransition(async () => {
      let accepted = 0;
      let firstError: string | null = null;
      // One at a time: each acceptance also recalculates the order's status.
      for (const itemId of itemIds) {
        const result = await changeOrderItemStatusAction({ itemId, status: "PROCESSING" });
        if (result.ok) accepted += 1;
        else firstError ??= result.error;
      }
      if (accepted > 0) toast.success(accepted === 1 ? "Task accepted." : `${accepted} tasks accepted.`);
      if (firstError) toast.error(firstError);
      router.refresh();
    });
  };

  return (
    <Button
      variant="accent"
      size={size}
      className={cn("rounded-[8px]", className)}
      disabled={pending || itemIds.length === 0}
      onClick={accept}
    >
      {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <CheckCircle2 aria-hidden="true" />}
      {pending ? "Accepting…" : label}
    </Button>
  );
}
