"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";

/**
 * Search and filter controls for the users list.
 *
 * The URL is the state (specification Section 30). Typing updates the query
 * string after a 300 ms debounce; the server component re-renders with the new
 * parameters and re-queries the database. Nothing is filtered in the browser,
 * and there is no request per keystroke.
 */
const DEBOUNCE_MS = 300;

export function UserListControls({
  initialSearch,
  includeInactive,
}: {
  initialSearch: string;
  includeInactive: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initialSearch);
  const isFirstRender = useRef(true);

  // Depend on the STRING, not the URLSearchParams object. `router.replace`
  // hands back a new object every time, so depending on the object identity
  // re-triggers this effect, which replaces again — a permanent 300 ms
  // navigation loop that also swallows clicks on links in the list.
  const currentQuery = searchParams.toString();

  useEffect(() => {
    // Do not push a navigation on mount — the server already rendered this state.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams(currentQuery);
      const trimmed = value.trim();
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      // Any change to the query resets to the first page, otherwise the user
      // can land on an empty page 4 of a 2-page result.
      params.delete("page");

      const nextQuery = params.toString();
      // Second guard: never navigate to the URL we are already on.
      if (nextQuery === currentQuery) return;

      startTransition(() => {
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value, pathname, router, currentQuery]);

  const toggleInactive = () => {
    const params = new URLSearchParams(currentQuery);
    if (includeInactive) params.delete("inactive");
    else params.set("inactive", "1");
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
        <label htmlFor="user-search" className="sr-only">
          Search users by name or email
        </label>
        <Input
          id="user-search"
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search users by name or email…"
          className="pl-8"
        />
      </div>

      <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-ink-muted">
        <input
          type="checkbox"
          checked={includeInactive}
          onChange={toggleInactive}
          className="size-3.5 accent-zinc-900"
        />
        Include inactive
      </label>

      <span aria-live="polite" className="text-xs text-ink-faint">
        {pending ? "Searching…" : ""}
      </span>
    </div>
  );
}
