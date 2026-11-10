"use client";

import type { InquiryStatus } from "@/generated/prisma/client";
import { Archive, CheckCheck, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setInquiryStatusAction } from "@/lib/inquiries/actions";

/** Status buttons for one inquiry (inquiries.manage). */
export function InquiryActions({ inquiryId, status }: { inquiryId: string; status: InquiryStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const move = (next: InquiryStatus) =>
    startTransition(async () => {
      const result = await setInquiryStatusAction({ inquiryId, status: next });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });

  return (
    <div className="flex flex-wrap gap-2">
      {status === "NEW" ? (
        <Button size="sm" variant="secondary" className="rounded-[8px]" disabled={pending} onClick={() => move("CONTACTED")}>
          <CheckCheck aria-hidden="true" />
          Mark contacted
        </Button>
      ) : null}
      {status !== "CLOSED" ? (
        <Button size="sm" variant="ghost" className="rounded-[8px]" disabled={pending} onClick={() => move("CLOSED")}>
          <Archive aria-hidden="true" />
          Close
        </Button>
      ) : (
        <Button size="sm" variant="ghost" className="rounded-[8px]" disabled={pending} onClick={() => move("NEW")}>
          <RotateCcw aria-hidden="true" />
          Reopen
        </Button>
      )}
    </div>
  );
}
