"use client";

import { Code2, Mail, Phone, Share2 } from "lucide-react";
import { createContext, useContext, useState, useTransition, type ComponentType, type FormEvent, type ReactNode } from "react";
import { SiFacebook, SiGoogleadsense, SiInstagram, SiShopify, SiTiktok, SiWhatsapp, SiX, SiYoutube } from "react-icons/si";

import { BrandWordmark } from "@/components/brand/brand-logo";
import { submitInquiryAction } from "@/lib/inquiries/actions";
import { HONEYPOT_FIELD } from "@/lib/inquiries/schema";
import { DEFAULT_SITE_CONTACT, telHref, whatsappHref, type SiteContact } from "@/lib/settings/site-contact";

/**
 * Ported verbatim from growxeno-project/src/routes/index.tsx, confirmed
 * directly (2026-10-05): "this project has the correct UI for the frontend
 * of Growxeno, apply this completely in current project, exactly same
 * design and structure and UI and UX nothing changed just convert this in
 * our home page." Structure, copy, classNames and component boundaries are
 * unchanged from the source. What changed is only what the framework swap
 * (TanStack Router/Vite -> Next.js App Router) required:
 *
 *  - Route metadata (`createFileRoute(...).head`) moved to this app's own
 *    `metadata` export in src/app/page.tsx.
 *  - The hero image import became a plain `/grow-xeno-hero.jpg` path served
 *    from `public/`, instead of a Vite asset import.
 *  - The whole page is one Client Component (the source is a Vite SPA, so
 *    everything was already client-rendered) rather than split into Server
 *    and Client Components — this preserves the exact original behaviour
 *    rather than risking a subtly different one by splitting it.
 *  - The source page has no link back into the internal app (no "Sign in").
 *    That's intentional fidelity to "nothing changed" — see docs/ or ask
 *    before assuming one should be added back.
 *
 * Theme tokens (colours, radius, the Geist typeface) are scoped to the `.gx`
 * class on the root element, not the app's global tokens — see the "Grow
 * Xeno" block at the bottom of src/app/globals.css for why.
 *
 * Service icons (confirmed directly, 2026-10-05: "use logos of the social
 * apps thats being used") are the one deliberate addition on top of the
 * verbatim port above — real platform marks (react-icons/si) for the four
 * services that name an actual platform, generic lucide icons for the two
 * that don't. Rendered in the surrounding text colour, not each brand's own
 * colour — this page's palette is deliberately restrained (one primary
 * accent, not a different hue per card), and four unrelated brand colours
 * side by side would fight that rather than fit it.
 */

/**
 * Contact details come from Settings → Website → Contact details (2026-11-04),
 * passed in from the server page and read here through context so every
 * section uses the same values. Phone and WhatsApp only appear when set.
 */
const ContactContext = createContext<SiteContact>(DEFAULT_SITE_CONTACT);
const useContact = () => useContext(ContactContext);

/**
 * WhatsApp and social profiles as logo buttons (2026-11-04). Only the ones
 * set in Settings appear; nothing renders when none are set. WhatsApp opens
 * with the message from Settings already typed in.
 */
