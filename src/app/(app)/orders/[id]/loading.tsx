import { Bone, SkeletonCard, SkeletonPage, SkeletonRing } from "@/components/ui/skeleton";

/**
 * Shaped like the order page (2026-11-16): the order number and deadline, the
 * Items card with its one-line header and item blocks (avatar, service, link
 * line, ring with four figures, footer), and the details card on the side.
 */
export default function OrderLoading() {
  return (
    <SkeletonPage label="Loading order">
      <Bone className="mb-4 hidden h-3 w-40 md:block" />
      <Bone className="h-7 w-32 rounded-[8px]" />
      <div className="mb-6 mt-2 flex items-center gap-2">
        <Bone className="h-3 w-14" soft />
        <Bone className="h-5 w-28" soft />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SkeletonCard className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 sm:px-5">
            <Bone className="h-4 w-36" />
            <Bone className="h-8 w-16 rounded-[8px]" soft />
          </div>
          <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/70 p-3 sm:p-4">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-[12px] border border-zinc-200 bg-white">
                <div className="flex items-start gap-3 px-4 pt-3.5 sm:px-5">
                  <Bone className="size-9 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Bone className="size-[18px] rounded-[5px]" soft />
                      <Bone className="h-4 w-32" />
                      <Bone className="h-5 w-20" soft />
                    </div>
                    <Bone className="h-3 w-48" soft />
                  </div>
                  <Bone className="h-5 w-1.5" soft />
                </div>
                <div className="flex items-center gap-3 px-4 pb-4 pt-3 sm:px-5">
                  <SkeletonRing size={48} />
                  <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                    {[0, 1, 2, 3].map((f) => (
                      <div key={f} className="space-y-1.5">
                        <Bone className="h-2.5 w-16" soft />
                        <Bone className="h-4 w-12" />
                      </div>
                    ))}
                  </div>
                  <Bone className="hidden h-8 w-20 rounded-[8px] sm:block" soft />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-b-[12px] border-t border-zinc-100 bg-zinc-50/60 px-4 py-2.5 sm:px-5">
                  <Bone className="h-3 w-56 basis-full sm:basis-auto" soft />
                  <Bone className="h-5 w-40" soft />
                  <Bone className="ml-auto h-8 w-24 rounded-[8px]" />
                </div>
              </div>
            ))}
          </div>
        </SkeletonCard>

        <SkeletonCard className="space-y-4 p-5 sm:p-6">
          <Bone className="h-4 w-28" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between border-t border-zinc-100 pt-3">
              <Bone className="h-3 w-20" soft />
              <Bone className="h-3 w-24" />
            </div>
          ))}
        </SkeletonCard>
      </div>
    </SkeletonPage>
  );
}
