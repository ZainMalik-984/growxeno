"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { createCategoryAction } from "@/lib/categories/actions";

export function CategoryCreateControl() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | undefined>();

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
      const result = await createCategoryAction({ name, description: description || undefined });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <>
      <Button variant="primary" onClick={openDialog}>
        New category
      </Button>

      <Modal open={open} onClose={close} labelledBy="create-category-title">
        <h2 id="create-category-title" className="text-[15px] font-medium text-ink-strong">
          New category
        </h2>

        <div className="mt-5 space-y-4">
          <Field label="Name" htmlFor="new-category-name">
            <Input
              id="new-category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              autoFocus
            />
          </Field>
          <Field label="Description" htmlFor="new-category-description" hint="Optional.">
            <Textarea
              id="new-category-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
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
            {pending ? "Creating…" : "Create category"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
