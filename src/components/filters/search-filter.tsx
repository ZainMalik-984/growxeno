"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";

/**
 * Search box (plus an optional checkbox toggle) that drives the URL, the same
 * pattern as `settings/users/user-list-controls.tsx` generalised for reuse —
 * Customers and other lists all need the same debounced "the URL is the
 * state" search (specification Section 30).
 *
 * Depends on the query STRING, not the `URLSearchParams` object: `router.replace`
 * hands back a new object every render, so depending on its identity would
 * retrigger this effect and re-navigate in a loop (see the original bug this
 * avoids, docs/REQUIREMENTS.md verification log, issue 3).
 */
const DEBOUNCE_MS = 300;

export function SearchFilter({
  id,
  label,
  placeholder,
  initialSearch,
  toggle,
}: {
  id: string;
  label: string;
  placeholder: string;
  initialSearch: string;
  /** An optional single checkbox toggle, e.g. "Include inactive". */
  toggle?: { paramKey: string; label: string; checked: boolean };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initialSearch);
  const isFirstRender = useRef(true);

  const currentQuery = searchParams.toString();

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams(currentQuery);
      const trimmed = value.trim();
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      params.delete("page");

      const nextQuery = params.toString();
      if (nextQuery === currentQuery) return;

      startTransition(() => {
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value, pathname, router, currentQuery]);

  const toggleParam = () => {
    if (!toggle) return;
    const params = new URLSearchParams(currentQuery);
    if (toggle.checked) params.delete(toggle.paramKey);
    else params.set(toggle.paramKey, "1");
    params.delete("page");

    startTransition(() => {
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 border-b border-line pb-4">
      <div className="relative min-w-64 flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint"
        />
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <Input
          id={id}
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          className="pl-8"
        />
      </div>

      {toggle ? (
        <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-ink-muted">
          <input
            type="checkbox"
            checked={toggle.checked}
            onChange={toggleParam}
            className="size-3.5 accent-zinc-900"
          />
          {toggle.label}
        </label>
      ) : null}

      <span aria-live="polite" className="text-xs text-ink-faint">
        {pending ? "Searching…" : ""}
      </span>
    </div>
  );
}
