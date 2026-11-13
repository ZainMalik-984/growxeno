"use client";

import { CheckCircle2, Mail, MessageCircle, Send, XCircle } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { AssignmentMessageOutcome } from "@/lib/orders/assignment-notify";
import { cn } from "@/lib/utils";

/**
 * After creating an order with workers assigned (2026-11-12): how each
 * worker was told. Emails have gone out already; WhatsApp needs a tap per
 * worker, so this shows before going to the order.
 */
export function CreatedOrderNotify({ deliveries, onDone }: { deliveries: readonly AssignmentMessageOutcome[]; onDone: () => void }) {
  return (
    <Modal
      open
      onClose={onDone}
      labelledBy="created-order-notify-title"
      className="m-auto w-full max-w-lg rounded-[16px] border border-zinc-200 bg-white p-0 shadow-xl shadow-zinc-900/10 backdrop:bg-zinc-950/30"
    >
      <div className="flex items-start gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-emerald-50 text-emerald-600">
          <Send aria-hidden="true" className="size-[18px]" />
        </div>
        <div>
          <h2 id="created-order-notify-title" className="text-[15px] font-semibold text-zinc-900">
            Order created
          </h2>
          <p className="mt-0.5 text-[13px] text-zinc-500">Let the workers know about their tasks.</p>
        </div>
      </div>

      <ul className="max-h-[60dvh] divide-y divide-zinc-100 overflow-y-auto">
        {deliveries.map((delivery, index) => {
          const email = delivery.email;
          return (
            <li key={index} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-zinc-900">{delivery.workerName}</p>
                <p
                  className={cn(
                    "mt-0.5 flex items-center gap-1.5 text-xs",
                    email.status === "sent" ? "text-emerald-700" : email.status === "failed" ? "text-red-600" : "text-zinc-500",
                  )}
                >
                  {email.status === "sent" ? (
                    <CheckCircle2 aria-hidden="true" className="size-3.5 shrink-0" />
                  ) : email.status === "failed" ? (
                    <XCircle aria-hidden="true" className="size-3.5 shrink-0" />
                  ) : (
                    <Mail aria-hidden="true" className="size-3.5 shrink-0" />
                  )}
                  <span className="truncate">
                    {email.status === "sent" ? `Email sent to ${email.to}` : email.status === "failed" ? email.error : email.reason}
                  </span>
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
                  WhatsApp
                </a>
              ) : (
                <SiWhatsapp aria-label={delivery.whatsappSkipReason ?? "No WhatsApp"} className="size-4 shrink-0 text-zinc-300" />
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex justify-end border-t border-zinc-100 px-5 py-4 sm:px-6">
        <Button variant="accent" className="rounded-[8px]" onClick={onDone}>
          Go to order
        </Button>
      </div>
    </Modal>
  );
}
