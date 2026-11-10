import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * A category's image, or its first letter when it has none (2026-11-05).
 * Kept apart from the image picker so lists and the service picker can use it
 * without loading the upload actions.
 */
export function CategoryThumb({ name, imageUrl, size = 36, className }: { name: string; imageUrl: string | null; size?: number; className?: string }) {
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-[8px] bg-zinc-100 text-zinc-500 ring-1 ring-inset ring-zinc-200/80", className)}
      style={{ width: size, height: size }}
    >
      {imageUrl ? (
        <Image src={imageUrl} alt="" fill sizes={`${size}px`} className="object-cover" />
      ) : (
        <span aria-hidden="true" className="text-xs font-semibold uppercase">
          {name.trim()[0] ?? "?"}
        </span>
      )}
    </span>
  );
}
