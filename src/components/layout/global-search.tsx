"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MIN_TERM_LENGTH, normalizeSearchTerm } from "@/lib/search/term";
import type { SearchCategory, SearchHit, SearchResults } from "@/lib/search/queries";
import { cn } from "@/lib/utils";

const CATEGORY_ORDER: SearchCategory[] = ["Orders", "Customers", "Workers", "Services", "Categories"];
const DEBOUNCE_MS = 250;
const CACHE_LIMIT = 30;

/**
 * Cmd/Ctrl+K global search (specification Section 76).
 *
 * Cost controls, all client-side because this is where the request volume
 * comes from: nothing is fetched until the dialog is open and the term is
 * long enough; typing is debounced; a superseded request is aborted; and an
 * identical term already searched this session is answered from a small
 * in-memory cache instead of hitting the server again.
 */
export function GlobalSearch() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [cache, setCache] = useState<Record<string, SearchResults>>({});
  const cacheRef = useRef(cache);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);

  const openDialog = useCallback(() => {
    setOpen(true);
    // showModal() on an already-open dialog throws, and Ctrl+K can be pressed again while it is open.
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const closeDialog = useCallback(() => {
    dialogRef.current?.close();
    setOpen(false);
    setQuery("");
    setFailed(false);
    setActive(0);
  }, []);

  useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openDialog();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openDialog]);

  useEffect(() => {
    const term = normalizeSearchTerm(query);
    if (!open || !term) return;

    const key = term.toLowerCase();
    if (cacheRef.current[key]) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const response = await fetch(`/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search failed");
        const data = (await response.json()) as { results: SearchResults };
        setCache((previous) => {
          const entries = Object.entries(previous);
          const kept = entries.length >= CACHE_LIMIT ? entries.slice(entries.length - CACHE_LIMIT + 1) : entries;
          return { ...Object.fromEntries(kept), [key]: data.results };
        });
        setActive(0);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  const term = normalizeSearchTerm(query);
  const shown: SearchResults | null = term ? (cache[term.toLowerCase()] ?? null) : null;

  const flat = useMemo<SearchHit[]>(
    () => (shown ? CATEGORY_ORDER.flatMap((category) => shown[category]) : []),
    [shown],
  );

  const go = (hit: SearchHit) => {
    closeDialog();
    router.push(hit.href);
  };

  const onInputKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(flat.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && flat[active]) {
      event.preventDefault();
      go(flat[active]);
    }
  };

  let index = -1;

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-label="Search"
        className="flex h-8 items-center gap-2 rounded-[3px] border border-line px-2.5 text-[13px] text-ink-muted transition-colors hover:border-zinc-300 hover:text-ink"
      >
        <Search aria-hidden="true" className="size-3.5" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden text-[11px] text-ink-faint sm:inline">Ctrl K</kbd>
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => {
          setOpen(false);
          setQuery("");
        }}
        aria-label="Search"
        className="mx-auto mt-[12vh] w-full max-w-xl border border-line bg-canvas p-0 text-ink backdrop:bg-zinc-950/20"
      >
        <div className="border-b border-line-soft px-4 py-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search orders, customers, workers, services…"
            aria-label="Search"
            className="w-full bg-transparent text-[14px] text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-2 py-2">
          {!term ? (
            <p className="px-2 py-6 text-center text-[13px] text-ink-faint">
              Type at least {MIN_TERM_LENGTH} characters. An order number, name, email, phone, reference or link.
            </p>
          ) : failed ? (
            <p role="alert" className="px-2 py-6 text-center text-[13px] text-red-600">
              Search failed. Try again.
            </p>
          ) : !shown ? (
            <p className="px-2 py-6 text-center text-[13px] text-ink-faint">{loading ? "Searching…" : ""}</p>
          ) : flat.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px] text-ink-faint">No results for “{term}”.</p>
          ) : (
            CATEGORY_ORDER.filter((category) => shown[category].length > 0).map((category) => (
              <section key={category} className="mb-2">
                <h2 className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint">{category}</h2>
                <ul>
                  {shown[category].map((hit) => {
                    index += 1;
                    const isActive = index === active;
                    const myIndex = index;
                    return (
                      <li key={`${hit.category}-${hit.id}`}>
                        <button
                          type="button"
                          onClick={() => go(hit)}
                          onMouseEnter={() => setActive(myIndex)}
                          className={cn(
                            "flex w-full items-baseline justify-between gap-3 rounded-[3px] px-2 py-1.5 text-left text-[13px]",
                            isActive ? "bg-canvas-subtle" : "",
                          )}
                        >
                          <span className="truncate text-ink">{hit.title}</span>
                          {hit.subtitle ? <span className="truncate text-xs text-ink-faint">{hit.subtitle}</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </dialog>
    </>
  );
}
