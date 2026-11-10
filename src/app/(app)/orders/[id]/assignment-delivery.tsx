"use client";

import { CheckCircle2, Loader2, Mail, MessageCircle, Send, XCircle } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { SiWhatsapp } from "react-icons/si";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { getAssignmentMessageAction } from "@/lib/orders/actions";
import type { AssignmentMessageOutcome } from "@/lib/orders/assignment-notify";
import { cn } from "@/lib/utils";

/**
 * How a newly assigned worker was told about their task (owner request,
 * 2026-11-11): whether the email went out, and a button that opens WhatsApp
 * with the message already written, for the admin to send.
 */
export function AssignmentDeliveryStep({
  itemId,
  delivery: initial,
  title = "Task assigned",
  onDone,
}: {
  itemId: string;
  delivery: AssignmentMessageOutcome;
  title?: string;
  onDone: () => void;
}) {
  const [delivery, setDelivery] = useState(initial);
  const [pending, startTransition] = useTransition();

  const sendEmail = () => {
    startTransition(async () => {
      const result = await getAssignmentMessageAction({ itemId, resendEmail: true });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDelivery(result.delivery);
      if (result.delivery.email.status === "sent") toast.success(result.message);
      else if (result.delivery.email.status === "failed") toast.error(result.delivery.email.error);
    });
  };

  const email = delivery.email;
  const canSendEmail = email.status === "failed" || email.status === "sent" || (email.status === "skipped" && email.reason.startsWith("Ready to send"));

  return (
    <div>
      <div className="flex items-start gap-3 border-b border-zinc-100 px-6 py-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-emerald-50 text-emerald-600">
          <Send aria-hidden="true" className="size-[18px]" />
        </div>
        <div>
          <h2 id="assignment-delivery-title" className="text-[15px] font-semibold text-zinc-900">
            {title}
          </h2>
          <p className="mt-0.5 text-[13px] text-zinc-500">Let {delivery.workerName} know about the task.</p>
        </div>
      </div>

      <ul className="space-y-3 px-6 py-5 text-[13px]">
        <li className="flex items-start gap-3 rounded-[10px] bg-zinc-50 px-3.5 py-3 ring-1 ring-inset ring-zinc-200/70">
          <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-zinc-400" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-zinc-900">Email</p>
            <p
              className={cn(
                "mt-0.5 flex items-center gap-1.5 text-xs",
                email.status === "sent" ? "text-emerald-700" : email.status === "failed" ? "text-red-600" : "text-zinc-500",
              )}
            >
              {email.status === "sent" ? <CheckCircle2 aria-hidden="true" className="size-3.5 shrink-0" /> : null}
              {email.status === "failed" ? <XCircle aria-hidden="true" className="size-3.5 shrink-0" /> : null}
              <span className="break-words">
                {email.status === "sent"
                  ? `Sent to ${email.to}`
                  : email.status === "failed"
                    ? email.error
                    : email.reason}
              </span>
            </p>
          </div>
          {canSendEmail ? (
            <Button variant="secondary" size="sm" className="shrink-0 rounded-[8px]" onClick={sendEmail} disabled={pending}>
              {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              {email.status === "skipped" ? "Send email" : "Send again"}
            </Button>
          ) : null}
        </li>

        <li className="flex items-start gap-3 rounded-[10px] bg-zinc-50 px-3.5 py-3 ring-1 ring-inset ring-zinc-200/70">
          <SiWhatsapp aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#25D366]" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-zinc-900">WhatsApp</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {delivery.whatsappUrl ? "Opens WhatsApp with the message written. Press Send there." : delivery.whatsappSkipReason}
            </p>
          </div>
          {delivery.whatsappUrl ? (
            <a
              href={delivery.whatsappUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] bg-[#25D366] px-3 text-xs font-semibold text-white hover:bg-[#1ebe5b]"
            >
              <MessageCircle aria-hidden="true" className="size-3.5" />
              Send on WhatsApp
            </a>
          ) : null}
        </li>
      </ul>

      <div className="flex justify-end border-t border-zinc-100 px-6 py-4">
        <Button variant="accent" className="rounded-[8px]" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

/** "Message worker" on an assigned item: the same step, opened later (no email unless asked). */
export function MessageWorkerDialog({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const [delivery, setDelivery] = useState<AssignmentMessageOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAssignmentMessageAction({ itemId, resendEmail: false })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setDelivery(result.delivery);
        else setError(result.error);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't prepare the message. Try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="assignment-delivery-title"
      className="m-auto w-full max-w-lg rounded-[16px] border border-zinc-200 bg-white p-0 shadow-xl shadow-zinc-900/10 backdrop:bg-zinc-950/30"
    >
      {delivery ? (
        <AssignmentDeliveryStep itemId={itemId} delivery={delivery} title="Message worker" onDone={onClose} />
      ) : (
        <div className="px-6 py-8 text-center text-[13px] text-zinc-500">
          <h2 id="assignment-delivery-title" className="sr-only">
            Message worker
          </h2>
          {error ?? (
            <span className="inline-flex items-center gap-2">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              Preparing the message…
            </span>
          )}
        </div>
      )}
    </Modal>
  );
}
