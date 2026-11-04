import Link from "next/link";

const PAGER_LINK =
  "inline-flex h-8 items-center rounded-[8px] border border-zinc-200 bg-white px-3 font-medium text-zinc-700 shadow-[0_1px_1px_rgba(16,24,40,0.03)] hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900";
const PAGER_DISABLED = "inline-flex h-8 items-center rounded-[8px] border border-zinc-100 px-3 text-zinc-400";

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
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={buildHref(page - 1)} className={PAGER_LINK}>
            Previous
          </Link>
        ) : (
          <span className={PAGER_DISABLED}>Previous</span>
        )}
        {page < pageCount ? (
          <Link href={buildHref(page + 1)} className={PAGER_LINK}>
            Next
          </Link>
        ) : (
          <span className={PAGER_DISABLED}>Next</span>
        )}
      </div>
    </div>
  );
}
