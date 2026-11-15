"use client";

import { MoreVertical, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

/**
 * A "⋯" button that opens a list of actions (owner request, 2026-11-15:
 * "the buttons should be put in a 3 dots action button"). The list uses the
 * browser's popover layer, so it is never clipped by a card's overflow and
 * shows above an open dialog; it closes on an outside click or Escape.
 * Arrow keys move between items.
 */

export type ActionMenuItem =
  | {
      label: string;
      icon?: LucideIcon;
      onSelect?: () => void;
      /** Makes the item a link. */
      href?: string;
      /** Opens the link in a new tab. */
      external?: boolean;
      tone?: "default" | "primary" | "danger";
      disabled?: boolean;
      /** A second, smaller line (e.g. why it's off). */
      hint?: string;
    }
  | "separator";

const MENU_WIDTH = 240;

const noSubscribe = () => () => {};

function popoverSupported(): boolean {
  return typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype;
}

export function ActionMenu({
  label,
  items,
  className,
  buttonClassName,
}: {
  /** Accessible name of the ⋯ button, e.g. "Actions for Subscribers". */
  label: string;
  items: ActionMenuItem[];
  className?: string;
  buttonClassName?: string;
}) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const supported = useSyncExternalStore(noSubscribe, popoverSupported, () => false);

  const hide = () => {
    const menu = menuRef.current;
    if (supported && menu?.matches(":popover-open")) menu.hidePopover();
    setOpen(false);
  };

  // Put the list under the button, right-aligned; above it when there's no room below.
  const place = () => {
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!button || !menu) return;
    const rect = button.getBoundingClientRect();
    const height = menu.offsetHeight || items.reduce((sum, item) => sum + (item === "separator" ? 9 : item.hint ? 50 : 36), 10);
    const below = rect.bottom + 4 + height <= window.innerHeight;
    menu.style.top = `${below ? rect.bottom + 4 : Math.max(8, rect.top - 4 - height)}px`;
    menu.style.left = `${Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8))}px`;
  };

  // Native popover: keep React's state in step, place it, focus the first item.
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu || !supported) return;
    const onToggle = (event: Event) => {
      const isOpen = (event as ToggleEvent).newState === "open";
      setOpen(isOpen);
      if (isOpen) {
        place();
        menu.querySelector<HTMLElement>("[role=menuitem]:not([aria-disabled=true])")?.focus();
      }
    };
    // Place it before it shows (no flash in the corner), then again with its real height.
    const onBeforeToggle = (event: Event) => {
      if ((event as ToggleEvent).newState === "open") place();
    };
    menu.addEventListener("beforetoggle", onBeforeToggle);
    menu.addEventListener("toggle", onToggle);
    return () => {
      menu.removeEventListener("beforetoggle", onBeforeToggle);
      menu.removeEventListener("toggle", onToggle);
    };
  });

  // Close when the page scrolls or resizes under it.
  useEffect(() => {
    if (!open) return;
    const close = () => hide();
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  });

  // Without popover support (tests, old browsers): close on an outside click.
  useEffect(() => {
    if (supported || !open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [supported, open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const all = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([aria-disabled=true])") ?? []);
    const at = all.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = event.key === "ArrowDown" ? (at + 1) % all.length : (at - 1 + all.length) % all.length;
      all[next]?.focus();
    } else if (event.key === "Escape" && !supported) {
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "Tab") {
      hide();
    }
  };

  const itemClass = (tone: "default" | "primary" | "danger" = "default", disabled?: boolean) =>
    cn(
      "flex w-full items-start gap-2.5 rounded-[7px] px-2.5 py-2 text-left text-[13px] outline-none",
      disabled
        ? "cursor-default text-zinc-400"
        : cn(
            "hover:bg-zinc-100 focus-visible:bg-zinc-100",
            tone === "primary" && "font-semibold text-indigo-700",
            tone === "danger" && "text-red-600 hover:bg-red-50 focus-visible:bg-red-50",
            tone === "default" && "text-zinc-800",
          ),
    );

  return (
    <div className={cn("relative inline-flex", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        popoverTarget={supported ? id : undefined}
        onClick={supported ? undefined : () => setOpen((value) => !value)}
        className={cn(
          "relative inline-flex size-8 items-center justify-center rounded-[8px] text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
          open && "bg-zinc-100 text-zinc-900",
          buttonClassName,
        )}
      >
        <MoreVertical aria-hidden="true" className="size-[18px]" />
      </button>
      <div
        ref={menuRef}
        id={id}
        popover={supported ? "auto" : undefined}
        role="menu"
        aria-label={label}
        hidden={!supported && !open}
        onKeyDown={onKeyDown}
        style={{ width: MENU_WIDTH }}
        className={cn(
          "z-50 m-0 rounded-[10px] border border-zinc-200 bg-white p-1 text-left shadow-[0_8px_24px_rgba(16,24,40,0.12),0_2px_6px_rgba(16,24,40,0.08)]",
          supported ? "fixed inset-auto" : "absolute right-0 top-9",
        )}
      >
        {items.map((item, index) => {
          if (item === "separator") return <div key={`sep-${index}`} role="separator" className="my-1 border-t border-zinc-100" />;
          const Icon = item.icon;
          const body = (
            <>
              {Icon ? <Icon aria-hidden="true" className="mt-px size-4 shrink-0" /> : null}
              <span className="min-w-0">
                <span className="block">{item.label}</span>
                {item.hint ? <span className="block text-[11px] font-normal leading-snug text-zinc-500">{item.hint}</span> : null}
              </span>
            </>
          );
          if (item.href && !item.disabled) {
            return (
              <a
                key={item.label}
                role="menuitem"
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noreferrer noopener" : undefined}
                onClick={hide}
                className={itemClass(item.tone)}
              >
                {body}
              </a>
            );
          }
          return (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              aria-disabled={item.disabled || undefined}
              onClick={() => {
                if (item.disabled) return;
                hide();
                item.onSelect?.();
              }}
              className={itemClass(item.tone, item.disabled)}
            >
              {body}
            </button>
          );
        })}
      </div>
    </div>
  );
}
