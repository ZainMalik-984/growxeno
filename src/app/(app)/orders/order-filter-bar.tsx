"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { ORDER_STATUS_LABELS } from "@/lib/orders/state-machine";

const DEBOUNCE_MS = 300;
const ORDER_STATUSES = Object.keys(ORDER_STATUS_LABELS) as Array<keyof typeof ORDER_STATUS_LABELS>;
const ORDER_SOURCES = ["FIVERR", "EXTERNAL"] as const;

type PickerOption = { id: string; label: string };

/**
 * Search, status, and an expandable "More filters" panel (specification
 * Section 29's suggested structure), all represented in the URL (Section 30).
 * Every change is server-side filtering on the next render — nothing here
 * filters in the browser.
 */
export function OrderFilterBar({
  initialSearch,
  customers,
  workers,
  outsourcedWorkers,
  services,
  categories,
}: {
  initialSearch: string;
  customers: readonly PickerOption[];
  workers: readonly PickerOption[];
  outsourcedWorkers: readonly PickerOption[];
  services: readonly PickerOption[];
  categories: readonly PickerOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(initialSearch);
  const [expanded, setExpanded] = useState(false);
  const isFirstRender = useRef(true);

  const currentQuery = searchParams.toString();

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams(currentQuery);
      const trimmed = query.trim();
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      params.delete("page");
      const next = params.toString();
      if (next === currentQuery) return;
      startTransition(() => {
        router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const setParam = (key: string, value: string | boolean | undefined) => {
    const params = new URLSearchParams(currentQuery);
    if (value === undefined || value === "" || value === false) params.delete(key);
    else params.set(key, value === true ? "1" : value);
    params.delete("page");
    startTransition(() => {
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    });
  };

  const get = (key: string) => searchParams.get(key) ?? "";
  const has = (key: string) => searchParams.get(key) === "1";

  return (
    <div className="mb-6 space-y-3 border-b border-line pb-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint"
          />
          <label htmlFor="order-search" className="sr-only">
            Search orders, customers, links…
          </label>
          <Input
            id="order-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search orders, customers, links…"
            className="pl-8"
          />
        </div>

        <label htmlFor="order-status" className="sr-only">
          Status
        </label>
        <select
          id="order-status"
          value={get("status")}
          onChange={(event) => setParam("status", event.target.value || undefined)}
          className="h-8 rounded-[3px] border border-line bg-canvas px-2 text-[13px] text-ink hover:border-zinc-300 focus:border-zinc-900 focus:outline-none"
        >
          <option value="">Any status</option>
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {ORDER_STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          className="text-[13px] text-ink-muted hover:text-ink hover:underline"
        >
          {expanded ? "Fewer filters" : "More filters"}
        </button>
      </div>

      {expanded ? (
        <div className="grid gap-3 pt-1 sm:grid-cols-2 lg:grid-cols-4">
          <Picker label="Source" value={get("source")} onChange={(v) => setParam("source", v)}>
            {ORDER_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source[0] + source.slice(1).toLowerCase()}
              </option>
            ))}
          </Picker>

          <Picker show={customers.length > 0} label="Customer" value={get("customer")} onChange={(v) => setParam("customer", v)}>
            {customers.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Picker>

          <Picker show={workers.length > 0} label="Worker" value={get("worker")} onChange={(v) => setParam("worker", v)}>
            {workers.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Picker>

          <Picker
            show={outsourcedWorkers.length > 0}
            label="Outsourced worker"
            value={get("outsourcedWorker")}
            onChange={(v) => setParam("outsourcedWorker", v)}
          >
            {outsourcedWorkers.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Picker>

          <Picker show={services.length > 0} label="Service" value={get("service")} onChange={(v) => setParam("service", v)}>
            {services.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Picker>

          <Picker show={categories.length > 0} label="Category" value={get("category")} onChange={(v) => setParam("category", v)}>
            {categories.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Picker>

          <Picker label="Assignment" value={get("assigned")} onChange={(v) => setParam("assigned", v)}>
            <option value="1">Assigned</option>
            <option value="0">Unassigned</option>
          </Picker>

          <div className="sm:col-span-2 lg:col-span-4">
            <label htmlFor="order-link-query" className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-ink-faint">
              Link / domain contains
            </label>
            <Input
              id="order-link-query"
              defaultValue={get("link")}
              onBlur={(event) => setParam("link", event.target.value || undefined)}
              placeholder="example.com"
              className="max-w-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
            <Checkbox label="Overdue" checked={has("overdue")} onChange={(v) => setParam("overdue", v)} />
            <Checkbox label="Due today" checked={has("dueToday")} onChange={(v) => setParam("dueToday", v)} />
            <Checkbox label="Due this week" checked={has("dueThisWeek")} onChange={(v) => setParam("dueThisWeek", v)} />
            <Checkbox label="Has links" checked={has("hasLinks")} onChange={(v) => setParam("hasLinks", v)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Picker({
  label,
  value,
  onChange,
  children,
  show = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  /** False when the actor may not see this list (it is not loaded at all). */
  show?: boolean;
}) {
  if (!show) return null;
  return (
    <label className="block text-[13px] text-ink">
      <span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-ink-faint">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded-[3px] border border-line bg-canvas px-2 text-[13px] text-ink hover:border-zinc-300 focus:border-zinc-900 focus:outline-none"
      >
        <option value="">Any</option>
        {children}
      </select>
    </label>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-ink-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-3.5 accent-zinc-900"
      />
      {label}
    </label>
  );
}
