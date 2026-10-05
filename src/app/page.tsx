import type { Metadata } from "next";

import { MarketingHome } from "./marketing-home";

/**
 * The public, customer-facing home page (confirmed directly, 2026-10-03):
 * "i want a customer facing public page and it should be on home page."
 * Previously `/` just redirected straight to `/dashboard` — the app had no
 * marketing surface at all. The dashboard itself is untouched and still
 * lives at `/dashboard`, reachable from the sidebar as it always was.
 *
 * Deliberately NOT checking `getCurrentActor()` here to personalise the nav
 * for a signed-in visitor: that read depends on cookies, which would force
 * this entire page into per-request dynamic rendering (the exact
 * `(app)/layout.tsx` `force-dynamic` trade-off, but paid on a page that
 * should instead be static, cached and fast for an anonymous, SEO-indexed
 * audience — see `src/lib/db/prisma.ts` for how real that round-trip cost
 * is). A signed-in visitor clicking "Sign in" from here just lands on
 * `/login`, which redirects them straight to `/dashboard` already
 * (`src/proxy.ts`) — one extra, cheap hop, not a dead end.
 *
 * `title: { absolute: ... }` bypasses the root layout's
 * `"%s · Business Manager"` template on purpose — this page is the public
 * "Grow Xeno" brand, not an internal Business Manager screen, and
 * `robots` overrides the root layout's site-wide `noindex` (correct for an
 * internal tool, wrong for the one page meant to be found by customers).
 */
export const metadata: Metadata = {
  title: { absolute: "Grow Xeno — Digital Growth, Delivered Honestly" },
  description:
    "YouTube & TikTok monetization, Google AdSense, social media marketing, website design and Shopify growth — verified before it's called delivered.",
  robots: { index: true, follow: true },
};

export default function HomePage() {
  return <MarketingHome />;
}
