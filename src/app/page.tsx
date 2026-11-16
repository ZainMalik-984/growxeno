import type { Metadata } from "next";
import { Instrument_Serif, Inter, Inter_Tight } from "next/font/google";

import { getSiteContact } from "@/lib/settings/queries";
import { MarketingHome } from "./marketing-home";

/**
 * Prerendered and cached; regenerated at most hourly, and straight away when
 * a Super Admin saves the contact details (saveSiteContactAction calls
 * revalidatePath("/")). Still no cookies or per-visitor reads here.
 */
export const revalidate = 3600;

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
 * Fonts (2026-11-16 premium redesign): Inter Tight for display type, Instrument
 * Serif italic for emphasis, Inter for body text and labels, self-hosted
 * through next/font. A Google Fonts <link> is blocked by this app's CSP
 * (style-src 'self'), which is why the earlier Geist link never loaded.
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

const bodyFont = Inter({ subsets: ["latin"], variable: "--font-gx-body", display: "swap" });
const displayFont = Inter_Tight({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-gx-display", display: "swap" });
const serifFont = Instrument_Serif({ subsets: ["latin"], weight: "400", style: "italic", variable: "--font-gx-serif", display: "swap" });

export default async function HomePage() {
  const contact = await getSiteContact();
  return (
    <div className={`${bodyFont.variable} ${displayFont.variable} ${serifFont.variable}`}>
      <MarketingHome contact={contact} />
    </div>
  );
}
