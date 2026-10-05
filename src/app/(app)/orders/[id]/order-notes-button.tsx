"use client";

import { NotebookPen } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { OrderNoteRow } from "@/lib/orders/queries";
import { AddOrderNoteForm } from "./add-order-note-form";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/**
 * Notes, as a floating button rather than a section on the page (confirmed
 * directly, 2026-10-01): "notes should be a floating button on top left
 * corner so that i can view when needed, not as part of the page." Anchored
 * dropdown, not the shared `Modal` — the same pattern as `NotificationBell`
 * and `UserMenu` (relative/absolute, click-outside + Escape to close), for
 * something meant to be glanced at and dismissed, not a centered dialog.
 *
 * Fixed just right of the sidebar on `lg+` (`--spacing-sidebar`, so it never
 * sits under the fixed sidebar itself); on smaller screens the sidebar is an
 * off-canvas drawer with its own toggle fixed at `top-3 left-3`
 * (`src/components/layout/sidebar.tsx`), so this sits lower at `top-14` to
 * clear it rather than overlap.
 */
export function OrderNotesButton({
  orderId,
  notes,
  canComment,
}: {
  orderId: string;
  notes: readonly OrderNoteRow[];
  canComment: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="fixed top-14 left-3 z-20 lg:left-[calc(var(--spacing-sidebar)+1rem)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="order-notes-panel"
        className={cn(
          "flex items-center gap-1.5 border border-line bg-canvas px-2.5 py-1.5 text-[13px] text-ink-muted shadow-sm transition-colors",
          "hover:border-zinc-300 hover:text-ink",
        )}
      >
        <NotebookPen aria-hidden="true" className="size-4" />
        Notes
        {notes.length > 0 ? <span className="text-ink-faint">({notes.length})</span> : null}
      </button>

      {open ? (
        <div
          id="order-notes-panel"
          role="region"
          aria-label="Order notes"
          className="absolute left-0 z-50 mt-1 w-80 border border-line bg-canvas shadow-sm"
        >
          <div className="border-b border-line-soft px-3 py-2">
            <p className="text-[13px] font-medium text-ink">Notes</p>
            <p className="mt-0.5 text-xs text-ink-faint">Internal — distinct from the activity feed.</p>
          </div>

          {canComment ? (
            <div className="border-b border-line-soft px-3 py-2.5">
              <AddOrderNoteForm orderId={orderId} />
            </div>
          ) : null}

          <ul className="max-h-80 overflow-y-auto">
            {notes.length === 0 ? (
              <li className="px-3 py-6 text-center text-[13px] text-ink-faint">No notes yet.</li>
            ) : (
              notes.map((note) => (
                <li key={note.id} className="border-b border-line-soft px-3 py-2.5 last:border-0">
                  <p className="text-[13px] text-ink">{note.body}</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {note.author.fullName} · {dateFormat.format(note.createdAt)} UTC
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
