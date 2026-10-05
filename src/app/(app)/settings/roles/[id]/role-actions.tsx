"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { deleteRoleAction, duplicateRoleAction, updateRoleAction } from "@/lib/access/actions";

type DialogKind = "rename" | "duplicate" | "delete" | null;

/**
 * Rename, duplicate and delete a role (specification Section 7).
 *
 * One shared <dialog> whose content switches on which action is open, rather
 * than three separate dialogs — only one can be open at a time anyway.
 */
export function RoleActions({
  roleId,
  name,
  description,
  isSystem,
  userCount,
  canEdit,
  canCreate,
  canDelete,
}: {
  roleId: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [renameName, setRenameName] = useState(name);
  const [renameDescription, setRenameDescription] = useState(description ?? "");
  const [duplicateName, setDuplicateName] = useState(`${name} copy`);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (dialog && !el.open) el.showModal();
    if (!dialog && el.open) el.close();
  }, [dialog]);

  const close = () => {
    setDialog(null);
    setError(undefined);
  };

  const openRename = () => {
    setRenameName(name);
    setRenameDescription(description ?? "");
    setError(undefined);
    setDialog("rename");
  };

  const openDuplicate = () => {
    setDuplicateName(`${name} copy`);
    setError(undefined);
    setDialog("duplicate");
  };

  const submitRename = () => {
    startTransition(async () => {
      const result = await updateRoleAction({
        roleId,
        name: renameName,
        description: renameDescription || undefined,
      });
      if (result.ok) {
        toast.success(result.message);
        setDialog(null);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const submitDuplicate = () => {
    startTransition(async () => {
      const result = await duplicateRoleAction({ roleId, name: duplicateName });
      if (result.ok) {
        toast.success(result.message);
        setDialog(null);
        router.push(`/settings/roles/${result.roleId}`);
      } else {
        setError(result.error);
      }
    });
  };

  const submitDelete = () => {
    startTransition(async () => {
      const result = await deleteRoleAction({ roleId });
      if (result.ok) {
        toast.success(result.message);
        setDialog(null);
        router.push("/settings/roles");
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {canEdit ? (
          <Button variant="secondary" onClick={openRename}>
            Rename
          </Button>
        ) : null}
        {canCreate ? (
          <Button variant="secondary" onClick={openDuplicate}>
            Duplicate
          </Button>
        ) : null}
        {canDelete ? (
          <Button
            variant="dangerGhost"
            onClick={() => {
              setError(undefined);
              setDialog("delete");
            }}
            disabled={isSystem}
            title={isSystem ? "System roles cannot be deleted." : undefined}
          >
            Delete
          </Button>
        ) : null}
      </div>

      <dialog
        ref={dialogRef}
        onClose={close}
        aria-labelledby="role-action-title"
        className="w-full max-w-md border border-line bg-canvas p-6 text-ink backdrop:bg-zinc-950/20"
      >
        {dialog === "rename" ? (
          <>
            <h2 id="role-action-title" className="text-[15px] font-medium text-ink-strong">
              Rename role
            </h2>
            <div className="mt-5 space-y-4">
              <Field label="Name" htmlFor="rename-role-name">
                <Input
                  id="rename-role-name"
                  value={renameName}
                  onChange={(event) => setRenameName(event.target.value)}
                  maxLength={80}
                  autoFocus
                />
              </Field>
              <Field label="Description" htmlFor="rename-role-description" hint="Optional.">
                <Textarea
                  id="rename-role-description"
                  value={renameDescription}
                  onChange={(event) => setRenameDescription(event.target.value)}
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
              <Button variant="primary" onClick={submitRename} disabled={pending || !renameName.trim()}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          </>
        ) : null}

        {dialog === "duplicate" ? (
          <>
            <h2 id="role-action-title" className="text-[15px] font-medium text-ink-strong">
              Duplicate role
            </h2>
            <p className="mt-1 text-[13px] text-ink-muted">
              Copies every permission from {name} into a new, independent role.
            </p>
            <div className="mt-5 space-y-4">
              <Field label="New role name" htmlFor="duplicate-role-name">
                <Input
                  id="duplicate-role-name"
                  value={duplicateName}
                  onChange={(event) => setDuplicateName(event.target.value)}
                  maxLength={80}
                  autoFocus
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
              <Button
                variant="primary"
                onClick={submitDuplicate}
                disabled={pending || !duplicateName.trim()}
              >
                {pending ? "Duplicating…" : "Duplicate"}
              </Button>
            </div>
          </>
        ) : null}

        {dialog === "delete" ? (
          <>
            <h2 id="role-action-title" className="text-[15px] font-medium text-ink-strong">
              Delete {name}?
            </h2>
            <p className="mt-2 text-[13px] text-ink-muted">
              {userCount > 0
                ? `This role is still assigned to ${userCount} ${
                    userCount === 1 ? "user" : "users"
                  }. Remove it from them before deleting.`
                : "This cannot be undone."}
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
              <Button variant="danger" onClick={submitDelete} disabled={pending || userCount > 0}>
                {pending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </>
        ) : null}
      </dialog>
    </>
  );
}
