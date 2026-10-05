import Link from "next/link";

/**
 * Shared pager for URL-state lists (specification Section 30, 33).
 *
 * Query-string construction stays with the caller (`buildHref`) because every
 * list keeps different filters in the URL; this only renders the Previous /
 * Next / count row, generalised from `settings/users/page.tsx`.
 */
export function Pagination({
  page,
  pageCount,
  total,
  itemLabel,
  buildHref,
}: {
  page: number;
  pageCount: number;
  total: number;
  /** Singular noun, e.g. "buyer" — pluralised with a trailing "s". */
  itemLabel: string;
  buildHref: (page: number) => string;
}) {
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-ink-muted">
      <p>
        Page {page} of {pageCount} · {total} {itemLabel}
        {total === 1 ? "" : "s"}
      </p>
      <div className="flex items-center gap-3">
        {page > 1 ? (
          <Link href={buildHref(page - 1)} className="hover:text-ink hover:underline">
            Previous
          </Link>
        ) : (
          <span className="text-ink-faint">Previous</span>
        )}
        {page < pageCount ? (
          <Link href={buildHref(page + 1)} className="hover:text-ink hover:underline">
            Next
          </Link>
        ) : (
          <span className="text-ink-faint">Next</span>
        )}
      </div>
    </div>
  );
}
