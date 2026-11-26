"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Modal, SHEET_CLASS } from "@/components/ui/modal";
import { SURFACE_CLASS } from "@/components/ui/page";
import { applyGigImageChoice, GigImagePicker, type GigImageChoice } from "@/components/fiverr/gig-image-picker";
import { createGigAction, setGigActiveAction, updateGigAction } from "@/lib/fiverr-accounts/actions";
import { cn } from "@/lib/utils";

export type ManagedGig = { id: string; name: string; thumbnailUrl: string | null; isActive: boolean };

/** Add/rename/deactivate a Fiverr account's gigs. Daily stats and charts live on the shared Gigs page. */
export function GigManager({ accountId, gigs, canManage }: { accountId: string; gigs: ManagedGig[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newImage, setNewImage] = useState<GigImageChoice>({ kind: "keep" });
  const [addError, setAddError] = useState<string | undefined>();
  const addTitleId = useId();

  // Edit modal
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editImage, setEditImage] = useState<GigImageChoice>({ kind: "keep" });
  const [editError, setEditError] = useState<string | undefined>();
  const editTitleId = useId();

  const openAdd = () => {
    setNewName("");
    setNewImage({ kind: "keep" });
    setAddError(undefined);
    setAddOpen(true);
  };

  const closeAdd = () => {
    setAddOpen(false);
  };

  const add = () => {
    if (!newName.trim()) return;
    setAddError(undefined);
    startTransition(async () => {
      const result = await createGigAction({ accountId, name: newName });
      if (!result.ok) {
        setAddError(result.error);
        return;
      }
      if (newImage.kind === "replace") {
        const imageResult = await applyGigImageChoice(result.gigId, newImage);
        if (!imageResult.ok) {
          toast.warning(`Gig added, but the thumbnail wasn't saved: ${imageResult.error}`);
          closeAdd();
          router.refresh();
          return;
        }
      }
      toast.success(result.message);
      closeAdd();
      router.refresh();
    });
  };

  const openEdit = (gig: ManagedGig) => {
    setEditId(gig.id);
    setEditName(gig.name);
    setEditImage({ kind: "keep" });
    setEditError(undefined);
  };

  const closeEdit = () => {
    setEditId(null);
  };

  const save = () => {
    if (!editId) return;
    setEditError(undefined);
    startTransition(async () => {
      const result = await updateGigAction({ gigId: editId, name: editName });
      if (!result.ok) {
        setEditError(result.error);
        return;
      }
      const imageResult = await applyGigImageChoice(editId, editImage);
      if (!imageResult.ok) {
        setEditError(`Saved, but the thumbnail wasn't: ${imageResult.error}`);
        router.refresh();
        return;
      }
      toast.success(result.message);
      closeEdit();
      router.refresh();
    });
  };

  const toggleActive = (gigId: string, isActive: boolean) => {
    startTransition(async () => {
      const result = await setGigActiveAction({ gigId, isActive: !isActive });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const editingGig = editId ? gigs.find((g) => g.id === editId) : undefined;

  return (
    <>
      <div className={cn(SURFACE_CLASS, "mb-6 overflow-hidden")}>
        {/* Section header */}
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200/80 px-5 py-4">
          <div>
            <h2 className="text-[14px] font-semibold text-zinc-900">Gigs</h2>
            <p className="mt-0.5 text-[12px] text-zinc-500">
              Daily stats and charts are on the{" "}
              <Link href="/fiverr-accounts/gigs" className="underline-offset-2 hover:underline">
                Gigs page
              </Link>
              .
            </p>
          </div>
          {canManage ? (
            <Button variant="secondary" size="sm" onClick={openAdd}>
              <Plus aria-hidden="true" />
              Add Gig
            </Button>
          ) : null}
        </div>

        {/* Gig rows */}
        {gigs.length === 0 ? (
          <p className="px-5 py-6 text-center text-[13px] text-zinc-400">No gigs yet.</p>
        ) : (
          <ul>
            {gigs.map((gig) => (
              <li key={gig.id} className="flex items-center gap-3 border-b border-zinc-100 px-5 py-3 last:border-0">
                {/* Thumbnail */}
                <div className="size-8 shrink-0 overflow-hidden rounded-[6px] border border-zinc-200 bg-zinc-50">
                  {gig.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={gig.thumbnailUrl} alt={gig.name} className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <span className="text-[8px] text-zinc-300">No img</span>
                    </div>
                  )}
                </div>

                {/* Name */}
                <Link
                  href={`/fiverr-accounts/gigs?gig=${gig.id}`}
                  className="min-w-0 flex-1 truncate text-[13px] text-ink hover:underline"
                >
                  {gig.name}
                </Link>

                {/* Status badge */}
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    gig.isActive
                      ? "bg-green-50 text-green-700"
                      : "bg-zinc-100 text-zinc-500",
                  )}
                >
                  {gig.isActive ? "Active" : "Inactive"}
                </span>

                {/* Actions */}
                {canManage ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(gig)}
                      disabled={pending}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActive(gig.id, gig.isActive)}
                      disabled={pending}
                      className={gig.isActive ? "text-zinc-500 hover:text-red-600 hover:bg-red-50" : undefined}
                    >
                      {gig.isActive ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add Gig modal */}
      <Modal open={addOpen} onClose={closeAdd} labelledBy={addTitleId} className={SHEET_CLASS}>
        <div className="p-5 sm:p-6">
          <h2 id={addTitleId} className="mb-4 text-[15px] font-semibold text-zinc-900">
            Add New Gig
          </h2>
          <div className="space-y-4">
            <Field label="Gig name" htmlFor="new-gig-name">
              <Input
                id="new-gig-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. YouTube Subscribers"
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
            </Field>
            <GigImagePicker
              currentUrl={null}
              value={newImage}
              onChange={setNewImage}
              disabled={pending}
            />
            {addError ? (
              <p role="alert" className="text-[13px] text-red-600">{addError}</p>
            ) : null}
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <Button variant="secondary" size="sm" onClick={closeAdd} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={add} disabled={pending || !newName.trim()}>
              {pending ? "Adding…" : "Add Gig"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Gig modal */}
      <Modal open={editId !== null} onClose={closeEdit} labelledBy={editTitleId} className={SHEET_CLASS}>
        <div className="p-5 sm:p-6">
          <h2 id={editTitleId} className="mb-4 text-[15px] font-semibold text-zinc-900">
            Edit Gig
          </h2>
          <div className="space-y-4">
            <Field label="Gig name" htmlFor="edit-gig-name">
              <Input
                id="edit-gig-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
            </Field>
            <GigImagePicker
              currentUrl={editingGig?.thumbnailUrl ?? null}
              value={editImage}
              onChange={setEditImage}
              disabled={pending}
            />
            {editError ? (
              <p role="alert" className="text-[13px] text-red-600">{editError}</p>
            ) : null}
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <Button variant="secondary" size="sm" onClick={closeEdit} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={save} disabled={pending || !editName.trim()}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
