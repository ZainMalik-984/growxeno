import { Bone, lineWidth, SkeletonCard, SkeletonPage, SkeletonPageHeader } from "@/components/ui/skeleton";

/**
 * Fallback while a signed-in page without its own skeleton loads (redone
 * 2026-11-16 to match the list pages most of them are): the page header, a
 * search box, then a table card. Pages with a different shape have their own
 * loading.tsx next to them.
 */
export default function Loading() {
  return (
    <SkeletonPage label="Loading page">
      <SkeletonPageHeader action />
      <Bone className="mb-5 h-9 w-full max-w-sm rounded-[8px]" soft />
      <SkeletonCard>
        <div className="flex gap-6 border-b border-zinc-100 px-5 py-3">
          {[90, 70, 120, 80].map((w) => (
            <Bone key={w} className="h-2.5" style={{ width: w }} soft />
          ))}
        </div>
        <div className="divide-y divide-zinc-100">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex items-center gap-6 px-5 py-3.5">
              <Bone className="h-3.5 w-40" />
              <Bone className="hidden h-3 sm:block" style={{ width: lineWidth(i, 22, 10) }} soft />
              <Bone className="hidden h-3 md:block" style={{ width: lineWidth(i, 26, 12) }} soft />
              <Bone className="ml-auto h-3 w-16" soft />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </SkeletonPage>
  );
}
