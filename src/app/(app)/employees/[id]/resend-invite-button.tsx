"use client";

import { MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { resendEmployeeInviteAction } from "@/lib/access/actions";

export function ResendInviteButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await resendEmployeeInviteAction({ userId });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Button variant="secondary" size="sm" onClick={handleClick} disabled={pending}>
      <MailCheck aria-hidden="true" className="size-4" />
      {pending ? "Sending…" : "Resend invite"}
    </Button>
  );
}
