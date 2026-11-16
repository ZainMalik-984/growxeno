import { Bone, SkeletonCard, SkeletonPage } from "@/components/ui/skeleton";

/** Placeholder shaped like the Employee page: header, four tiles, two columns. */
export default function Loading() {
  return (
    <SkeletonPage label="Loading employee">
      <Bone className="mb-4 hidden h-3 w-48 md:block" />
      <SkeletonCard className="mb-6 flex items-center gap-4 p-5 sm:p-6">
        <Bone className="size-14 shrink-0" />
        <div className="space-y-2">
          <Bone className="h-5 w-48 rounded-[6px]" />
          <Bone className="h-3 w-64" soft />
          <Bone className="h-4 w-24" soft />
        </div>
      </SkeletonCard>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} className="space-y-2 p-4 max-md:mx-0 max-md:rounded-[12px] max-md:border-x">
            <Bone className="h-2.5 w-20" soft />
            <Bone className="h-6 w-16 rounded-[6px]" />
          </SkeletonCard>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <SkeletonCard className="h-48 p-5"><Bone className="h-4 w-32" /></SkeletonCard>
          <SkeletonCard className="h-56 p-5"><Bone className="h-4 w-40" /></SkeletonCard>
        </div>
        <div className="space-y-6">
          <SkeletonCard className="h-72 p-5"><Bone className="h-4 w-28" /></SkeletonCard>
          <SkeletonCard className="h-40 p-5"><Bone className="h-4 w-24" /></SkeletonCard>
        </div>
      </div>
    </SkeletonPage>
  );
}
