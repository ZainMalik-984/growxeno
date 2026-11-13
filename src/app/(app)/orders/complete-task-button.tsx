"use client";

import { CheckCheck, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { changeOrderItemStatusAction } from "@/lib/orders/actions";
import { refreshOrderItemStatsAction } from "@/lib/youtube/actions";
import { cn } from "@/lib/utils";

/**
 * Marks one of the signed-in worker's own tasks done from the Orders page
 * (owner request, 2026-11-11). Two clicks — "Complete", then "Confirm" — so a
 * stray click can't finish a task. Same server action and rules as Mark done
 * on the order page.
 */
export function CompleteTaskButton({
  itemId,
  refill = false,
  blocker = null,
  className,
}: {
  itemId: string;
  refill?: boolean;
  /** YouTube doesn't show the target yet (2026-11-12): Complete is off, with a button to read YouTube again. */
  blocker?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  // The confirm step quietly goes back after a few seconds.
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const complete = () => {
    startTransition(async () => {
      const result = await changeOrderItemStatusAction({ itemId, status: "DONE" });
      setConfirming(false);
      if (result.ok) toast.success(refill ? "Refill marked done." : "Task completed.");
      else toast.error(result.error);
      router.refresh();
    });
  };

  const checkAgain = () => {
    startTransition(async () => {
      const result = await refreshOrderItemStatsAction({ itemId });
      if (!result.ok) toast.error(result.error);
      else toast.success("Checked YouTube. Complete turns on once the count reaches the target.");
      router.refresh();
    });
  };

  if (blocker) {
    return (
      <span className={cn("inline-flex items-stretch gap-1", className)} title={blocker}>
        <Button variant="secondary" size="sm" className="min-w-0 flex-1 rounded-[8px] h-full" disabled aria-describedby={`complete-${itemId}-why`}>
          <CheckCheck aria-hidden="true" />
          {refill ? "Refill done" : "Complete"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="h-full shrink-0 rounded-[8px] px-2.5"
          onClick={checkAgain}
          disabled={pending}
          aria-label="Check the count on YouTube again"
          title="Check YouTube again"
        >
          <RefreshCw aria-hidden="true" className={cn(pending && "animate-spin")} />
        </Button>
        <span id={`complete-${itemId}-why`} className="sr-only">
          {blocker}
        </span>
      </span>
    );
  }

  return (
    <Button
      variant={confirming ? "accent" : "secondary"}
      size="sm"
      className={cn("rounded-[8px]", !confirming && "border-emerald-200 text-emerald-800 hover:bg-emerald-50", className)}
      disabled={pending}
      onClick={() => (confirming ? complete() : setConfirming(true))}
    >
      {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <CheckCheck aria-hidden="true" />}
      {pending ? "Saving…" : confirming ? "Confirm" : refill ? "Refill done" : "Complete"}
    </Button>
  );
}
