"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { inviteOutsourcedWorkerToLoginAction } from "@/lib/outsourced-workers/actions";

/**
 * Give this External Worker portal access — owner-directed, confirmed
 * directly (2026-10-08): "External or outsourced workers should be able
 * to login and have there own dashboard." See
 * `inviteOutsourcedWorkerToLogin` (`src/lib/outsourced-workers/service.ts`)
 * for the invite flow itself — the same Supabase Auth invite as inviting
 * an Employee, just the narrower seeded "External Worker" role.
 */
export function OutsourcedWorkerLoginControl({
  workerId,
  hasLogin,
  email,
}: {
  workerId: string;
  hasLogin: boolean;
  email: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (hasLogin) {
    return <StatusDot tone="done" label="Has portal access" />;
  }

  if (!email) {
    return <p className="text-[13px] text-ink-faint">Add an email address to invite this worker to log in.</p>;
  }

  const invite = () => {
    startTransition(async () => {
      const result = await inviteOutsourcedWorkerToLoginAction({ workerId });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Button variant="secondary" size="sm" onClick={invite} disabled={pending}>
      {pending ? "Sending…" : "Invite to log in"}
    </Button>
  );
}
