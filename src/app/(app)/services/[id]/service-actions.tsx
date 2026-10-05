"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { deleteServiceAction, setServiceActiveAction } from "@/lib/services/actions";

type DialogKind = "deactivate" | "delete" | null;

export function ServiceActions({
  serviceId,
  name,
  isActive,
  canEdit,
  canDelete,
}: {
  serviceId: string;
  name: string;
  isActive: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  const close = () => {
    setDialog(null);
    setError(undefined);
  };

  const reactivate = () => {
    startTransition(async () => {
      const result = await setServiceActiveAction({ serviceId, isActive: true });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const confirmDeactivate = () => {
    startTransition(async () => {
      const result = await setServiceActiveAction({ serviceId, isActive: false });
      if (result.ok) {
        toast.success(result.message);
        setDialog(null);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const confirmDelete = () => {
    startTransition(async () => {
      const result = await deleteServiceAction({ serviceId });
      if (result.ok) {
        toast.success(result.message);
        router.push("/services");
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {canEdit ? (
          isActive ? (
            <Button variant="secondary" onClick={() => setDialog("deactivate")} disabled={pending}>
              Deactivate
            </Button>
          ) : (
            <Button variant="secondary" onClick={reactivate} disabled={pending}>
              {pending ? "Reactivating…" : "Reactivate"}
            </Button>
          )
        ) : null}
        {canDelete ? (
          <Button
            variant="dangerGhost"
            onClick={() => {
              setError(undefined);
              setDialog("delete");
            }}
            disabled={pending}
          >
            Delete
          </Button>
        ) : null}
      </div>

      <Modal open={dialog !== null} onClose={close} labelledBy="service-action-title">
        {dialog === "deactivate" ? (
          <>
            <h2 id="service-action-title" className="text-[15px] font-medium text-ink-strong">
              Deactivate {name}?
            </h2>
            <p className="mt-2 text-[13px] text-ink-muted">
              It will no longer appear in active service pickers. You can reactivate it later.
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
              <Button variant="danger" onClick={confirmDeactivate} disabled={pending}>
                {pending ? "Deactivating…" : "Deactivate"}
              </Button>
            </div>
          </>
        ) : null}

        {dialog === "delete" ? (
          <>
            <h2 id="service-action-title" className="text-[15px] font-medium text-ink-strong">
              Delete {name}?
            </h2>
            <p className="mt-2 text-[13px] text-ink-muted">
              This cannot be undone. Refused while any order item still references this service —
              deactivate it instead.
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
          </>
        ) : null}
      </Modal>
    </>
  );
}
