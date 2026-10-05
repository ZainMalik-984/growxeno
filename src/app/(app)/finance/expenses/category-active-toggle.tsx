"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setExpenseCategoryActiveAction } from "@/lib/finance/actions";

export function CategoryActiveToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    startTransition(async () => {
      const result = await setExpenseCategoryActiveAction({ id, isActive: !isActive });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Button variant="ghost" size="sm" onClick={toggle} disabled={pending}>
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
