"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";
import { CategoryThumb } from "./category-thumb";

/**
 * Service dropdown with each option's category logo (owner request,
 * 2026-11-10). A native <select> can't show images, so this is a small
 * combobox: a button that opens a searchable, grouped list. Keyboard: arrows
 * move, Enter picks, Escape or Tab closes. The search box is the ARIA combobox
 * and the list a listbox, so screen readers announce the options as they move.
 */

export type ServiceOption = {
  id: string;
  name: string;
  categoryName: string;
  categoryImageUrl: string | null;
};

type Row = { id: string; option: ServiceOption | null };

export function ServicePicker({
  id,
  services,
  value,
  onChange,
  emptyLabel,
  invalid,
  describedBy,
  className,
}: {
  /** Put on the button, so a <label htmlFor={id}> and focus-by-id work as before. */
  id: string;
  services: readonly ServiceOption[];
  value: string;
  onChange: (serviceId: string) => void;
  /** The "nothing chosen" choice, e.g. "No item — add later". */
  emptyLabel: string;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}) {
  const listId = useId();
  const searchId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selected = services.find((s) => s.id === value) ?? null;

  /** Filtered rows in display order: the empty choice first, then each category's services. */
  const { rows, groups } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = services.filter((s) => !q || `${s.categoryName} ${s.name}`.toLowerCase().includes(q));
    const byCategory = new Map<string, ServiceOption[]>();
    for (const s of matching) byCategory.set(s.categoryName, [...(byCategory.get(s.categoryName) ?? []), s]);
    const list: Row[] = q ? [] : [{ id: "", option: null }];
    for (const items of byCategory.values()) for (const s of items) list.push({ id: s.id, option: s });
    return { rows: list, groups: [...byCategory.entries()] };
  }, [services, query]);

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the highlighted option in view.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-opt-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, open, listId]);

  const openList = () => {
    setQuery("");
    setActive(Math.max(0, rows.findIndex((r) => r.id === value)));
    setOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const choose = (serviceId: string) => {
    onChange(serviceId);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(rows.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[active];
      if (row) choose(row.id);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  let index = 0;
  const optionClass = (isActive: boolean) =>
    cn("flex w-full cursor-pointer items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left text-[13px]", isActive ? "bg-indigo-50 text-indigo-900" : "text-zinc-800");

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        // Buttons don't take aria-invalid; the error text is linked via aria-describedby.
        data-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            openList();
          }
        }}
        className={cn(
          "flex h-10 w-full items-center gap-2.5 rounded-[8px] border border-zinc-200 bg-white px-3 text-left text-sm shadow-[0_1px_1px_rgba(16,24,40,0.03)] transition",
          "hover:border-zinc-300 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10",
          "data-[invalid=true]:border-red-400 disabled:bg-zinc-50",
        )}
      >
        {selected ? (
          <>
            <CategoryThumb name={selected.categoryName} imageUrl={selected.categoryImageUrl} size={24} className="rounded-[6px]" />
            <span className="min-w-0 flex-1 truncate">
              <span className="text-zinc-500">{selected.categoryName} · </span>
              <span className="font-medium text-zinc-900">{selected.name}</span>
            </span>
          </>
        ) : (
          <span className="flex-1 truncate text-zinc-500">{emptyLabel}</span>
        )}
        <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 text-zinc-400 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-[10px] border border-zinc-200 bg-white shadow-[0_16px_40px_-12px_rgba(16,24,40,0.25)]">
          <div className="relative border-b border-zinc-100 p-2">
            <Search aria-hidden="true" className="pointer-events-none absolute left-4.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              ref={searchRef}
              id={searchId}
              type="text"
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={rows.length > 0 ? `${listId}-opt-${active}` : undefined}
              aria-label="Search services"
              placeholder="Search services…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onSearchKey}
              className="h-9 w-full rounded-[6px] bg-zinc-50 pl-8 pr-2.5 text-[13px] outline-none ring-1 ring-inset ring-zinc-200 placeholder:text-zinc-400 focus:bg-white focus:ring-indigo-400"
            />
          </div>

          <ul id={listId} role="listbox" aria-label="Services" className="max-h-72 overflow-y-auto p-1.5">
            {!query.trim() ? (
              (() => {
                const i = index++;
                return (
                  <li
                    id={`${listId}-opt-${i}`}
                    role="option"
                    aria-selected={value === ""}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose("")}
                    className={optionClass(active === i)}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-[6px] border border-dashed border-zinc-300 text-zinc-400">–</span>
                    <span className="flex-1 text-zinc-500">{emptyLabel}</span>
                    {value === "" ? <Check aria-hidden="true" className="size-4 text-indigo-600" /> : null}
                  </li>
                );
              })()
            ) : null}

            {groups.map(([category, items]) => (
              <li key={category} role="presentation">
                <p className="flex items-center gap-2 px-2.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500" aria-hidden="true">
                  <CategoryThumb name={category} imageUrl={items[0].categoryImageUrl} size={16} className="rounded-[4px]" />
                  {category}
                </p>
                <ul role="group" aria-label={category}>
                  {items.map((service) => {
                    const i = index++;
                    const isSelected = service.id === value;
                    return (
                      <li
                        key={service.id}
                        id={`${listId}-opt-${i}`}
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={() => setActive(i)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => choose(service.id)}
                        className={optionClass(active === i)}
                      >
                        <CategoryThumb name={service.categoryName} imageUrl={service.categoryImageUrl} size={28} className="rounded-[6px]" />
                        <span className="min-w-0 flex-1 truncate font-medium">{service.name}</span>
                        {isSelected ? <Check aria-hidden="true" className="size-4 shrink-0 text-indigo-600" /> : null}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}

            {rows.length === 0 ? <li className="px-3 py-6 text-center text-[13px] text-zinc-500">No services match “{query}”.</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
