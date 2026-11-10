import { TopProgressBar } from "@/components/layout/top-progress-bar";

/** Placeholder shaped like the Employee page: header, four tiles, two columns. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading employee" className="animate-pulse">
      <TopProgressBar phase="loading" />
      <span className="sr-only">Loading…</span>
      <div className="mb-3 h-3 w-48 rounded-full bg-zinc-200/80" />
      <div className="mb-6 flex items-center gap-4 rounded-[12px] border border-zinc-200/80 bg-white p-5 sm:p-6">
        <div className="size-14 rounded-full bg-zinc-100" />
        <div className="space-y-2">
          <div className="h-5 w-48 rounded-[6px] bg-zinc-200" />
          <div className="h-3 w-64 rounded-full bg-zinc-100" />
          <div className="h-4 w-24 rounded-full bg-zinc-100" />
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[104px] rounded-[12px] border border-zinc-200/80 bg-white" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="h-48 rounded-[12px] border border-zinc-200/80 bg-white" />
          <div className="h-56 rounded-[12px] border border-zinc-200/80 bg-white" />
        </div>
        <div className="space-y-6">
          <div className="h-72 rounded-[12px] border border-zinc-200/80 bg-white" />
          <div className="h-40 rounded-[12px] border border-zinc-200/80 bg-white" />
        </div>
      </div>
    </div>
  );
}
