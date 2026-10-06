import type { Metadata } from "next";

import { MarketingHome } from "./marketing-home";

/**
 * The public, customer-facing home page. Content, metadata and copy ported
 * verbatim from growxeno-project/src/routes/index.tsx and __root.tsx,
 * confirmed directly (2026-10-05): "exactly same design and structure and
 * UI and UX nothing changed just convert this in our home page."
 *
 * Previously `/` just redirected straight to `/dashboard` — the app had no
 * marketing surface at all (confirmed directly, 2026-10-03). The dashboard
 * itself is untouched and still lives at `/dashboard`, reachable from the
 * sidebar as it always was — see src/app/marketing-home.tsx's header
 * comment for why this page has no link back to it.
 *
 * Deliberately NOT checking `getCurrentActor()` here to personalise
 * anything for a signed-in visitor: that read depends on cookies, which
 * would force this entire page into per-request dynamic rendering — see
 * src/lib/db/prisma.ts for how real that round-trip cost is. This page
 * should stay static, cached and fast for an anonymous, SEO-indexed
 * audience.
 *
 * `title: { absolute: ... }` bypasses the root layout's
 * `"%s · Business Manager"` template on purpose — this page is the public
 * Grow Xeno brand, not an internal Business Manager screen — and `robots`
 * overrides the root layout's site-wide `noindex` (correct for an internal
 * tool, wrong for the one page meant to be found by customers).
 *
 * The Geist/Geist Mono stylesheet link below is the exact one
 * growxeno-project's root route links (its `styles.css` theme assumes this
 * family) — not `next/font/google`, which doesn't package Geist in this
 * Next.js version.
 */
export const metadata: Metadata = {
  title: { absolute: "Grow Xeno — Monetization, growth & web services, verified before handover" },
  description:
    "YouTube monetization, TikTok growth, Google AdSense, SMM panels, website & app design and Shopify growth. Clear quotes, verified delivery, direct support. Worldwide.",
  openGraph: {
    title: "Grow Xeno — Digital growth services you can verify",
    description: "Monetization, AdSense, social growth and web & store builds — checked before handover, supported after.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: { index: true, follow: true },
};

export default function HomePage() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Geist:wght@400..700&family=Geist+Mono:wght@400;500&display=swap"
      />
      <MarketingHome />
    </>
  );
}
