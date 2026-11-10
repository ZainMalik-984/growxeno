"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { applyImageChoice, CategoryImagePicker, type ImageChoice } from "@/components/catalog/category-image";
import { createCategoryAction } from "@/lib/categories/actions";

/** `canSetImage`: uploading an image needs categories.edit (2026-11-05). */
export function CategoryCreateControl({ canSetImage = false }: { canSetImage?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<ImageChoice>({ kind: "keep" });
  const [error, setError] = useState<string | undefined>();

  const close = () => {
    setOpen(false);
    setError(undefined);
  };

  const openDialog = () => {
    setName("");
    setDescription("");
    setImage({ kind: "keep" });
    setError(undefined);
    setOpen(true);
  };

  const submit = () => {
    startTransition(async () => {
      const result = await createCategoryAction({ name, description: description || undefined });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // The category exists now; attach its image if one was chosen.
      const imageResult = await applyImageChoice(result.categoryId, image);
      if (imageResult.ok) toast.success(result.message);
      else toast.error(`Category created, but the image wasn't saved: ${imageResult.error}`);
      setOpen(false);
      router.refresh();
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
          {canSetImage ? <CategoryImagePicker currentUrl={null} value={image} onChange={setImage} disabled={pending} /> : null}
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
