import type { CSSProperties, ReactNode } from "react";

import { TopProgressBar } from "@/components/layout/top-progress-bar";
import { cn } from "@/lib/utils";

/**
 * Loading placeholders shaped like the real pages (owner request, 2026-11-16:
 * "the skeleton should match the actual UI" and "animate fast"). Every piece
 * shimmers with the `.sk` sweep (globals.css). Server components only: no
 * client JS, so a route's loading.tsx is prefetched and shows instantly.
 */

export function SkeletonPage({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      <TopProgressBar phase="loading" />
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}

/** A shimmering block. */
export function Bone({ className, style, soft = false }: { className?: string; style?: CSSProperties; soft?: boolean }) {
  return <div aria-hidden="true" className={cn("sk rounded-full", soft && "sk-soft", className)} style={style} />;
}

/** The raised white card used across the app. */
export function SkeletonCard({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-[12px] border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-14px_rgba(16,24,40,0.12)] max-md:-mx-4 max-md:rounded-none max-md:border-x-0 max-md:shadow-none",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Breadcrumb, title and description, with an action on the right — the PageHeader layout. */
export function SkeletonPageHeader({ breadcrumb = true, description = true, action = false, titleWidth = 160 }: { breadcrumb?: boolean; description?: boolean; action?: boolean; titleWidth?: number }) {
  return (
    <>
      {breadcrumb ? <Bone className="mb-4 hidden h-3 w-40 md:block" /> : null}
      <div className="mb-6 flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <Bone className="h-7 rounded-[8px]" style={{ width: titleWidth }} />
          {description ? <Bone className="mt-2 h-3 w-72 max-w-full" /> : null}
        </div>
        {action ? <Bone className="h-9 w-32 rounded-[8px]" /> : null}
      </div>
    </>
  );
}

/** A progress ring placeholder. */
export function SkeletonRing({ size = 44 }: { size?: number }) {
  return <div aria-hidden="true" className="shrink-0 rounded-full border-[4px] border-zinc-200/80" style={{ width: size, height: size }} />;
}

/** Varying widths so lines don't look stamped. */
export const lineWidth = (i: number, max = 90, spread = 35) => `${max - ((i * 13) % spread)}%`;

/** A titled Section card (components/ui/page Section). */
export function SkeletonSection({ titleWidth = 96, children }: { titleWidth?: number; children: ReactNode }) {
  return (
    <SkeletonCard className="mb-6 p-5 sm:p-6">
      {titleWidth > 0 ? <Bone className="mb-5 h-4" style={{ width: titleWidth }} /> : null}
      {children}
    </SkeletonCard>
  );
}

/** Labelled inputs in one column, the app's form layout (max-w-lg), ending in a button. */
export function SkeletonForm({ fields = 5, textarea = false }: { fields?: number; textarea?: boolean }) {
  return (
    <div className="max-w-lg space-y-5">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2">
          <Bone className="h-3" style={{ width: 70 + ((i * 23) % 50) }} soft />
          <Bone className="h-9 w-full rounded-[8px]" soft />
        </div>
      ))}
      {textarea ? (
        <div className="space-y-2">
          <Bone className="h-3 w-16" soft />
          <Bone className="h-24 w-full rounded-[8px]" soft />
        </div>
      ) : null}
      <Bone className="h-9 w-32 rounded-[8px]" />
    </div>
  );
}

/** Label / value pairs in the MetaList grid. */
export function SkeletonMeta({ items = 4 }: { items?: number }) {
  return (
    <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: items }, (_, i) => (
        <div key={i} className="space-y-2">
          <Bone className="h-2.5 w-16" soft />
          <Bone className="h-3.5" style={{ width: 90 + ((i * 29) % 60) }} />
        </div>
      ))}
    </div>
  );
}

/** Rows of a plain list or table inside a card. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-zinc-100">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 py-3">
          <Bone className="h-3.5" style={{ width: lineWidth(i, 35, 12) }} />
          <Bone className="ml-auto h-3 w-20" soft />
        </div>
      ))}
    </div>
  );
}
