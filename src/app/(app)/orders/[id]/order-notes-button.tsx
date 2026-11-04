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
 * Placement (2026-11-03 redesign): still top-left and still a button you open
 * only when needed, but it now sits in the order title row instead of being
 * fixed over the page, where it covered the breadcrumb.
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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="order-notes-panel"
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[13px] font-medium transition-colors",
          open
            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
            : "border-zinc-200 bg-white text-zinc-600 shadow-[0_1px_1px_rgba(16,24,40,0.03)] hover:border-zinc-300 hover:text-zinc-900",
        )}
      >
        <NotebookPen aria-hidden="true" className="size-4" />
        Notes
        {notes.length > 0 ? (
          <span className="grid min-w-5 place-items-center rounded-full bg-zinc-100 px-1.5 text-[11px] font-semibold leading-5 text-zinc-600">
            {notes.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id="order-notes-panel"
          role="region"
          aria-label="Order notes"
          className="absolute left-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[12px] border border-zinc-200/80 bg-white shadow-[0_24px_48px_-16px_rgba(16,24,40,0.28)]"
        >
          <div className="border-b border-zinc-100 px-4 py-3">
            <p className="text-sm font-semibold text-zinc-900">Notes</p>
            <p className="mt-0.5 text-xs text-ink-faint">Internal — distinct from the activity feed.</p>
          </div>

          {canComment ? (
            <div className="border-b border-zinc-100 bg-zinc-50/60 px-4 py-3">
              <AddOrderNoteForm orderId={orderId} />
            </div>
          ) : null}

          <ul className="max-h-80 overflow-y-auto">
            {notes.length === 0 ? (
              <li className="px-3 py-6 text-center text-[13px] text-ink-faint">No notes yet.</li>
            ) : (
              notes.map((note) => (
                <li key={note.id} className="border-b border-zinc-100 px-4 py-3 last:border-0">
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
