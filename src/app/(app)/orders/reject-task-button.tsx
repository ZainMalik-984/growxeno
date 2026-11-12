"use client";

import { Loader2, X, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Modal, SHEET_CLASS } from "@/components/ui/modal";
import { rejectTaskAction } from "@/lib/orders/actions";
import { cn } from "@/lib/utils";

/**
 * Reject a task the worker hasn't accepted (2026-11-12, owner request: before
 * accepting, "only two buttons, Accept and Reject"). Asks for an optional
 * reason, then gives the task back to the team unassigned.
 */
export function RejectTaskButton({ itemId, serviceName, className }: { itemId: string; serviceName: string; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reject = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await rejectTaskAction({ itemId, reason });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } catch {
        setError("Couldn't reject it. Check your connection and try again.");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-white px-3 text-[13px] font-semibold text-red-600 ring-1 ring-inset ring-red-200 transition hover:bg-red-50",
          className,
        )}
      >
        <XCircle aria-hidden="true" className="size-4" />
        Reject
      </button>
      {open ? (
        <Modal open onClose={() => setOpen(false)} labelledBy={`reject-title-${itemId}`} className={cn(SHEET_CLASS, "sm:max-w-md")}>
          <div className="px-5 py-5">
            <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-10 rounded-full bg-zinc-200 sm:hidden" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id={`reject-title-${itemId}`} className="text-[15px] font-semibold text-zinc-900">
                  Reject this task?
                </h2>
                <p className="mt-0.5 text-[13px] text-zinc-500">{serviceName}. It goes back to the team to give to someone else.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100">
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
            <label htmlFor={`reject-reason-${itemId}`} className="mt-4 block text-[13px] font-medium text-zinc-700">
              Why? <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <textarea
              id={`reject-reason-${itemId}`}
              rows={2}
              autoFocus
              value={reason}
              maxLength={2000}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Too busy this week"
              className="mt-1.5 w-full resize-none rounded-[10px] border border-zinc-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
            />
            {error ? (
              <p role="alert" className="mt-2 text-[13px] text-red-600">
                {error}
              </p>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-[10px] text-sm font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50">
                Keep it
              </button>
              <button
                type="button"
                onClick={reject}
                disabled={pending}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                Reject task
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
