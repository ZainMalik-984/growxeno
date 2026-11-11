"use client";

import { useEffect, useRef, type ReactNode, type SyntheticEvent } from "react";

/**
 * Thin wrapper around the native `<dialog>` element's show/hide lifecycle.
 *
 * `<dialog>` gives a real modal, focus trapping and Escape-to-close from the
 * platform rather than a from-scratch overlay (see ActivationControl for the
 * original hand-rolled version of this). This exists so that the several
 * per-feature dialogs added from Phase 2 onward (buyer contacts, pricing
 * tiers, ...) do not each repeat the same open/close `useEffect`.
 *
 * `m-auto` in the default className is load-bearing, not decorative: the
 * browser centers a modal `<dialog>` via its own UA stylesheet using
 * `margin: auto` (with `inset: 0` from `dialog:modal`), but Tailwind's
 * Preflight resets `margin` to `0` on every element, which silently pins
 * every dialog using this component to the top-left corner instead. Do not
 * remove `m-auto` from a custom `className` passed to this component.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  className,
  onCancel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /**
   * Escape key (the browser's "cancel"). Call `event.preventDefault()` to keep
   * the dialog open, e.g. to ask about unsaved changes first. Optional.
   */
  onCancel?: (event: SyntheticEvent<HTMLDialogElement>) => void;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onCancel}
      aria-labelledby={labelledBy}
      className={
        className ?? "m-auto w-full max-w-md rounded-[14px] border border-zinc-200/80 bg-white p-6 text-ink shadow-[0_24px_64px_-16px_rgba(16,24,40,0.35)] backdrop:bg-zinc-950/30 backdrop:backdrop-blur-[2px]"
      }
    >
      {children}
    </dialog>
  );
}

/**
 * A bottom sheet on phones (full width, rounded top, anchored to the bottom),
 * a centred popup from `sm` up (2026-11-11). Pass as Modal's `className`.
 */
export const SHEET_CLASS =
  "mx-0 mb-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-[20px] border border-zinc-200 bg-white p-0 text-ink shadow-xl shadow-zinc-900/10 backdrop:bg-zinc-950/30 " +
  "sm:m-auto sm:max-w-lg sm:rounded-[16px]";
