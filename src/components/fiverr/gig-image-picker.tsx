"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { removeGigThumbnailAction, setGigThumbnailAction } from "@/lib/fiverr-accounts/actions";
import { GIG_THUMBNAIL_ACCEPT, GIG_THUMBNAIL_MAX_BYTES } from "@/lib/fiverr-accounts/thumbnail";
import { cn } from "@/lib/utils";

export type GigImageChoice = { kind: "keep" } | { kind: "replace"; file: File } | { kind: "remove" };

/**
 * Gig thumbnail picker — supports:
 * - clicking to browse files
 * - pasting an image directly from the clipboard (Ctrl/Cmd+V anywhere on the component)
 *
 * Checks type and size client-side for quick feedback; server checks bytes again.
 */
export function GigImagePicker({
  currentUrl,
  value,
  onChange,
  disabled,
}: {
  currentUrl: string | null;
  value: GigImageChoice;
  onChange: (choice: GigImageChoice) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  // Object URL for the new file — freed when choice changes.
  const previewUrl = useMemo(
    () => (value.kind === "replace" ? URL.createObjectURL(value.file) : null),
    [value],
  );
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const shown = value.kind === "replace" ? previewUrl : value.kind === "remove" ? null : currentUrl;

  const pickFile = (file: File | undefined | null) => {
    setError(null);
    if (!file) return;
    if (!GIG_THUMBNAIL_ACCEPT.split(",").includes(file.type)) {
      setError("Use a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > GIG_THUMBNAIL_MAX_BYTES) {
      setError("That image is larger than 8 MB.");
      return;
    }
    onChange({ kind: "replace", file });
  };

  // Clipboard paste — works when the component is focused or when the user
  // pastes while hovering; we listen on the container div.
  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(event.clipboardData.items);
    const imageItem = items.find((item) => item.kind === "file" && item.type.startsWith("image/"));
    if (!imageItem) return;
    event.preventDefault();
    pickFile(imageItem.getAsFile());
  };

  return (
    <div
      ref={containerRef}
      onPaste={handlePaste}
      tabIndex={0}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={cn(
        "outline-none",
        focused && "ring-2 ring-primary/20 ring-offset-1 rounded-[12px]",
      )}
    >
      <div className="flex items-center gap-4">
        {/* Thumbnail preview — clicking it opens the file picker */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          title="Click to pick an image, or paste from clipboard"
          className={cn(
            "relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-zinc-50 ring-1 ring-inset ring-zinc-200 transition-opacity",
            !disabled && "cursor-pointer hover:opacity-80",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="Gig thumbnail" className="size-full object-cover" />
          ) : (
            <ImagePlus aria-hidden="true" className="size-6 text-zinc-400" />
          )}
        </button>

        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept={GIG_THUMBNAIL_ACCEPT}
              className="sr-only"
              disabled={disabled}
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="rounded-[8px]"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-[8px]"
                disabled={disabled}
                onClick={() => onChange({ kind: "keep" })}
              >
                Undo
              </Button>
            ) : null}
          </div>
          <p
            className={cn("text-xs", error ? "font-medium text-red-600" : "text-zinc-500")}
            role={error ? "alert" : undefined}
          >
            {error ??
              "PNG, JPEG or WebP, up to 8 MB. Or paste directly from clipboard (Ctrl/Cmd+V)."}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Sends the chosen image change (if any) once the gig itself is saved. */
export async function applyGigImageChoice(
  gigId: string,
  choice: GigImageChoice,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (choice.kind === "keep") return { ok: true };
  if (choice.kind === "remove") {
    const result = await removeGigThumbnailAction({ gigId });
    return result.ok ? { ok: true } : result;
  }
  const form = new FormData();
  form.set("gigId", gigId);
  form.set("file", choice.file);
  const result = await setGigThumbnailAction(form);
  return result.ok ? { ok: true } : result;
}
