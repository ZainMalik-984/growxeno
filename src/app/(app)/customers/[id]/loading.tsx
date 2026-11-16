import { Bone, SkeletonCard, SkeletonPage, SkeletonRing } from "@/components/ui/skeleton";

/** Shaped like a customer's page (2026-11-16): header card with figures, orders, the About card. */
export default function CustomerLoading() {
  return (
    <SkeletonPage label="Loading customer">
      <Bone className="mb-4 hidden h-3 w-48 md:block" />
      <div className="space-y-6">
        <SkeletonCard>
          <div className="flex items-start gap-4 px-5 py-5 sm:px-6">
            <Bone className="size-14 shrink-0" />
            <div className="flex-1 space-y-2">
              <Bone className="h-6 w-48 rounded-[8px]" />
              <Bone className="h-3 w-40" soft />
              <div className="flex gap-2 pt-1">
                <Bone className="h-7 w-40" soft />
                <Bone className="h-7 w-32" soft />
              </div>
            </div>
            <Bone className="h-8 w-16 rounded-[8px]" soft />
          </div>
          <div className="grid grid-cols-2 border-t border-zinc-100 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5 px-5 py-3.5 sm:px-6 [&:not(:first-child)]:border-l [&:not(:first-child)]:border-zinc-100">
                <Bone className="h-2.5 w-14" soft />
                <Bone className="h-5 w-16" />
              </div>
            ))}
          </div>
        </SkeletonCard>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <SkeletonCard className="overflow-hidden">
            <div className="px-5 py-3.5 sm:px-6">
              <Bone className="h-4 w-24" />
            </div>
            <div className="divide-y divide-zinc-100 border-t border-zinc-100">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <SkeletonRing />
                  <div className="flex-1 space-y-2">
                    <Bone className="h-3.5 w-40" />
                    <Bone className="h-2.5 w-56" soft />
                  </div>
                  <Bone className="hidden h-5 w-24 md:block" soft />
                  <Bone className="h-5 w-24" soft />
                </div>
              ))}
            </div>
          </SkeletonCard>
          <SkeletonCard className="space-y-4 p-5">
            <Bone className="h-4 w-16" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5 border-t border-zinc-100 pt-3">
                <Bone className="h-2.5 w-20" soft />
                <Bone className="h-3 w-32" />
              </div>
            ))}
          </SkeletonCard>
        </div>
      </div>
    </SkeletonPage>
  );
}
