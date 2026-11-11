"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

/**
 * Phones only (2026-11-11): instead of Previous / Next pages, the first page
 * grows by another page of orders when the end of the list scrolls into view.
 * It does this by asking the server for a larger `size`, so filtering and
 * visibility rules stay exactly as on desktop. At the size limit it falls back
 * to a link to the next page.
 */
export function LoadMoreOnScroll({
  shown,
  total,
  nextHref,
  atMax,
  nextPageHref,
}: {
  shown: number;
  total: number;
  nextHref: string;
  atMax: boolean;
  nextPageHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = shown < total;

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || atMax || pending) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          startTransition(() => router.replace(nextHref, { scroll: false }));
        }
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, atMax, pending, nextHref, router]);

  return (
    <div ref={sentinel} className="border-t border-zinc-100 px-4 py-4 text-center text-xs text-zinc-500 md:hidden" aria-live="polite">
      {!hasMore ? (
        <span>
          {total === 1 ? "1 order" : `All ${total} orders`} shown
        </span>
      ) : atMax ? (
        <Link href={nextPageHref} className="inline-flex h-11 items-center rounded-[10px] px-4 text-sm font-medium text-indigo-600 hover:bg-indigo-50">
          Show the next {Math.min(shown, total - shown)} orders
        </Link>
      ) : (
        <span className="inline-flex items-center gap-2">
          {pending ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : null}
          {pending ? "Loading more…" : `Showing ${shown} of ${total}`}
        </span>
      )}
    </div>
  );
}
