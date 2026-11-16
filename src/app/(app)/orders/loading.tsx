import { Bone, lineWidth, SkeletonCard, SkeletonPage, SkeletonRing } from "@/components/ui/skeleton";

/**
 * Shaped like the Orders page (redone 2026-11-16 for the progress-rings
 * design): the one-line header with the List/Board switch, the tabs, the
 * search box, then rows with a ring, two lines, status and pay, the time
 * column and "⋯".
 */
export default function OrdersLoading() {
  return (
    <SkeletonPage label="Loading orders">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Bone className="h-7 w-28 rounded-[8px]" />
        <Bone className="hidden h-9 w-40 rounded-[9px] md:block" soft />
      </div>

      <div className="mb-4 flex gap-5 border-b border-zinc-200/80 pb-3">
        {[64, 84, 96, 70].map((w) => (
          <Bone key={w} className="h-4" style={{ width: w }} soft />
        ))}
      </div>
      <Bone className="mb-4 h-9 w-full max-w-sm rounded-[8px]" soft />

      <SkeletonCard className="overflow-hidden">
        <div className="hidden grid-cols-[44px_minmax(0,1fr)_150px_120px_32px] gap-x-4 border-b border-zinc-200/80 bg-zinc-50/80 px-5 py-3 md:grid">
          <Bone className="col-span-2 h-2.5 w-12" soft />
          <Bone className="h-2.5 w-24" soft />
          <Bone className="ml-auto h-2.5 w-16" soft />
        </div>
        <div className="divide-y divide-zinc-100">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3.5 md:grid-cols-[44px_minmax(0,1fr)_150px_120px_32px] md:gap-x-4 md:px-5">
              <SkeletonRing />
              <div className="min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <Bone className="size-[18px] rounded-[5px]" soft />
                  <Bone className="h-3.5" style={{ width: lineWidth(i, 45, 20) }} />
                </div>
                <Bone className="h-2.5" style={{ width: lineWidth(i, 60, 25) }} soft />
                <div className="flex gap-2 md:hidden">
                  <Bone className="h-5 w-20" soft />
                  <Bone className="h-5 w-16" soft />
                </div>
              </div>
              <div className="hidden space-y-2 md:block">
                <Bone className="h-5 w-24" soft />
                <Bone className="h-3 w-20" soft />
              </div>
              <div className="flex items-start gap-2 md:contents">
                <div className="space-y-1.5 text-right">
                  <Bone className="ml-auto h-4 w-20" />
                  <Bone className="ml-auto h-2.5 w-12" soft />
                </div>
                <Bone className="mx-auto h-5 w-1.5" soft />
              </div>
            </div>
          ))}
        </div>
      </SkeletonCard>
    </SkeletonPage>
  );
}
