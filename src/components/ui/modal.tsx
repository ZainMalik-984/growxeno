"use client";

import { useEffect, useRef, type ReactNode } from "react";

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
  children,
}: {
  open: boolean;
  onClose: () => void;
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
      aria-labelledby={labelledBy}
      className={
        className ?? "m-auto w-full max-w-md border border-line bg-canvas p-6 text-ink backdrop:bg-zinc-950/20"
      }
    >
      {children}
    </dialog>
  );
}
