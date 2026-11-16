import { Bone, SkeletonCard, SkeletonList, SkeletonPage } from "@/components/ui/skeleton";

/**
 * Shaped like an outsourced worker's page (2026-11-16): avatar header, three
 * tiles, then Current workload, Rates and Earnings, with the profile on the side.
 */
export default function OutsourcedWorkerLoading() {
  return (
    <SkeletonPage label="Loading outsourced worker">
      <Bone className="mb-4 hidden h-3 w-56 md:block" />
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Bone className="size-14 shrink-0" />
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Bone className="h-6 w-44 rounded-[8px]" />
              <Bone className="h-5 w-16" soft />
            </div>
            <Bone className="h-3 w-72 max-w-full" soft />
          </div>
        </div>
        <Bone className="hidden h-9 w-28 rounded-[8px] sm:block" soft />
      </div>

      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} className="space-y-2 p-4 max-md:mx-0 max-md:rounded-[12px] max-md:border-x max-md:shadow-none">
            <Bone className="h-2.5 w-20" soft />
            <Bone className="h-6 w-14 rounded-[6px]" />
            <Bone className="hidden h-2.5 w-28 sm:block" soft />
          </SkeletonCard>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {[["Current workload", 3], ["Rates", 3]].map(([title, rows]) => (
            <SkeletonCard key={String(title)} className="p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <Bone className="size-9 rounded-[8px]" soft />
                <Bone className="h-4 w-36" />
              </div>
              <SkeletonList rows={Number(rows)} />
            </SkeletonCard>
          ))}
          <SkeletonCard className="p-5 sm:p-6">
            <Bone className="mb-4 h-4 w-24" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2 rounded-[10px] bg-zinc-50 p-3.5 ring-1 ring-inset ring-zinc-200/70">
                  <Bone className="h-2.5 w-20" soft />
                  <Bone className="h-5 w-24" />
                </div>
              ))}
            </div>
          </SkeletonCard>
        </div>
        <SkeletonCard className="space-y-4 p-5 sm:p-6">
          <Bone className="h-4 w-20" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Bone className="h-3 w-20" soft />
              <Bone className="h-9 w-full rounded-[8px]" soft />
            </div>
          ))}
        </SkeletonCard>
      </div>
    </SkeletonPage>
  );
}
