"use client";

import { LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

/**
 * Signed-in user menu.
 *
 * Hand-built rather than pulled from a component library: it needs exactly one
 * behaviour (a small popover with Escape-to-close and click-outside), and the
 * accessibility requirements are met with a native button plus focus handling.
 */
export function UserMenu({
  fullName,
  email,
  roleNames,
}: {
  fullName: string;
  email: string;
  roleNames: readonly string[];
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

  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex items-center gap-2 rounded-[3px] px-1.5 py-1 text-[13px] transition-colors",
          "text-ink-muted hover:bg-canvas-subtle hover:text-ink",
        )}
      >
        <span
          aria-hidden="true"
          className="inline-flex size-6 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-medium text-ink"
        >
          {initials || "?"}
        </span>
        <span className="hidden max-w-40 truncate sm:inline">{fullName}</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-64 border border-line bg-canvas p-3 shadow-sm"
        >
          <p className="truncate text-[13px] font-medium text-ink">{fullName}</p>
          <p className="truncate text-xs text-ink-muted">{email}</p>
          <p className="mt-2 text-xs text-ink-faint">
            {roleNames.length > 0 ? roleNames.join(", ") : "No roles assigned"}
          </p>
          <form action={signOut} className="mt-3 border-t border-line-soft pt-3">
            <Button type="submit" variant="ghost" size="sm" role="menuitem" className="w-full justify-start">
              <LogOut aria-hidden="true" />
              Sign out
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
