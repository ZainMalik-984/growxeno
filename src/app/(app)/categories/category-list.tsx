"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/page";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { applyImageChoice, CategoryImagePicker, type ImageChoice } from "@/components/catalog/category-image";
import { CategoryThumb } from "@/components/catalog/category-thumb";
import { deleteCategoryAction, setCategoryActiveAction, updateCategoryAction } from "@/lib/categories/actions";
import { StatusDot } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";
import type { CategoryRow } from "@/lib/categories/queries";

type DialogState = { kind: "rename" | "delete" | "toggle"; category: CategoryRow } | null;

export function CategoryList({
  categories,
  canEdit,
  canDelete,
}: {
  categories: readonly CategoryRow[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pending, startTransition] = useTransition();
  const [renameName, setRenameName] = useState("");
  const [renameDescription, setRenameDescription] = useState("");
  const [image, setImage] = useState<ImageChoice>({ kind: "keep" });
  const [error, setError] = useState<string | undefined>();

  const close = () => {
    setDialog(null);
    setError(undefined);
  };

  const openRename = (category: CategoryRow) => {
    setRenameName(category.name);
    setRenameDescription(category.description ?? "");
    setImage({ kind: "keep" });
    setError(undefined);
    setDialog({ kind: "rename", category });
  };

  const submitRename = () => {
    if (!dialog) return;
    startTransition(async () => {
      const result = await updateCategoryAction({
        categoryId: dialog.category.id,
        name: renameName,
        description: renameDescription || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const imageResult = await applyImageChoice(dialog.category.id, image);
      if (!imageResult.ok) {
        // Name and description were saved; keep the dialog open to retry the image.
        setError(`Saved, but the image wasn't: ${imageResult.error}`);
        router.refresh();
        return;
      }
      toast.success(result.message);
      setDialog(null);
      router.refresh();
    });
  };

  const submitToggle = () => {
    if (!dialog) return;
    startTransition(async () => {
      const result = await setCategoryActiveAction({ categoryId: dialog.category.id, isActive: !dialog.category.isActive });
      if (result.ok) {
        toast.success(result.message);
        setDialog(null);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const submitDelete = () => {
    if (!dialog) return;
    startTransition(async () => {
      const result = await deleteCategoryAction({ categoryId: dialog.category.id });
      if (result.ok) {
        toast.success(result.message);
        setDialog(null);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  if (categories.length === 0) {
    return (
      <EmptyState
        title="No categories yet"
        description="Add the first category, e.g. Design, then add services under it."
      />
    );
  }

  return (
    <>
      <TableWrap>
        <Table>
          <caption className="sr-only">Categories</caption>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Description</TH>
              <TH>Status</TH>
              <TH className="text-right">Services</TH>
              {canEdit || canDelete ? <TH className="text-right">Actions</TH> : null}
            </TR>
          </THead>
          <TBody>
            {categories.map((category) => (
              <TR key={category.id} className={cn(!category.isActive && "bg-zinc-50/60")}>
                <TD className="font-medium text-ink">
                  <span className="flex items-center gap-3">
                    <CategoryThumb name={category.name} imageUrl={category.imageUrl} className={cn(!category.isActive && "opacity-50 grayscale")} />
                    <span className={cn(!category.isActive && "text-zinc-500")}>{category.name}</span>
                  </span>
                </TD>
                <TD className="max-w-md text-ink-muted">
                  {category.description ?? <span className="text-ink-faint">—</span>}
                </TD>
                <TD>
                  <StatusDot tone={category.isActive ? "done" : "neutral"} label={category.isActive ? "Active" : "Inactive"} />
                </TD>
                <TD className="text-right text-ink-muted">
                  <Link href={`/services?category=${category.id}`} className="hover:underline" title={`${category.activeServiceCount} active of ${category.serviceCount}`}>
                    {category.activeServiceCount === category.serviceCount
                      ? category.serviceCount
                      : `${category.activeServiceCount} of ${category.serviceCount} active`}
                  </Link>
                </TD>
                {canEdit || canDelete ? (
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      {canEdit ? (
                        <Button variant="ghost" size="sm" onClick={() => openRename(category)}>
                          Edit
                        </Button>
                      ) : null}
                      {canEdit ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setError(undefined);
                            setDialog({ kind: "toggle", category });
                          }}
                        >
                          {category.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          variant="dangerGhost"
                          size="sm"
                          onClick={() => {
                            setError(undefined);
                            setDialog({ kind: "delete", category });
                          }}
                          disabled={category.serviceCount > 0}
                          title={category.serviceCount > 0 ? "Move or delete its services first." : undefined}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </TD>
                ) : null}
              </TR>
            ))}
          </TBody>
        </Table>
      </TableWrap>

      <Modal open={dialog !== null} onClose={close} labelledBy="category-action-title">
        {dialog?.kind === "rename" ? (
          <>
            <h2 id="category-action-title" className="text-[15px] font-medium text-ink-strong">
              Edit {dialog.category.name}
            </h2>
            <div className="mt-5 space-y-4">
              <Field label="Name" htmlFor="rename-category-name">
                <Input
                  id="rename-category-name"
                  value={renameName}
                  onChange={(event) => setRenameName(event.target.value)}
                  maxLength={120}
                  autoFocus
                />
              </Field>
              <Field label="Description" htmlFor="rename-category-description" hint="Optional.">
                <Textarea
                  id="rename-category-description"
                  rows={3}
                  value={renameDescription}
                  onChange={(event) => setRenameDescription(event.target.value)}
                  maxLength={2000}
                />
              </Field>
              <CategoryImagePicker currentUrl={dialog.category.imageUrl} value={image} onChange={setImage} disabled={pending} />
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

        {dialog?.kind === "toggle" ? (
          <>
            <h2 id="category-action-title" className="text-[15px] font-medium text-ink-strong">
              {dialog.category.isActive ? `Deactivate ${dialog.category.name}?` : `Activate ${dialog.category.name}?`}
            </h2>
            <p className="mt-2 text-[13px] text-ink-muted">
              {dialog.category.isActive
                ? dialog.category.activeServiceCount > 0
                  ? `Its ${dialog.category.activeServiceCount} active ${dialog.category.activeServiceCount === 1 ? "service" : "services"} will be deactivated too, so they can't be picked for new orders. Existing orders aren't changed.`
                  : "It has no active services. It won't be offered for new services."
                : "Services that were switched off together with it are switched back on. Services you had deactivated yourself stay off."}
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
              <Button variant={dialog.category.isActive ? "danger" : "primary"} onClick={submitToggle} disabled={pending}>
                {pending ? "Saving…" : dialog.category.isActive ? "Deactivate" : "Activate"}
              </Button>
            </div>
          </>
        ) : null}

        {dialog?.kind === "delete" ? (
          <>
            <h2 id="category-action-title" className="text-[15px] font-medium text-ink-strong">
              Delete {dialog.category.name}?
            </h2>
            <p className="mt-2 text-[13px] text-ink-muted">This cannot be undone.</p>
            {error ? (
              <p role="alert" className="mt-2 text-[13px] text-red-600">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={close} disabled={pending}>
                Cancel
              </Button>
              <Button variant="danger" onClick={submitDelete} disabled={pending}>
                {pending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </>
        ) : null}
      </Modal>
    </>
  );
}