function SocialLinks({ tone = "light", size = "md", className = "" }: { tone?: "light" | "dark"; size?: "sm" | "md"; className?: string }) {
  const { whatsapp, whatsappMessage, instagram, twitter, facebook } = useContact();
  const links = [
    whatsapp ? { label: "WhatsApp", href: whatsappHref(whatsapp, whatsappMessage), Icon: SiWhatsapp } : null,
    instagram ? { label: "Instagram", href: instagram, Icon: SiInstagram } : null,
    twitter ? { label: "X (Twitter)", href: twitter, Icon: SiX } : null,
    facebook ? { label: "Facebook", href: facebook, Icon: SiFacebook } : null,
  ].filter((link) => link !== null);
  if (links.length === 0) return null;
  const box = size === "sm" ? "h-7 w-7" : "h-10 w-10";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-[18px] w-[18px]";
  const colors =
    tone === "dark"
      ? "border-navy-line text-navy-muted hover:border-navy-foreground/40 hover:text-navy-foreground"
      : "border-input bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground";
  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`}>
      {links.map(({ label, href, Icon }) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={label}
            title={label}
            className={`grid ${box} place-items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${colors}`}
          >
            <Icon className={icon} />
          </a>
        </li>
      ))}
    </ul>
  );
}

/* ---------- content (source: growxeno.com) ---------- */

type Service = {
  id: string;
  name: string;
  short: string;
  audience: string;
  summary: string;
  includes: string[];
  target: [string, string][];
  outcome: string;
  icon: ComponentType<{ className?: string }>;
};

const services: Service[] = [
  {
    id: "youtube",
    icon: SiYoutube,
    name: "YouTube Monetization",
    short: "Channels built to Partner Program eligibility",
    audience: "Creators and buyers who want a monetization-ready channel",
    summary:
      "We build channels up to YouTube's monetization threshold, and handle buying and selling of channels that are already monetized.",
    includes: ["Channel growth to the eligibility threshold", "Buying already-monetized channels", "Selling your monetized channel", "Handover walkthrough & securing the account"],
    target: [["Subscribers", "1,000"], ["Watch hours", "4,000"]],
    outcome: "A channel that meets YouTube's monetization requirements — verified before it's handed over.",
  },
  {
    id: "tiktok",
    icon: SiTiktok,
    name: "TikTok Growth",
    short: "Accounts grown to monetization eligibility",
    audience: "Creators and brands who need an eligible TikTok presence",
    summary:
      "Accounts grown to 10,000 followers with 1M+ views in the trailing 28 days — monetization-eligible. We also buy and sell established accounts.",
    includes: ["Follower growth to eligibility", "Qualified view volume in the trailing 28 days", "Buying & selling accounts", "Direct handover with walkthrough"],
    target: [["Followers", "10,000"], ["Views / 28 days", "1M+"]],
    outcome: "A monetization-eligible TikTok account, checked against the numbers that were agreed.",
  },
  {
    id: "adsense",
    icon: SiGoogleadsense,
    name: "Google AdSense",
    short: "Approval support and pin-verified accounts",
    audience: "Website owners and publishers ready to earn from ads",
    summary:
      "AdSense approval support for sites across Pakistan, the UK, the US, India and beyond — plus fresh, pin-verified AdSense accounts.",
    includes: ["Approval support for your website", "Fresh, pin-verified accounts", "Guidance across multiple regions", "Post-delivery support"],
    target: [["Regions", "PK · UK · US · IN +"], ["Accounts", "Pin-verified"]],
    outcome: "An approved, working AdSense setup so your site can start earning.",
  },
  {
    id: "smm",
    icon: Share2,
    name: "Social Media Marketing",
    short: "SMM panels three ways, plus coaching",
    audience: "Marketers and resellers building a social media business",
    summary:
      "SMM panel access the way that suits you — your own panel, a rented panel, or a reseller setup — plus hands-on marketing coaching.",
    includes: ["Your own SMM panel", "Rented panel access", "Reseller setup", "Hands-on marketing coaching"],
    target: [["Panel options", "Own · Rent · Resell"], ["Coaching", "Included option"]],
    outcome: "A working panel setup and the know-how to run it.",
  },
  {
    id: "web",
    icon: Code2,
    name: "Website & App Design",
    short: "Websites, web apps and SaaS products",
    audience: "Businesses that need a site or product that represents them properly",
    summary:
      "User-friendly websites and web apps, SaaS products included — built so your digital presence actually represents your business.",
    includes: ["Business websites", "Web applications", "SaaS products", "Usability-focused design"],
    target: [["Scope", "Sites · Apps · SaaS"], ["Focus", "Usability"]],
    outcome: "A site or app your customers find easy to use — and you're proud to send people to.",
  },
  {
    id: "shopify",
    icon: SiShopify,
    name: "Shopify Growth",
    short: "SEO, Google Ads and technical fixes",
    audience: "Owners of existing Shopify stores who want more sales",
    summary:
      "SEO and Google Ads to grow an existing store, plus hands-on help resolving the technical issues that quietly cost you sales.",
    includes: ["Store SEO", "Google Ads campaigns", "Technical issue resolution", "Ongoing growth support"],
    target: [["Channels", "SEO · Google Ads"], ["Store", "Existing Shopify"]],
    outcome: "More qualified traffic and fewer technical leaks in your store.",
  },
];

const steps = [
  { t: "Tell us what you need", d: "Send a quick message about your goal — a channel, an account, a store or a site.", when: "Day one" },
  { t: "Get a straight quote", d: "A clear price for exactly what you asked for. No bundled upsells.", when: "Before any payment" },
  { t: "We deliver & verify", d: "The work is checked against what was promised before it's called done.", when: "Before handover" },
  { t: "Ongoing support", d: "Questions after delivery get answered. It isn't a one-and-done handoff.", when: "After delivery" },
];

const faqs: [string, string][] = [
  ["How is a channel or account “delivered”?", "Account credentials and any required transfer steps are handed over directly, with a walkthrough so you know exactly what you're receiving and how to secure it."],
  ["What if the numbers don't match what was promised?", "Delivery is verified against what was agreed before handover. If anything doesn't match, raise it with us directly and we'll work through it with you as part of after-delivery support."],
  ["Do you only work with clients in Pakistan?", "No. Grow Xeno is remote-first and works with clients worldwide."],
  ["Can I get ongoing marketing help, not just a one-time account?", "Yes. Alongside one-time deliveries we offer hands-on marketing coaching and ongoing growth work for stores and brands."],
  ["Will I be pushed into a bigger package?", "No. You get a quote for exactly what you asked for — we don't bundle in extras you didn't request."],
];

/* ---------- primitives ---------- */

function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1200px] px-5 md:px-8 ${className}`}>{children}</div>;
}

