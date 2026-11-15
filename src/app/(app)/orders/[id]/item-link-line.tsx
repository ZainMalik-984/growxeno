import { BarChart3, Link2 } from "lucide-react";

import type { ItemLinkParts } from "@/lib/youtube/link-parts";

/**
 * The item's link under the service name in its header (owner request,
 * 2026-11-14): "@username | link icon | Studio".
 */
export function ItemLinkLine({ parts }: { parts: ItemLinkParts }) {
  return (
    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
      <a
        href={parts.href}
        target="_blank"
        rel="noreferrer noopener"
        className="min-w-0 max-w-full truncate font-medium text-indigo-600 hover:underline"
      >
        {parts.label}
      </a>
      {parts.idHref ? (
        <>
          <span aria-hidden="true" className="text-zinc-300">|</span>
          <a
            href={parts.idHref}
            target="_blank"
            rel="noreferrer noopener"
            title="Open by channel ID"
            aria-label="Open by channel ID"
            className="inline-flex size-6 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900"
          >
            <Link2 aria-hidden="true" className="size-4" />
          </a>
        </>
      ) : null}
      {parts.studioHref ? (
        <>
          <span aria-hidden="true" className="text-zinc-300">|</span>
          <a
            href={parts.studioHref}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-6 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 shadow-[0_1px_1px_rgba(16,24,40,0.04)] hover:bg-zinc-50"
          >
            <BarChart3 aria-hidden="true" className="size-3.5 text-zinc-500" />
            Studio
          </a>
        </>
      ) : null}
    </div>
  );
}
