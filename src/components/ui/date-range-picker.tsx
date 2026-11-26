"use client";

import { CalendarDays, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { DayPicker, type DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";

const noSubscribe = () => () => {};
function popoverSupported(): boolean {
  return typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype;
}

const triggerFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
function fmtIso(iso: string) {
  return triggerFmt.format(new Date(`${iso}T00:00:00.000Z`));
}

export function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const supported = useSyncExternalStore(noSubscribe, popoverSupported, () => false);

  const toDate = (iso: string) => (iso ? new Date(`${iso}T00:00:00.000Z`) : undefined);

  const [range, setRange] = useState<DateRange>({ from: toDate(from), to: toDate(to) });

  // Keep local range in sync if external values change (e.g. reset)
  useEffect(() => {
    setRange({ from: toDate(from), to: toDate(to) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const hide = () => {
    const popover = popoverRef.current;
    if (supported && popover?.matches(":popover-open")) popover.hidePopover();
    setOpen(false);
  };

  const place = () => {
    const button = buttonRef.current;
    const popover = popoverRef.current;
    if (!button || !popover) return;
    const rect = button.getBoundingClientRect();
    const popoverH = popover.offsetHeight || 320;
    const popoverW = 288;
    const below = rect.bottom + 6 + popoverH <= window.innerHeight;
    popover.style.top = `${below ? rect.bottom + 6 : Math.max(8, rect.top - 6 - popoverH)}px`;
    const left = Math.min(rect.left, window.innerWidth - popoverW - 8);
    popover.style.left = `${Math.max(8, left)}px`;
    popover.style.width = `${popoverW}px`;
  };

  useEffect(() => {
    const popover = popoverRef.current;
    if (!popover || !supported) return;
    const onToggle = (e: Event) => {
      const isOpen = (e as ToggleEvent).newState === "open";
      setOpen(isOpen);
      if (isOpen) place();
    };
    const onBefore = (e: Event) => { if ((e as ToggleEvent).newState === "open") place(); };
    popover.addEventListener("beforetoggle", onBefore);
    popover.addEventListener("toggle", onToggle);
    return () => { popover.removeEventListener("beforetoggle", onBefore); popover.removeEventListener("toggle", onToggle); };
  });

  useEffect(() => {
    if (!open) return;
    const close = () => hide();
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("resize", close); window.removeEventListener("scroll", close, true); };
  });

  useEffect(() => {
    if (supported || !open) return;
    const onDown = (e: MouseEvent) => {
      if (!popoverRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [supported, open]);

  const handleSelect = (selected: DateRange | undefined) => {
    if (!selected) return;
    setRange(selected);
    if (selected.from && selected.to) {
      onChange(selected.from.toISOString().slice(0, 10), selected.to.toISOString().slice(0, 10));
      setTimeout(hide, 100);
    }
  };

  const displayText =
    from && to
      ? from === to
        ? fmtIso(from)
        : `${fmtIso(from)} – ${fmtIso(to)}`
      : from
        ? `${fmtIso(from)} – …`
        : "Pick a range";

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        popoverTarget={supported ? id : undefined}
        onClick={supported ? undefined : () => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-[13px] text-zinc-900 shadow-sm transition-colors",
          "hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
          open && "border-indigo-400 ring-2 ring-indigo-500/25",
        )}
      >
        <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-zinc-400" />
        <span className="flex-1 font-medium">{displayText}</span>
        <ChevronRight aria-hidden="true" className={cn("size-4 text-zinc-400 transition-transform", open && "rotate-90")} />
      </button>

      <div
        ref={popoverRef}
        id={id}
        popover={supported ? "auto" : undefined}
        hidden={!supported && !open}
        className="z-50 m-0 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_8px_32px_rgba(16,24,40,0.14),0_2px_8px_rgba(16,24,40,0.08)]"
        style={
          {
            "--rdp-accent-color": "oklch(0.511 0.262 276.966)",          /* indigo-600 */
            "--rdp-accent-background-color": "oklch(0.93 0.065 274.039)", /* indigo-100 */
          } as React.CSSProperties
        }
      >
        <DayPicker
          mode="range"
          selected={range}
          onSelect={handleSelect}
          numberOfMonths={1}
        />
      </div>
    </div>
  );
}
