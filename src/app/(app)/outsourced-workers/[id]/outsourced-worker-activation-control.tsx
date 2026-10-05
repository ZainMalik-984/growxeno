"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setOutsourcedWorkerActiveAction } from "@/lib/outsourced-workers/actions";

export function OutsourcedWorkerActivationControl({
  workerId,
  isActive,
}: {
  workerId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    startTransition(async () => {
      const result = await setOutsourcedWorkerActiveAction({ workerId, isActive: !isActive });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Button variant="secondary" onClick={toggle} disabled={pending}>
      {pending ? "Saving…" : isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
