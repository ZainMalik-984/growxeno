"use client";

import { AlarmClock, CalendarDays, CalendarRange, Camera, Link2, Search, SlidersHorizontal, X } from "lucide-react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { Modal, SHEET_CLASS } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 300;
const ORDER_SOURCES = ["FIVERR", "EXTERNAL"] as const;

/** Filters that live behind "More filters" — counted on its button so hidden filters are never forgotten. */
const PANEL_KEYS = ["source", "customer", "worker", "outsourcedWorker", "service", "category", "assigned", "link"] as const;
/** Everything "Clear all" resets. `view` and `size` are display choices, not filters, so they stay. */
const ALL_FILTER_KEYS = [...PANEL_KEYS, "q", "status", "overdue", "due", "dueToday", "dueThisWeek", "hasLinks", "screenshots", "amountMin", "amountMax"];

/** Field chrome matching the New Order page. */
const CONTROL =
  "h-10 rounded-[8px] border border-zinc-200 bg-white px-3 text-sm text-ink shadow-[0_1px_1px_rgba(16,24,40,0.03)] " +
  "hover:border-zinc-300 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10";

type PickerOption = { id: string; label: string };

/**
 * Search, quick toggles and an expandable "More filters" panel (status is
 * the tab row above, rendered by the page)
 * (specification Section 29's suggested structure), all represented in the
 * URL (Section 30). Every change is server-side filtering on the next
 * render — nothing here filters in the browser.
 */
