"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { deleteCustomerAction } from "@/lib/customers/actions";

export function CustomerDeleteControl({ customerId, name }: { customerId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  const close = () => {
    setOpen(false);
    setError(undefined);
  };

  const confirmDelete = () => {
    startTransition(async () => {
      const result = await deleteCustomerAction({ customerId });
      if (result.ok) {
        toast.success(result.message);
        router.push("/customers");
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <>
      <Button variant="dangerGhost" onClick={() => setOpen(true)}>
        Delete
      </Button>

      <Modal open={open} onClose={close} labelledBy="delete-customer-title">
        <h2 id="delete-customer-title" className="text-[15px] font-medium text-ink-strong">
          Delete {name}?
        </h2>
        <p className="mt-2 text-[13px] text-ink-muted">
          This cannot be undone. There is no deactivation for customers — the specification gives
          them a simpler profile with no active/inactive status.
        </p>
        {error ? (
          <p role="alert" className="mt-2 text-[13px] text-red-600">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete} disabled={pending}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
