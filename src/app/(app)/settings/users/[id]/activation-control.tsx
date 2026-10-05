"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setUserActiveAction } from "@/lib/access/actions";

/**
 * Deactivate / reactivate a user.
 *
 * Deactivation is destructive enough to confirm (specification Section 138).
 * The confirmation uses the native <dialog> element, which gives us a real
 * modal, focus trapping and Escape-to-close from the platform rather than from
 * a dependency.
 */
export function ActivationControl({
  userId,
  isActive,
  disabled,
}: {
  userId: string;
  isActive: boolean;
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const submit = () => {
    startTransition(async () => {
      const result = await setUserActiveAction({ userId, isActive: !isActive });
      setOpen(false);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  if (isActive) {
    return (
      <>
        <Button
          variant="secondary"
          onClick={() => setOpen(true)}
          disabled={disabled || pending}
          title={disabled ? "You cannot deactivate your own account." : undefined}
        >
          Deactivate
        </Button>

        <dialog
          ref={dialogRef}
          onClose={() => setOpen(false)}
          aria-labelledby="deactivate-title"
          className="w-full max-w-md border border-line bg-canvas p-6 text-ink backdrop:bg-zinc-950/20"
        >
          <h2 id="deactivate-title" className="text-[15px] font-medium text-ink-strong">
            Deactivate this user?
          </h2>
          <p className="mt-2 text-[13px] text-ink-muted">
            They will immediately lose all access and will not be able to sign in. Their roles,
            history and any work assigned to them are preserved, and you can reactivate them later.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={submit} disabled={pending}>
              {pending ? "Deactivating…" : "Deactivate"}
            </Button>
          </div>
        </dialog>
      </>
    );
  }

  return (
    <Button variant="secondary" onClick={submit} disabled={disabled || pending}>
      {pending ? "Reactivating…" : "Reactivate"}
    </Button>
  );
}
