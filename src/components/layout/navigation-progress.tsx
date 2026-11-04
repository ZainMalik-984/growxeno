"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { TopProgressBar } from "./top-progress-bar";

/**
 * Thin indigo bar at the top of the window that starts the moment an internal
 * link is clicked and disappears when the new page arrives (2026-11-03).
 * Covers the gap before the next page can show its loading skeleton (about a
 * second in development, where loading states are not prefetched); the
 * skeleton then shows the same bar until the content arrives.
 *
 * "Pending" is stored together with the URL it started from, so the bar hides
 * by DERIVATION when the URL changes — no setState inside an effect.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = `${pathname}?${searchParams.toString()}`;
  const [startedFrom, setStartedFrom] = useState<string | null>(null);
  // Any URL change ends the pending state — including Back/Forward, so a stale
  // "started from" can never re-show the bar when you later return to that page.
  // (React's "adjust state when a value changes" pattern: set during render.)
  const [lastUrl, setLastUrl] = useState(currentUrl);
  if (currentUrl !== lastUrl) {
    setLastUrl(currentUrl);
    setStartedFrom(null);
  }
  const active = startedFrom !== null && startedFrom === currentUrl;

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const next = `${url.pathname}?${url.searchParams.toString()}`;
      const here = `${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`;
      if (next === here) return;
      setStartedFrom(here);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!active) return null;

  return <TopProgressBar phase="start" />;
}
