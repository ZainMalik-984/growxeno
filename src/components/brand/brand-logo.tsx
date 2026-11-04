import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Grow Xeno brand marks. Source files live in /Archive; the web-ready copies
 * are in /public/brand (the browser-tab icon is src/app/icon.svg).
 */

/** The GX monogram on its own — for tight spaces like the sidebar. */
export function BrandSymbol({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/gx-symbol.svg"
      alt=""
      aria-hidden="true"
      width={1050}
      height={780}
      className={cn("h-7 w-auto", className)}
      priority
    />
  );
}

/** Monogram + "Grow Xeno" + tagline, for headers and the sign-in page. */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/grow-xeno-wordmark.png"
      alt="Grow Xeno — Your partner in digital growth"
      width={720}
      height={171}
      className={cn("h-10 w-auto", className)}
      priority
    />
  );
}
