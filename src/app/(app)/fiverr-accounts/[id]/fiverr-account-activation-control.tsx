"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setFiverrAccountActiveAction } from "@/lib/fiverr-accounts/actions";

export function FiverrAccountActivationControl({ accountId, isActive }: { accountId: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    startTransition(async () => {
      const result = await setFiverrAccountActiveAction({ accountId, isActive: !isActive });
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
