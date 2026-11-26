import type { Metadata } from "next";
import { Instrument_Serif, Inter, Inter_Tight } from "next/font/google";
import Image from "next/image";
import Link from "next/link";

import { SITE_HOME } from "@/lib/routing/hosts";

export const metadata: Metadata = {
  title: { absolute: "Privacy Policy — Grow Xeno" },
  description: "How Grow Xeno collects, uses and protects your personal information.",
  robots: { index: true, follow: true },
};

const bodyFont = Inter({ subsets: ["latin"], variable: "--font-gx-body", display: "swap" });
const displayFont = Inter_Tight({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-gx-display", display: "swap" });
const serifFont = Instrument_Serif({ subsets: ["latin"], weight: "400", style: "italic", variable: "--font-gx-serif", display: "swap" });

const EFFECTIVE_DATE = "26 November 2026";
const CONTACT_EMAIL = "privacy@growxeno.com";

export default function PrivacyPage() {
  return (
    <div className={`${bodyFont.variable} ${displayFont.variable} ${serifFont.variable} gxo min-h-dvh bg-[var(--gx-bg)]`}>
      {/* Nav */}
      <header className="border-b border-[var(--gx-line)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href={SITE_HOME} className="flex items-center gap-2.5 rounded-[6px]">
            <Image src="/brand/gx-symbol-light.svg" alt="" aria-hidden width={1050} height={780} className="h-6 w-auto" />
            <span className="gx-display text-sm font-semibold tracking-[-0.03em] text-[var(--gx-text)]">Grow Xeno</span>
          </Link>
          <Link href={SITE_HOME} className="text-sm text-[var(--gx-muted)] transition-colors hover:text-[var(--gx-text)]">
            ← Back to site
          </Link>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
        <p className="mb-3 text-xs uppercase tracking-widest text-[var(--gx-dim)]">Legal</p>
        <h1 className="gx-display text-3xl font-semibold leading-tight tracking-[-0.03em] text-[var(--gx-text)] sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-[var(--gx-muted)]">Effective date: {EFFECTIVE_DATE}</p>

        <div className="prose-policy mt-12 space-y-10 text-[0.9375rem] leading-[1.75] text-[var(--gx-muted)]">

          <Section title="Who we are">
            <p>
              Grow Xeno provides digital growth services — YouTube monetization, TikTok growth, Google AdSense
              setup, social media management, website and app design, Shopify growth, and backlinks and guest
              posts. We operate worldwide and are remote-first. When this policy says <strong className="text-[var(--gx-text)]">"Grow Xeno"</strong>,
              {" "}<strong className="text-[var(--gx-text)]">"we"</strong>, <strong className="text-[var(--gx-text)]">"us"</strong> or{" "}
              <strong className="text-[var(--gx-text)]">"our"</strong>, it means the Grow Xeno business.
            </p>
            <p>
              Questions about this policy or your data can be sent to{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--gx-accent)] underline underline-offset-4 hover:opacity-80">
                {CONTACT_EMAIL}
              </a>.
            </p>
          </Section>

          <Section title="What information we collect">
            <p>We only collect what you give us directly:</p>
            <ul>
              <li>
                <strong className="text-[var(--gx-text)]">Contact and enquiry information</strong> — your name, email address, and the
                content of any message you send us through the contact form or by email. This is the only
                personal data collected on this website.
              </li>
              <li>
                <strong className="text-[var(--gx-text)]">Service-related information</strong> — once you become a client, we may hold
                details needed to deliver your order: account credentials you share with us for handover
                purposes, payment records, and correspondence. This is handled under a separate service
                agreement.
              </li>
            </ul>
            <p>
              We do not use cookies, tracking pixels, or analytics scripts on this website. We do not collect
              data passively through your visit.
            </p>
          </Section>

          <Section title="How we use your information">
            <p>We use the information you send us to:</p>
            <ul>
              <li>Respond to your enquiry or question</li>
              <li>Prepare and send you a quote for the service you asked about</li>
              <li>Carry out work you have engaged us for</li>
              <li>Communicate with you about an ongoing or completed order</li>
            </ul>
            <p>We do not sell, rent or share your personal information with third parties for marketing.</p>
          </Section>

          <Section title="Legal basis for processing (UK and EU visitors)">
            <p>
              If you are in the UK or European Economic Area, we process your personal data under the following
              lawful bases:
            </p>
            <ul>
              <li>
                <strong className="text-[var(--gx-text)]">Legitimate interests</strong> — responding to an enquiry you initiated and
                providing the service you asked about
              </li>
              <li>
                <strong className="text-[var(--gx-text)]">Contract performance</strong> — where we have agreed to deliver a service to
                you
              </li>
              <li>
                <strong className="text-[var(--gx-text)]">Legal obligation</strong> — where we are required to retain records by law
              </li>
            </ul>
          </Section>

          <Section title="How long we keep your data">
            <p>
              Enquiries that do not lead to an engagement are deleted within 12 months of your last message.
              Records relating to completed orders are kept for up to 7 years for accounting and legal purposes,
              then deleted. You can ask us to delete your data earlier — see your rights below.
            </p>
          </Section>

          <Section title="Third-party services">
            <p>
              We use a small number of tools to operate the business. These may process your data on our behalf:
            </p>
            <ul>
              <li>
                <strong className="text-[var(--gx-text)]">Email provider</strong> — to receive and send messages
              </li>
              <li>
                <strong className="text-[var(--gx-text)]">Payment processor</strong> — to handle invoices and payments, where
                applicable; their own privacy policy governs that processing
              </li>
            </ul>
            <p>
              We do not use Google Analytics, Meta Pixel, or any other advertising or tracking technology on
              this website.
            </p>
          </Section>

          <Section title="Your rights">
            <p>
              Wherever you are in the world, you can contact us at any time to:
            </p>
            <ul>
              <li>Ask what personal data we hold about you</li>
              <li>Ask us to correct inaccurate data</li>
              <li>Ask us to delete your data</li>
              <li>Ask us to stop contacting you</li>
            </ul>
            <p>
              If you are in the UK or EEA, you also have the right to data portability and to lodge a complaint
              with your local supervisory authority (in the UK, the ICO at{" "}
              <a href="https://ico.org.uk" target="_blank" rel="noreferrer" className="text-[var(--gx-accent)] underline underline-offset-4 hover:opacity-80">
                ico.org.uk
              </a>
              ).
            </p>
            <p>
              To exercise any of these rights, email us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--gx-accent)] underline underline-offset-4 hover:opacity-80">
                {CONTACT_EMAIL}
              </a>
              . We will respond within 30 days.
            </p>
          </Section>

          <Section title="Security">
            <p>
              We take reasonable steps to protect the information you send us. Email is not an inherently
              secure channel — if you need to share sensitive account credentials as part of a service handover,
              we will agree a secure method with you in advance.
            </p>
          </Section>

          <Section title="Children">
            <p>
              This website is not directed at children under 16. We do not knowingly collect personal
              information from anyone under 16. If you believe a child has sent us personal data, contact us and
              we will delete it promptly.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We may update this policy from time to time. When we do, we will update the effective date at the
              top of the page. We will not notify you of minor clarifications, but if the changes are material
              we will make them visible on the site.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              For anything related to this policy or your personal data:
            </p>
            <p>
              <strong className="text-[var(--gx-text)]">Grow Xeno</strong>
              <br />
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--gx-accent)] underline underline-offset-4 hover:opacity-80">
                {CONTACT_EMAIL}
              </a>
            </p>
          </Section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--gx-line)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5 text-xs text-[var(--gx-dim)]">
          <span>© {new Date().getFullYear()} Grow Xeno. All rights reserved.</span>
          <Link href={SITE_HOME} className="transition-colors hover:text-[var(--gx-text)]">
            growxeno.com
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="gx-display mb-4 text-base font-semibold tracking-[-0.02em] text-[var(--gx-text)]">
        {title}
      </h2>
      <div className="space-y-4 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2">{children}</div>
    </section>
  );
}