function Btn({ href, children, variant = "primary", className = "" }: { href: string; children: ReactNode; variant?: "primary" | "outline" | "light"; className?: string }) {
  const v = {
    primary: "bg-primary text-primary-foreground hover:brightness-110 shadow-sm",
    outline: "border border-input bg-background text-foreground hover:bg-secondary",
    light: "bg-navy-foreground text-navy hover:bg-background",
  }[variant];
  return (
    <a href={href} className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-[0.9375rem] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${v} ${className}`}>
      {children}
    </a>
  );
}

function Tick({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`shrink-0 ${className}`} aria-hidden>
      <circle cx="10" cy="10" r="10" className="fill-accent" />
      <path d="M6 10.2l2.6 2.6L14 7.5" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="stroke-primary" />
    </svg>
  );
}

function SectionHead({ kicker, title, sub, center }: { kicker: string; title: string; sub?: string; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="kicker">{kicker}</p>
      <h2 className="mt-3 text-3xl font-semibold md:text-[2.5rem] md:leading-[1.1]">{title}</h2>
      {sub && <p className="mt-4 text-lg text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* ---------- page ---------- */

export function MarketingHome({ contact = DEFAULT_SITE_CONTACT }: { contact?: SiteContact }) {
  return (
    <ContactContext.Provider value={contact}>
    <div className="gx min-h-screen">
      <Header />
      <main>
        <Hero />
        <Services />
        <Audience />
        <Difference />
        <Process />
        <Faq />
        <Contact />
      </main>
      <Footer />
      <MobileCta />
    </div>
    </ContactContext.Provider>
  );
}

function Header() {
  const { email: EMAIL, phone } = useContact();
  const [open, setOpen] = useState(false);
  const links: [string, string][] = [["Services", "#services"], ["Why us", "#why"], ["Process", "#process"], ["FAQ", "#faq"]];
  return (
    <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur">
      <div className="hidden border-b bg-navy text-navy-muted md:block">
        <Container className="flex h-9 items-center justify-between text-xs">
          <span>Remote-first · Serving clients worldwide</span>
          <span className="flex items-center gap-4">
            {phone ? (
              <a href={telHref(phone)} className="inline-flex items-center gap-1.5 hover:text-navy-foreground transition-colors">
                <Phone className="h-3 w-3" aria-hidden />{phone}
              </a>
            ) : null}
            <a href={`mailto:${EMAIL}`} className="inline-flex items-center gap-1.5 hover:text-navy-foreground transition-colors">
              <Mail className="h-3 w-3" aria-hidden />{EMAIL}
            </a>
            <SocialLinks tone="dark" size="sm" className="gap-1.5" />
          </span>
        </Container>
      </div>
      <Container className="flex h-16 items-center justify-between">
        <a href="#top" className="flex items-center" aria-label="Grow Xeno home">
          <BrandWordmark className="h-10" />
        </a>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map(([l, h]) => (
            <a key={h} href={h} className="rounded-md px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">{l}</a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Btn href={`mailto:${EMAIL}`} variant="outline" className="h-10">Email us</Btn>
          <Btn href="#contact" className="h-10">Book a meeting</Btn>
        </div>
        <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Toggle menu" className="grid h-10 w-10 place-items-center rounded-md border md:hidden">
          <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
            {open ? <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" /> : <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" />}
          </svg>
        </button>
      </Container>
      {open && (
        <div className="border-t bg-background md:hidden">
          <Container className="py-3">
            {links.map(([l, h]) => (
              <a key={h} href={h} onClick={() => setOpen(false)} className="flex items-center justify-between border-b py-4 font-medium last:border-0">
                {l} <span className="text-muted-foreground">→</span>
              </a>
            ))}
            <div className="grid grid-cols-2 gap-2 py-4">
              <Btn href={`mailto:${EMAIL}`} variant="outline">Email us</Btn>
              <Btn href="#contact">Book a meeting</Btn>
            </div>
            {/* The contact bar above the header is desktop-only, so its details live here on phones. */}
            <div className="space-y-2.5 border-t pt-4 pb-2 text-sm text-muted-foreground">
              {phone ? (
                <a href={telHref(phone)} className="flex items-center gap-2 hover:text-foreground"><Phone className="h-4 w-4" aria-hidden />{phone}</a>
              ) : null}
              <a href={`mailto:${EMAIL}`} className="flex items-center gap-2 break-all hover:text-foreground"><Mail className="h-4 w-4 shrink-0" aria-hidden />{EMAIL}</a>
              <SocialLinks size="sm" className="pt-1" />
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-surface">
      <Container className="grid items-center gap-12 py-14 md:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div className="animate-fade-up">
          <span className="mt-2 block text-sm font-medium text-muted-foreground">Digital growth services, run honestly</span>
          <h1 className="mt-5 text-[2.5rem] font-semibold leading-[1.05] md:text-6xl">
            Real growth for your channels, store and brand.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Grow Xeno handles YouTube and TikTok monetization, Google AdSense, social media marketing, and website &amp; Shopify builds. Every delivery is verified before handover — and supported after it.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Btn href="#contact" className="h-12 px-6">Book a meeting →</Btn>
            <Btn href="#services" variant="outline" className="h-12 px-6">Explore services</Btn>
          </div>
          <ul className="mt-10 grid gap-3 border-t pt-6 text-sm sm:grid-cols-3">
            {["Verified before handover", "Direct communication, no ticket queue", "No bundled upsells"].map((t) => (
              <li key={t} className="flex items-start gap-2.5"><Tick className="mt-0.5 h-4 w-4" />{t}</li>
            ))}
          </ul>
        </div>

        <div className="relative animate-fade-up [animation-delay:120ms]">
          <img src="/grow-xeno-hero.jpg" alt="A Grow Xeno specialist working directly on a client project" width={1280} height={1440} className="aspect-[4/4.2] w-full rounded-2xl object-cover shadow-panel" />
          <div className="absolute -bottom-6 left-4 right-4 rounded-xl border bg-card p-5 shadow-panel sm:left-auto sm:right-6 sm:w-80">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Before every handover</p>
              <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">Checked</span>
            </div>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              {["Delivered against the agreed quote", "Numbers verified against the promise", "Walkthrough to secure your account"].map((t) => (
                <li key={t} className="flex items-center gap-2.5"><Tick />{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
      <div className="h-6" />
    </section>
  );
}

function Services() {
  const [active, setActive] = useState(0);
  const s = services[active] ?? services[0]!;
  return (
    <section id="services" className="py-16 md:py-28">
      <Container>
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHead kicker="Services" title="Six services, held to one standard: it actually works." sub="Pick a service to see who it's for, what's included, and what you end up with." />
          <Btn href="#contact" variant="outline" className="self-start md:self-auto">Not sure? Ask us</Btn>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[340px_1fr]">
          <div role="tablist" aria-label="Services" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0">
            {services.map((x, i) => (
              <button
                key={x.id}
                role="tab"
                aria-selected={active === i}
                onClick={() => setActive(i)}
                className={`group shrink-0 rounded-lg border px-4 py-3 text-left transition-all lg:flex lg:items-center lg:justify-between lg:py-4 ${
                  active === i ? "border-primary bg-accent" : "border-transparent bg-secondary hover:border-input lg:bg-transparent"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <x.icon aria-hidden="true" className={`size-4 shrink-0 lg:size-5 ${active === i ? "text-primary" : "text-muted-foreground"}`} />
                  <span>
                    <span className={`block whitespace-nowrap text-sm font-semibold lg:text-base ${active === i ? "text-accent-foreground" : ""}`}>{x.name}</span>
                    <span className="mt-0.5 hidden text-sm text-muted-foreground lg:block">{x.short}</span>
                  </span>
                </span>
                <span className={`hidden transition-transform lg:block ${active === i ? "translate-x-0 text-primary" : "-translate-x-1 text-muted-foreground opacity-0 group-hover:opacity-100"}`}>→</span>
              </button>
            ))}
          </div>

          <article key={s.id} role="tabpanel" className="animate-fade-up rounded-2xl border bg-card p-5 shadow-panel sm:p-6 md:p-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <s.icon aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="text-sm text-muted-foreground">Service {String(active + 1).padStart(2, "0")} of 06</p>
                  <h3 className="mt-1 text-2xl font-semibold md:text-3xl">{s.name}</h3>
                </div>
              </div>
              <Btn href="#contact" className="h-10">Get a quote</Btn>
            </div>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">{s.summary}</p>

            <div className="mt-8 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
              {s.target.map(([k, v]) => (
                <div key={k} className="bg-surface p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{k}</p>
                  <p className="mt-1.5 text-2xl font-semibold tabular-nums">{v}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-8 md:grid-cols-2">
              <div>
                <h4 className="text-sm font-semibold">What&apos;s included</h4>
                <ul className="mt-4 space-y-3">
                  {s.includes.map((i) => <li key={i} className="flex items-start gap-3 text-[0.9375rem]"><Tick className="mt-0.5 h-4 w-4" />{i}</li>)}
                </ul>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold">Who it&apos;s for</h4>
                  <p className="mt-2 text-[0.9375rem] text-muted-foreground">{s.audience}</p>
                </div>
                <div className="rounded-lg border-l-2 border-primary bg-accent/50 p-4">
                  <h4 className="text-sm font-semibold">Where it leads</h4>
                  <p className="mt-1 text-[0.9375rem] text-muted-foreground">{s.outcome}</p>
                </div>
              </div>
            </div>
          </article>
        </div>
      </Container>
    </section>
  );
}

function Audience() {
  const groups: [string, string, string][] = [
    ["Creators", "Reach YouTube or TikTok monetization, or buy a channel that's already there.", "YouTube · TikTok"],
    ["Publishers", "Get your website approved for AdSense and start earning from your traffic.", "Google AdSense"],
    ["Store owners", "Grow an existing Shopify store with SEO, ads and technical fixes.", "Shopify Growth"],
    ["Businesses & marketers", "Launch a website or app, or build a social media marketing operation.", "Web · SMM"],
  ];
  return (
    <section className="border-y bg-surface py-16 md:py-20">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <SectionHead kicker="Who we work with" title="Built for people turning attention into income." />
          <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
            {groups.map(([t, d, tag]) => (
              <div key={t} className="bg-background p-6">
                <p className="text-xs font-medium text-primary">{tag}</p>
                <h3 className="mt-2 text-lg font-semibold">{t}</h3>
                <p className="mt-1.5 text-[0.9375rem] text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function Difference() {
  const rows: [string, string, string][] = [
    ["Handover", "Anonymous handoff, then silence", "Every account or asset checked before it's handed to you"],
    ["Communication", "Ticket queues and auto-replies", "You talk to the person doing the work"],
    ["Pricing", "Bundled extras you didn't ask for", "A straight quote for exactly what you need"],
    ["After delivery", "Relationship ends at payment", "Support continues if something needs adjusting"],
    ["Transparency", "Vague promises", "Delivery checked against what was promised"],
  ];
  return (
    <section id="why" className="bg-navy py-20 text-navy-foreground md:py-28">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <p className="text-sm font-medium text-navy-muted">Why Grow Xeno</p>
            <h2 className="mt-3 text-3xl font-semibold md:text-[2.5rem] md:leading-[1.1]">Scams are common in this space. Accountability isn&apos;t.</h2>
            <p className="mt-5 text-lg text-navy-muted">That&apos;s the bar we hold ourselves to on every order. Here&apos;s what it means in practice.</p>
            <div className="mt-8 grid gap-4">
              {[
                ["Transparent, verified delivery", "No anonymous handoffs. Checked before it's yours — not after you've paid and gone quiet."],
                ["Real people, direct communication", "Questions get answered, not auto-replied."],
                ["Support after delivery", "If something needs adjusting afterwards, we're still here."],
              ].map(([t, d]) => (
                <div key={t} className="flex gap-4 rounded-xl border border-navy-line bg-navy-2 p-5">
                  <Tick className="mt-0.5 h-5 w-5" />
                  <div><p className="font-semibold">{t}</p><p className="mt-1 text-sm text-navy-muted">{d}</p></div>
                </div>
              ))}
            </div>
          </div>

          {/* Phones: one card per row, since three columns leave 2-3 words per line at 375px. */}
          <ul className="grid gap-3 md:hidden">
            {rows.map(([k, bad, good]) => (
              <li key={k} className="rounded-xl border border-navy-line bg-navy-2 p-4 text-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-navy-muted">{k}</p>
                <p className="mt-2.5 flex gap-2 text-navy-muted"><span aria-hidden className="text-destructive">✕</span><span><span className="sr-only">Common in the market: </span>{bad}</span></p>
                <p className="mt-2 flex gap-2 font-medium"><Tick className="mt-0.5 h-4 w-4" /><span><span className="sr-only">Grow Xeno: </span>{good}</span></p>
              </li>
            ))}
          </ul>

          <div className="hidden self-start overflow-hidden rounded-2xl border border-navy-line md:block lg:mt-24">
            <div className="grid grid-cols-[0.8fr_1fr_1.2fr] bg-navy-2 text-xs font-medium uppercase tracking-wider text-navy-muted">
              <div className="p-4 md:p-5" />
              <div className="p-4 md:p-5">Common in the market</div>
              <div className="border-l border-navy-line p-4 text-navy-foreground md:p-5">Grow Xeno</div>
            </div>
            {rows.map(([k, bad, good]) => (
              <div key={k} className="grid grid-cols-[0.8fr_1fr_1.2fr] border-t border-navy-line text-sm">
                <div className="p-4 font-medium md:p-5">{k}</div>
                <div className="flex gap-2 p-4 text-navy-muted md:p-5"><span aria-hidden className="text-destructive">✕</span>{bad}</div>
                <div className="flex gap-2 border-l border-navy-line bg-navy-2/50 p-4 md:p-5"><Tick className="mt-0.5 h-4 w-4" />{good}</div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function Process() {
  return (
    <section id="process" className="py-16 md:py-28">
      <Container>
        <SectionHead center kicker="How it works" title="What happens after you get in touch" sub="Four steps, start to finish. You'll always know where your order stands." />
        <ol className="relative mt-14 grid gap-4 md:grid-cols-4 md:gap-6">
          <div aria-hidden className="absolute left-0 right-0 top-5 hidden h-px bg-border md:block" />
          {steps.map((s, i) => (
            <li key={s.t} className="relative flex gap-4 md:block">
              <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-primary bg-background text-sm font-semibold text-primary">{i + 1}</span>
              <div className="flex-1 rounded-xl border bg-card p-5 md:mt-6">
                <p className="text-xs font-medium text-primary">{s.when}</p>
                <h3 className="mt-1.5 font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 rounded-2xl bg-surface p-6 text-center sm:flex-row sm:text-left md:p-8">
          <div>
            <p className="font-semibold">Step one takes a couple of minutes.</p>
            <p className="text-sm text-muted-foreground">Tell us your goal and we&apos;ll come back with a straight quote.</p>
          </div>
          <Btn href="#contact">Start with step one →</Btn>
        </div>
      </Container>
    </section>
  );
}

function Faq() {
  const { email: EMAIL } = useContact();
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="border-t bg-surface py-16 md:py-28">
      <Container className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <div>
          <SectionHead kicker="FAQ" title="Good to know before you reach out." />
          <div className="mt-8 rounded-xl border bg-background p-5">
            <p className="font-semibold">Have a different question?</p>
            <p className="mt-1 text-sm text-muted-foreground">You&apos;ll get an answer from a real person.</p>
            <a href={`mailto:${EMAIL}`} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">{EMAIL} →</a>
          </div>
        </div>
        <div className="divide-y rounded-2xl border bg-background">
          {faqs.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <div key={q}>
                <button onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-6 p-5 text-left font-medium transition-colors hover:text-primary md:p-6">
                  {q}
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-muted-foreground transition-transform ${isOpen ? "rotate-45 border-primary text-primary" : ""}`} aria-hidden>+</span>
                </button>
                <div className={`grid transition-[grid-template-rows] duration-300 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden"><p className="px-5 pb-6 leading-relaxed text-muted-foreground md:px-6">{a}</p></div>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

function Contact() {
  const { email: EMAIL, phone, whatsapp, instagram, twitter, facebook } = useContact();
  const [service, setService] = useState("");
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Saved as an Inquiry (2026-11-04) — it used to open the visitor's email
  // app and store nothing. The server validates and rate-limits it.
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    setError(null);
    startTransition(async () => {
      try {
        const result = await submitInquiryAction({
          name: f.get("name"),
          email: f.get("email"),
          service: service && service !== "Not sure yet" ? service : "",
          message: f.get("message"),
          [HONEYPOT_FIELD]: f.get(HONEYPOT_FIELD),
        });
        if (result.ok) {
          setSent(true);
          form.reset();
          setService("");
        } else {
          setError(result.error);
        }
      } catch {
        setError(`Something went wrong. Please try again, or email us at ${EMAIL}.`);
      }
    });
  };
  const input = "mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-[0.9375rem] outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-ring/15";
  return (
    <section id="contact" className="py-16 md:py-28">
      <Container>
        <div className="grid overflow-hidden rounded-2xl border shadow-panel sm:rounded-3xl lg:grid-cols-[1fr_1.25fr]">
          <div className="bg-navy p-6 text-navy-foreground sm:p-8 md:p-12">
            <p className="text-sm font-medium text-navy-muted">Get started</p>
            <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Tell us what you need. Get a straight quote back.</h2>
            <p className="mt-4 text-navy-muted">A channel, an account, a store or a site — describe your goal and we&apos;ll reply directly.</p>
            <ul className="mt-8 space-y-4 text-sm">
              {["A clear price for exactly what you asked for", "No bundled upsells", "Verified before handover, supported after"].map((t) => (
                <li key={t} className="flex items-center gap-3"><Tick />{t}</li>
              ))}
            </ul>
            <div className="mt-10 border-t border-navy-line pt-6 text-sm">
              <p className="text-navy-muted">Prefer email?</p>
              <a href={`mailto:${EMAIL}`} className="mt-1 inline-block break-all text-lg font-semibold hover:underline">{EMAIL}</a>
              {phone ? (
                <>
                  <p className="mt-4 text-navy-muted">Or call us</p>
                  <a href={telHref(phone)} className="mt-1 inline-flex items-center gap-2 font-semibold hover:underline">
                    <Phone className="h-4 w-4" aria-hidden />{phone}
                  </a>
                </>
              ) : null}
              {whatsapp || instagram || twitter || facebook ? (
                <>
                  <p className="mt-4 text-navy-muted">Message or follow us</p>
                  <SocialLinks tone="dark" className="mt-2" />
                </>
              ) : null}
              <p className="mt-4 text-navy-muted">Remote-first · Worldwide</p>
            </div>
          </div>

          {sent ? (
            <div className="flex flex-col items-start justify-center bg-card p-6 sm:p-8 md:p-12" role="status">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-accent text-accent-foreground"><Tick /></span>
              <h3 className="mt-5 text-2xl font-semibold">Thanks — your inquiry is in.</h3>
              <p className="mt-2 text-muted-foreground">We&apos;ll reply to the email you gave us. Need to add something? Write to <a href={`mailto:${EMAIL}`} className="font-medium text-primary hover:underline">{EMAIL}</a>.</p>
              <button type="button" onClick={() => setSent(false)} className="mt-6 text-sm font-medium text-primary hover:underline">Send another inquiry</button>
            </div>
          ) : (
          <form onSubmit={submit} className="bg-card p-6 sm:p-8 md:p-12" aria-busy={pending}>
            {/* Honeypot: hidden from people and screen readers; bots tend to fill it. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label>Company<input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" /></label>
            </div>
            <p className="text-sm font-semibold">What can we help with?</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[...services.map((s) => s.name), "Not sure yet"].map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setService(service === n ? "" : n)}
                  aria-pressed={service === n}
                  className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${service === n ? "border-primary bg-accent font-medium text-accent-foreground" : "border-input hover:border-foreground/30"}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">Name<input required name="name" className={input} placeholder="Your name" /></label>
              <label className="block text-sm font-medium">Email<input required type="email" name="email" className={input} placeholder="you@example.com" /></label>
            </div>
            <label className="mt-4 block text-sm font-medium">Your goal
              <textarea required name="message" rows={4} className={`${input} resize-none`} placeholder="e.g. I want my YouTube channel to reach monetization" />
            </label>
            {error ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p> : null}
            <button type="submit" disabled={pending} className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-lg bg-primary px-6 font-medium text-primary-foreground shadow-sm transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-70">
              {pending ? "Sending…" : "Send inquiry →"}
            </button>
            <p className="mt-3 text-center text-xs text-muted-foreground">We&apos;ll reply to the email you give us.</p>
          </form>
          )}
        </div>
      </Container>
    </section>
  );
}

function Footer() {
  const { email: EMAIL, phone } = useContact();
  return (
    <footer className="border-t bg-surface pb-24 md:pb-0">
      <Container className="grid grid-cols-2 gap-x-6 gap-y-10 py-14 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-1">
          <BrandWordmark className="h-11" />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">Digital growth services, run honestly. Verified before handover, supported after.</p>
        </div>
        <div>
          <p className="text-sm font-semibold">Services</p>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            {services.map((s) => <li key={s.id}><a href="#services" className="hover:text-foreground">{s.name}</a></li>)}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Company</p>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            {([["Why Grow Xeno", "#why"], ["How it works", "#process"], ["FAQ", "#faq"], ["Contact", "#contact"]] as [string, string][]).map(([l, h]) => <li key={h}><a href={h} className="hover:text-foreground">{l}</a></li>)}
          </ul>
        </div>
        <div className="col-span-2 md:col-span-1">
          <p className="text-sm font-semibold">Contact</p>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li>
              <a href={`mailto:${EMAIL}`} className="inline-flex items-center gap-2 hover:text-foreground"><Mail className="h-3.5 w-3.5" aria-hidden />{EMAIL}</a>
            </li>
            {phone ? (
              <li>
                <a href={telHref(phone)} className="inline-flex items-center gap-2 hover:text-foreground"><Phone className="h-3.5 w-3.5" aria-hidden />{phone}</a>
              </li>
            ) : null}
            <li>Remote-first, worldwide</li>
          </ul>
          <SocialLinks size="sm" className="mt-4" />
          <Btn href="#contact" className="mt-5 h-10">Book a meeting</Btn>
        </div>
      </Container>
      <div className="border-t">
        <Container className="flex flex-col justify-between gap-2 py-6 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Grow Xeno. All rights reserved.</span>
          <a href="#top" className="hover:text-foreground">Back to top ↑</a>
        </Container>
      </div>
    </footer>
  );
}

function MobileCta() {
  const { email: EMAIL, whatsapp, whatsappMessage } = useContact();
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur md:hidden">
      <div className="grid grid-cols-[auto_1fr] gap-2">
        {whatsapp ? (
          <Btn href={whatsappHref(whatsapp, whatsappMessage)} variant="outline"><SiWhatsapp className="h-4 w-4" />WhatsApp</Btn>
        ) : (
          <Btn href={`mailto:${EMAIL}`} variant="outline"><Mail className="h-4 w-4" aria-hidden />Email</Btn>
        )}
        <Btn href="#contact">Book a meeting</Btn>
      </div>
    </div>
  );
}
