import { TopProgressBar } from "@/components/layout/top-progress-bar";

/**
 * Instant placeholder while a signed-in page loads its data (2026-11-03).
 * Every page waits on a few ~200ms round trips to the database region, so
 * without this a click showed nothing for about a second. Shapes mirror the
 * real pages: breadcrumb, title, then a main column and a side column.
 */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading page" className="animate-pulse">
      <TopProgressBar phase="loading" />
      <span className="sr-only">Loading…</span>
      <div className="mb-3 h-3 w-40 rounded-full bg-zinc-200/80" />
      <div className="mb-2 h-6 w-64 rounded-[8px] bg-zinc-200" />
      <div className="mb-6 h-3 w-80 max-w-full rounded-full bg-zinc-200/70" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <SkeletonCard rows={5} />
          <SkeletonCard rows={3} />
        </div>
        <div className="hidden space-y-6 xl:block">
          <SkeletonCard rows={4} />
        </div>
      </div>
    </div>
  );
}

function SkeletonCard({ rows }: { rows: number }) {
  return (
    <div className="rounded-[12px] border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="size-9 rounded-[8px] bg-zinc-100" />
        <div className="h-4 w-32 rounded-full bg-zinc-200" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-3 rounded-full bg-zinc-100" style={{ width: `${92 - ((i * 13) % 35)}%` }} />
        ))}
      </div>
    </div>
  );
}
