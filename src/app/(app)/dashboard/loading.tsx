import { Bone, lineWidth, SkeletonCard, SkeletonPage } from "@/components/ui/skeleton";

/** Shaped like the Dashboard (2026-11-16): greeting, the four-figure strip, panels, side column. */
export default function DashboardLoading() {
  return (
    <SkeletonPage label="Loading dashboard">
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <Bone className="h-3 w-36" soft />
          <Bone className="mt-2 h-7 w-64 rounded-[8px]" />
        </div>
        <Bone className="h-9 w-32 rounded-[8px]" />
      </div>

      <SkeletonCard className="grid grid-cols-2 overflow-hidden lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2 border-zinc-100 p-4 sm:p-5 [&:not(:first-child)]:border-l max-lg:[&:nth-child(3)]:border-l-0 max-lg:[&:nth-child(n+3)]:border-t">
            <Bone className="h-2.5 w-20" soft />
            <Bone className="h-7 w-12 rounded-[8px]" />
            <Bone className="h-2.5 w-24" soft />
          </div>
        ))}
      </SkeletonCard>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Panel rows={4} />
          <Panel rows={3} />
        </div>
        <div className="space-y-6">
          <Panel rows={4} narrow />
        </div>
      </div>
    </SkeletonPage>
  );
}

function Panel({ rows, narrow = false }: { rows: number; narrow?: boolean }) {
  return (
    <SkeletonCard className="overflow-hidden">
      <div className="flex items-start justify-between px-4 pb-3 pt-4 sm:px-5">
        <div className="space-y-2">
          <Bone className="h-4 w-32" />
          {!narrow ? <Bone className="h-2.5 w-56" soft /> : null}
        </div>
        {!narrow ? <Bone className="h-3 w-16" soft /> : null}
      </div>
      <div className="divide-y divide-zinc-100 border-t border-zinc-100">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="space-y-2 px-4 py-3.5 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <Bone className="h-3.5" style={{ width: lineWidth(i, 45, 15) }} />
              {!narrow ? <Bone className="h-5 w-20" soft /> : <Bone className="h-3.5 w-14" />}
            </div>
            <Bone className="h-2.5 w-28" soft />
            {!narrow ? (
              <>
                <Bone className="h-1.5 w-full" soft />
                <div className="flex justify-between">
                  <Bone className="h-2.5 w-48" soft />
                  <Bone className="h-3 w-20" />
                </div>
              </>
            ) : null}
          </div>
        ))}
      </div>
    </SkeletonCard>
  );
}
