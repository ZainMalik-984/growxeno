"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { createRoleAction } from "@/lib/access/actions";

/**
 * "New role" button and its creation dialog (specification Section 7).
 *
 * The new role starts with no permissions — granting them is a deliberate act
 * on the role page, not something this dialog should also try to do.
 */
export function RoleCreateControl() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | undefined>();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => {
    setOpen(false);
    setError(undefined);
  };

  const openDialog = () => {
    setName("");
    setDescription("");
    setError(undefined);
    setOpen(true);
  };

  const submit = () => {
    startTransition(async () => {
      const result = await createRoleAction({ name, description: description || undefined });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        router.push(`/settings/roles/${result.roleId}`);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <>
      <Button variant="primary" onClick={openDialog}>
        New role
      </Button>

      <dialog
        ref={dialogRef}
        onClose={close}
        aria-labelledby="create-role-title"
        className="w-full max-w-md border border-line bg-canvas p-6 text-ink backdrop:bg-zinc-950/20"
      >
        <h2 id="create-role-title" className="text-[15px] font-medium text-ink-strong">
          New role
        </h2>
        <p className="mt-1 text-[13px] text-ink-muted">
          Starts with no permissions. Grant what it needs from the role page.
        </p>

        <div className="mt-5 space-y-4">
          <Field label="Name" htmlFor="new-role-name">
            <Input
              id="new-role-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              autoFocus
            />
          </Field>
          <Field label="Description" htmlFor="new-role-description" hint="Optional.">
            <Textarea
              id="new-role-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              maxLength={2000}
            />
          </Field>
          {error ? (
            <p role="alert" className="text-[13px] text-red-600">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={pending || !name.trim()}>
            {pending ? "Creating…" : "Create role"}
          </Button>
        </div>
      </dialog>
    </>
  );
}
