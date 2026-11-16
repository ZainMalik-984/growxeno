import { Bone, SkeletonCard, SkeletonPage, SkeletonPageHeader } from "@/components/ui/skeleton";

/** Shaped like New order (2026-11-16): the order card with paired fields, the items card, the summary on the side. */
export default function NewOrderLoading() {
  return (
    <SkeletonPage label="Loading new order">
      <SkeletonPageHeader titleWidth={150} />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-6">
        <div className="space-y-5">
          <SkeletonCard className="p-5 sm:p-7">
            <Bone className="mb-5 h-4 w-32" />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-2">
                  <Bone className="h-3 w-24" soft />
                  <Bone className="h-9 w-full rounded-[8px]" soft />
                </div>
              ))}
            </div>
          </SkeletonCard>
          <SkeletonCard className="p-5 sm:p-7">
            <Bone className="mb-5 h-4 w-20" />
            <Bone className="h-28 w-full rounded-[10px]" soft />
          </SkeletonCard>
        </div>
        <SkeletonCard className="space-y-4 p-5 sm:p-6">
          <Bone className="h-4 w-24" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex justify-between">
              <Bone className="h-3 w-20" soft />
              <Bone className="h-3 w-16" />
            </div>
          ))}
          <Bone className="h-10 w-full rounded-[8px]" />
        </SkeletonCard>
      </div>
    </SkeletonPage>
  );
}