export function OrderFilterBar({
  initialSearch,
  customers,
  workers,
  outsourcedWorkers,
  services,
  categories,
  showSource = true,
  showRequests = false,
}: {
  initialSearch: string;
  /** False for workers: an order's source is not theirs to see (2026-11-03). */
  showSource?: boolean;
  /** The team's "Screenshots requested" quick filter (2026-11-11). */
  showRequests?: boolean;
  customers: readonly PickerOption[];
  workers: readonly PickerOption[];
  outsourcedWorkers: readonly PickerOption[];
  services: readonly PickerOption[];
  categories: readonly PickerOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialSearch);
  const isFirstRender = useRef(true);

  const currentQuery = searchParams.toString();
  const panelCount = PANEL_KEYS.filter((key) => searchParams.has(key)).length;
  // Open by default when a hidden filter is already active, so it is visible on arrival.
  const [expanded, setExpanded] = useState(panelCount > 0);

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

  const replaceWith = (params: URLSearchParams) => {
    params.delete("page");
    startTransition(() => {
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    });
  };

  const setParam = (key: string, value: string | boolean | undefined) => {
    const params = new URLSearchParams(currentQuery);
    if (value === undefined || value === "" || value === false) params.delete(key);
    else params.set(key, value === true ? "1" : value);
    // The sidebar's "Overdue" link uses the older `due=overdue` spelling; one toggle owns both.
    if (key === "overdue" && !value) params.delete("due");
    replaceWith(params);
  };

  const clearAll = () => {
    const params = new URLSearchParams(currentQuery);
    for (const key of ALL_FILTER_KEYS) params.delete(key);
    setQuery("");
    replaceWith(params);
  };

  const get = (key: string) => searchParams.get(key) ?? "";
  const has = (key: string) => searchParams.get(key) === "1";
  const overdueOn = has("overdue") || get("due") === "overdue";
  const anyFilter = ALL_FILTER_KEYS.some((key) => searchParams.has(key));
  const sheetCount = ALL_FILTER_KEYS.filter((key) => key !== "q" && key !== "status" && key !== "due" && searchParams.has(key)).length + (get("due") === "overdue" && !has("overdue") ? 1 : 0);
  // Phones: filters live in a bottom sheet (2026-11-11).
  const [sheetOpen, setSheetOpen] = useState(false);

  const chips = (
    <>
      <Chip icon={<AlarmClock className="size-3.5" />} label="Overdue" pressed={overdueOn} tone="red" onToggle={(v) => setParam("overdue", v)} />
      <Chip icon={<CalendarDays className="size-3.5" />} label="Due today" pressed={has("dueToday")} onToggle={(v) => setParam("dueToday", v)} />
      <Chip
        icon={<CalendarRange className="size-3.5" />}
        label="Due this week"
        pressed={has("dueThisWeek")}
        onToggle={(v) => setParam("dueThisWeek", v)}
      />
      <Chip icon={<Link2 className="size-3.5" />} label="Has links" pressed={has("hasLinks")} onToggle={(v) => setParam("hasLinks", v)} />
      {showRequests ? (
        <Chip
          icon={<Camera className="size-3.5" />}
          label="Worker requests"
          pressed={has("screenshots")}
          tone="amber"
          onToggle={(v) => setParam("screenshots", v)}
        />
      ) : null}
    </>
  );

  function panelFields(prefix: string) {
    return (
      <>
          <Picker show={showSource} label="Source" value={get("source")} onChange={(v) => setParam("source", v)}>
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

          <Picker show={workers.length > 0} label="Employee" value={get("worker")} onChange={(v) => setParam("worker", v)}>
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

          <div className="min-w-0 space-y-1.5">
            <label htmlFor={`${prefix}-order-link-query`} className="block text-[13px] font-medium text-zinc-800">
              Link / domain contains
            </label>
            <Input
              id={`${prefix}-order-link-query`}
              key={get("link")}
              defaultValue={get("link")}
              onBlur={(event) => setParam("link", event.target.value.trim() || undefined)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setParam("link", event.currentTarget.value.trim() || undefined);
              }}
              placeholder="example.com"
              className={CONTROL}
            />
          </div>
      </>
    );
  }

  const searchBox = (id: string) => (
    <div className="relative min-w-0 flex-[1_1_16rem]">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
      <label htmlFor={id} className="sr-only">
        Search orders, customers, links…
      </label>
      <Input
        id={id}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search orders, customers, links…"
        className={cn(CONTROL, "pl-9")}
      />
    </div>
  );

  return (
    <>
    <div className="flex items-center gap-2 md:hidden" aria-busy={isPending}>
      {searchBox("order-search-mobile")}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-11 shrink-0 items-center gap-2 rounded-[10px] border px-3.5 text-sm font-medium transition",
          sheetCount > 0 ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-zinc-200 bg-white text-zinc-700",
        )}
      >
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        Filter
        {sheetCount > 0 ? (
          <span className="grid min-w-5 place-items-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold leading-5 text-white">
            {sheetCount}
          </span>
        ) : null}
      </button>
    </div>

    <Modal open={sheetOpen} onClose={() => setSheetOpen(false)} labelledBy="order-filter-sheet-title" className={SHEET_CLASS}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 bg-white px-5 py-4">
        <span aria-hidden="true" className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-zinc-200" />
        <h2 id="order-filter-sheet-title" className="text-[15px] font-semibold text-zinc-900">
          Filters
        </h2>
        <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close filters" className="grid size-9 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100">
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="space-y-5 px-5 py-5">
        <div>
          <p className="mb-2 text-[13px] font-medium text-zinc-800">Quick filters</p>
          <div className="flex flex-wrap gap-2">{chips}</div>
        </div>
        <div className="grid gap-4">{panelFields("sheet")}</div>
      </div>
      <div className="sticky bottom-0 flex items-center gap-3 border-t border-zinc-100 bg-white px-5 py-4">
        <button type="button" onClick={clearAll} disabled={!anyFilter} className="h-11 rounded-[10px] px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">
          Clear all
        </button>
        <button
          type="button"
          onClick={() => setSheetOpen(false)}
          className="h-11 flex-1 rounded-[10px] bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {isPending ? "Updating…" : "Show results"}
        </button>
      </div>
    </Modal>

    <div
      className="hidden rounded-[12px] border border-zinc-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-4 md:block"
      aria-busy={isPending}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        {searchBox("order-search")}


        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-controls="order-more-filters"
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-[8px] border px-3.5 text-[13px] font-medium transition",
            expanded || panelCount > 0
              ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100/70"
              : "border-zinc-200 bg-white text-zinc-700 shadow-[0_1px_1px_rgba(16,24,40,0.03)] hover:border-zinc-300 hover:bg-zinc-50",
          )}
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          {expanded ? "Fewer filters" : "More filters"}
          {panelCount > 0 ? (
            <span className="grid min-w-5 place-items-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold leading-5 text-white">
              {panelCount}
            </span>
          ) : null}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {chips}

        {anyFilter ? (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto inline-flex items-center gap-1 rounded-[6px] px-2 py-1 text-[13px] font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X aria-hidden="true" className="size-3.5" />
            Clear all
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div
          id="order-more-filters"
          className="mt-4 grid animate-fade-up gap-4 rounded-[10px] border border-zinc-200/80 bg-zinc-50/80 p-4 [animation-duration:200ms] motion-reduce:animate-none sm:grid-cols-2 lg:grid-cols-4"
        >
          {panelFields("panel")}
        </div>
      ) : null}
    </div>
    </>
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
  children: ReactNode;
  /** False when the actor may not see this list (it is not loaded at all). */
  show?: boolean;
}) {
  if (!show) return null;
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="block text-[13px] font-medium text-zinc-800">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(CONTROL, "w-full", value && "border-indigo-300 bg-indigo-50/40")}
      >
        <option value="">Any</option>
        {children}
      </select>
    </label>
  );
}

/** Toggle chip for the one-click date / link filters. */
function Chip({
  icon,
  label,
  pressed,
  onToggle,
  tone = "indigo",
}: {
  icon: ReactNode;
  label: string;
  pressed: boolean;
  onToggle: (value: boolean) => void;
  tone?: "indigo" | "red" | "amber";
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onToggle(!pressed)}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/15",
        pressed
          ? tone === "red"
            ? "border-red-200 bg-red-50 text-red-700"
            : tone === "amber"
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-indigo-200 bg-indigo-50 text-indigo-700"
          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900",
      )}
    >
      <span aria-hidden="true" className={cn(pressed ? "" : "text-zinc-400")}>
        {icon}
      </span>
      {label}
    </button>
  );
}
