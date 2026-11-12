"use client";

import { MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { inviteOutsourcedWorkerToLoginAction, resendOutsourcedWorkerInviteAction } from "@/lib/outsourced-workers/actions";

const sentFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

/**
 * Give this External Worker portal access — owner-directed, confirmed
 * directly (2026-10-08): "External or outsourced workers should be able
 * to login and have there own dashboard." See
 * `inviteOutsourcedWorkerToLogin` (`src/lib/outsourced-workers/service.ts`).
 *
 * Three states (2026-11-12): not invited (Invite), invited but no password
 * yet (pending, with Resend), and set up (has portal access).
 */
export function OutsourcedWorkerLoginControl({
  workerId,
  hasLogin,
  invitePending,
  invitedAt,
  email,
}: {
  workerId: string;
  hasLogin: boolean;
  invitePending: boolean;
  invitedAt: Date | null;
  email: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (action: typeof inviteOutsourcedWorkerToLoginAction) => {
    startTransition(async () => {
      const result = await action({ workerId });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  if (hasLogin && invitePending) {
    return (
      <div className="space-y-3">
        <StatusDot tone="warning" label="Invite pending" />
        <p className="flex items-start gap-2 text-[13px] text-zinc-600">
          <MailCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <span>
            Invitation sent{invitedAt ? ` ${sentFormat.format(new Date(invitedAt))} UTC` : ""}. They can log in once they set a password from the email.
          </span>
        </p>
        <Button variant="secondary" size="sm" onClick={() => run(resendOutsourcedWorkerInviteAction)} disabled={pending}>
          {pending ? "Sending…" : "Resend invitation"}
        </Button>
      </div>
    );
  }

  if (hasLogin) {
    return <StatusDot tone="done" label="Has portal access" />;
  }

  if (!email) {
    return <p className="text-[13px] text-ink-faint">Add an email address to invite this worker to log in.</p>;
  }

  return (
    <Button variant="secondary" size="sm" onClick={() => run(inviteOutsourcedWorkerToLoginAction)} disabled={pending}>
      {pending ? "Sending…" : "Invite to log in"}
    </Button>
  );
}
