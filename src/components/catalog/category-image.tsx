"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { removeCategoryImageAction, setCategoryImageAction } from "@/lib/categories/actions";
import { CATEGORY_IMAGE_ACCEPT, CATEGORY_IMAGE_MAX_BYTES } from "@/lib/categories/images";
import { cn } from "@/lib/utils";


export type ImageChoice = { kind: "keep" } | { kind: "replace"; file: File } | { kind: "remove" };

/**
 * Pick, preview, replace or remove a category image. Checks type and size
 * here for quick feedback; the server checks the file's bytes again.
 */
export function CategoryImagePicker({
  currentUrl,
  value,
  onChange,
  disabled,
}: {
  currentUrl: string | null;
  value: ImageChoice;
  onChange: (choice: ImageChoice) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  // A local preview for a newly chosen file, released when the choice changes.
  const previewUrl = useMemo(() => (value.kind === "replace" ? URL.createObjectURL(value.file) : null), [value]);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const shown = value.kind === "replace" ? previewUrl : value.kind === "remove" ? null : currentUrl;

  const pick = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!CATEGORY_IMAGE_ACCEPT.split(",").includes(file.type)) {
      setError("Use a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > CATEGORY_IMAGE_MAX_BYTES) {
      setError("That image is larger than 8 MB.");
      return;
    }
    onChange({ kind: "replace", file });
  };

  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-ink">Image</p>
      <div className="flex items-center gap-4">
        <div className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-zinc-50 ring-1 ring-inset ring-zinc-200">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local blob: preview or the saved image; next/image can't load blob URLs.
            <img src={shown} alt="Category image preview" className="size-full object-cover" />
          ) : (
            <ImagePlus aria-hidden="true" className="size-6 text-zinc-400" />
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept={CATEGORY_IMAGE_ACCEPT}
              className="sr-only"
              disabled={disabled}
              onChange={(event) => {
                pick(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <Button type="button" variant="secondary" size="sm" className="rounded-[8px]" disabled={disabled} onClick={() => inputRef.current?.click()}>
              <ImagePlus aria-hidden="true" />
              {shown ? "Replace" : "Choose image"}
            </Button>
            {shown || value.kind === "replace" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-[8px] text-zinc-500 hover:bg-red-50 hover:text-red-600"
                disabled={disabled}
                onClick={() => {
                  setError(null);
                  onChange(currentUrl ? { kind: "remove" } : { kind: "keep" });
                }}
              >
                <Trash2 aria-hidden="true" />
                Remove
              </Button>
            ) : null}
            {value.kind !== "keep" && currentUrl ? (
              <Button type="button" variant="ghost" size="sm" className="rounded-[8px]" disabled={disabled} onClick={() => onChange({ kind: "keep" })}>
                Undo
              </Button>
            ) : null}
          </div>
          <p className={cn("text-xs", error ? "font-medium text-red-600" : "text-zinc-500")} role={error ? "alert" : undefined}>
            {error ?? "PNG, JPEG or WebP, up to 8 MB. Resized and compressed automatically; square images look best."}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Sends the chosen image change (if any) once the category itself is saved. */
export async function applyImageChoice(categoryId: string, choice: ImageChoice): Promise<{ ok: true } | { ok: false; error: string }> {
  if (choice.kind === "keep") return { ok: true };
  if (choice.kind === "remove") {
    const result = await removeCategoryImageAction({ categoryId });
    return result.ok ? { ok: true } : result;
  }
  const form = new FormData();
  form.set("categoryId", categoryId);
  form.set("file", choice.file);
  const result = await setCategoryImageAction(form);
  return result.ok ? { ok: true } : result;
}
