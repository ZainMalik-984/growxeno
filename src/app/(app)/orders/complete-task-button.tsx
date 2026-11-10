"use client";

import { CheckCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { changeOrderItemStatusAction } from "@/lib/orders/actions";
import { cn } from "@/lib/utils";

/**
 * Marks one of the signed-in worker's own tasks done from the Orders page
 * (owner request, 2026-11-11). Two clicks — "Complete", then "Confirm" — so a
 * stray click can't finish a task. Same server action and rules as Mark done
 * on the order page.
 */
export function CompleteTaskButton({ itemId, refill = false, className }: { itemId: string; refill?: boolean; className?: string }) {
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
