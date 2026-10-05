"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteDailyStatAction } from "@/lib/daily-stats/actions";

export function DeleteDailyStatButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const remove = () => {
    startTransition(async () => {
      const result = await deleteDailyStatAction({ id });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Button variant="dangerGhost" size="sm" onClick={remove} disabled={pending}>
      Delete
    </Button>
  );
}
