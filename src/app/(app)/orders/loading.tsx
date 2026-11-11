import { TopProgressBar } from "@/components/layout/top-progress-bar";

/**
 * Placeholder while the Orders page loads (2026-11-11), shaped like what comes
 * next: order cards on phones, the table on larger screens.
 */
export default function OrdersLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading orders" className="animate-pulse">
      <TopProgressBar phase="loading" />
      <span className="sr-only">Loading…</span>
      <div className="mb-3 hidden h-3 w-40 rounded-full bg-zinc-200/80 md:block" />
      <div className="mb-6 h-6 w-32 rounded-[8px] bg-zinc-200" />

      <div className="mb-4 flex gap-2 border-b border-zinc-200/80 pb-3">
        {[56, 88, 96].map((width) => (
          <div key={width} className="h-5 rounded-full bg-zinc-200/80" style={{ width }} />
        ))}
      </div>
      <div className="mb-4 flex gap-2">
        <div className="h-11 flex-1 rounded-[10px] bg-white ring-1 ring-inset ring-zinc-200 md:h-10" />
        <div className="h-11 w-24 rounded-[10px] bg-white ring-1 ring-inset ring-zinc-200 md:h-10 md:w-32" />
      </div>

      <div className="divide-y divide-zinc-100 border-y border-zinc-200/80 bg-white max-md:-mx-4 md:rounded-[12px] md:border-x">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="space-y-3 px-4 py-4 md:flex md:items-center md:gap-6 md:space-y-0 md:px-5">
            <div className="flex items-center justify-between md:w-24">
              <div className="h-4 w-12 rounded-full bg-zinc-200" />
              <div className="h-5 w-20 rounded-full bg-zinc-100 md:hidden" />
            </div>
            <div className="h-3.5 rounded-full bg-zinc-100 md:flex-1" style={{ width: `${70 - ((i * 11) % 25)}%` }} />
            <div className="h-1.5 w-full rounded-full bg-zinc-100 md:w-32" />
            <div className="h-3 w-24 rounded-full bg-zinc-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
