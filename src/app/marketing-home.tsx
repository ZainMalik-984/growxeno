"use client";

import {
  ArrowRight,
  ChevronDown,
  Code2,
  Handshake,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Share2,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { SiGoogleadsense, SiShopify, SiTiktok, SiYoutube } from "react-icons/si";

import { cn } from "@/lib/utils";
import styles from "./marketing-home.module.css";

const NAV_LINKS = [
  { href: "#services", label: "Services" },
  { href: "#why-us", label: "Why Us" },
  { href: "#process", label: "Process" },
  { href: "#contact", label: "Contact" },
];

/** Each platform's own brand colour, used only for that one icon chip — not applied anywhere else on the page. */
const SERVICES: ReadonlyArray<{
  icon: ComponentType<{ className?: string }>;
  name: string;
  description: string;
  fg: string;
  bg: string;
}> = [
  {
    icon: SiYoutube,
    name: "YouTube Monetization",
    description: "Channels built to the 1,000-subscriber / 4,000-watch-hour threshold, plus buying and selling already-monetized channels.",
    fg: "#ffffff",
    bg: "#FF0000",
  },
  {
    icon: SiTiktok,
    name: "TikTok Growth",
    description: "Accounts grown to 10,000 followers with 1M+ views in the trailing 28 days, monetization-eligible — plus buy & sell.",
    fg: "#ffffff",
    bg: "#000000",
  },
  {
    icon: SiGoogleadsense,
    name: "Google AdSense",
    description: "AdSense approval support across Pakistan, the UK, the US, India and beyond, plus fresh, pin-verified accounts.",
    fg: "#ffffff",
    bg: "#4285F4",
  },
  {
    icon: Share2,
    name: "Social Media Marketing",
    description: "SMM panel access three ways — your own panel, a rented panel, or a reseller setup — plus hands-on marketing coaching.",
    fg: "#ffffff",
    bg: "#C2410C",
  },
  {
    icon: Code2,
    name: "Website & App Design",
    description: "User-friendly websites and web apps, SaaS products included, built so your digital presence actually represents you.",
    fg: "#ffffff",
    bg: "#C2410C",
  },
  {
    icon: SiShopify,
    name: "Shopify Growth",
    description: "SEO and Google Ads to grow an existing store, plus hands-on help resolving the technical issues that quietly cost sales.",
    fg: "#ffffff",
    bg: "#5E8E3E",
  },
];

const TRUST_POINTS = [
  {
    icon: ShieldCheck,
    title: "Transparent, verified delivery",
    description: "No anonymous handoffs. Every account or asset is checked before it's handed to you, not after you've paid and gone quiet.",
  },
  {
    icon: Handshake,
    title: "Real people, direct communication",
    description: "You talk to the person doing the work — not a ticket queue. Questions get answered, not auto-replied.",
  },
  {
    icon: MessageCircle,
    title: "Support after delivery",
    description: "The relationship doesn't end at handover. If something needs adjusting afterward, we're still here for it.",
  },
];

const PROCESS_STEPS = [
  { title: "Tell us what you need", description: "A quick message about your goal — a channel, an account, a store, a site." },
  { title: "Get a straight quote", description: "No bundled upsells. A clear price for exactly what you asked for." },
  { title: "We deliver & verify", description: "Work is checked against what was promised before it's called done." },
  { title: "Ongoing support", description: "Questions after delivery get answered — this isn't a one-and-done handoff." },
];

const FAQS = [
  {
    q: "How is a channel or account \"delivered\"?",
    a: "Account credentials and any required transfer steps are handed over directly, with a walkthrough so you know exactly what you're receiving and how to secure it.",
  },
  {
    q: "What if the monetization numbers don't match what was promised?",
    a: "Every delivery is checked against the agreed specification first. If something is short, it gets made right before the order is called complete.",
  },
  {
    q: "Do you only work with clients in Pakistan?",
    a: "No — digital services (monetization, AdSense, SMM, web and Shopify work) are available anywhere. Local, in-person deals are simply an additional option where logistics allow it.",
  },
  {
    q: "Can I get ongoing marketing help, not just a one-time account?",
    a: "Yes — social media panels, coaching, SEO and Google Ads work are ongoing engagements, not single transactions.",
  },
];

/** IntersectionObserver-driven fade/slide reveal — CSS does the animating, this just toggles a class once the element is in view. */
function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(styles.reveal, shown && styles.revealShown, className)}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

function Logo({ dark }: { dark?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2 text-[15px] font-semibold tracking-tight", dark ? "text-white" : "text-neutral-900")}>
      <span className="flex size-7 items-center justify-center rounded-lg bg-orange-700 text-[13px] font-bold text-white">W</span>
      Wide n Well
    </span>
  );
}

const EYEBROW = "text-xs font-semibold tracking-[0.12em] text-orange-700 uppercase";

export function MarketingHome() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <div className="bg-white text-neutral-900">
      {/* ---------- Nav ---------- */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-neutral-200/80 bg-white/90 backdrop-saturate-150">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Logo />

          <nav className="hidden items-center gap-9 md:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-6 md:flex">
            <Link href="/login" className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900">
              Sign in
            </Link>
            <a
              href="#contact"
              className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
            >
              Get a Quote
            </a>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="inline-flex size-9 items-center justify-center text-neutral-900 md:hidden"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {mobileOpen ? (
          <div className="border-t border-neutral-200 bg-white px-5 py-4 md:hidden">
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-2 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  {link.label}
                </a>
              ))}
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-2 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Sign in
              </Link>
              <a
                href="#contact"
                onClick={() => setMobileOpen(false)}
                className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Get a Quote <ArrowRight className="size-3.5" />
              </a>
            </nav>
          </div>
        ) : null}
      </header>

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-white pt-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(234,88,12,0.12),transparent)]"
        />

        <div className="relative mx-auto max-w-5xl px-5 py-28 text-center sm:px-8 sm:py-36">
          <p className={EYEBROW}>Digital services, run honestly</p>
          <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-semibold tracking-tight text-neutral-900 sm:text-6xl">
            Real growth for your channels, store &{" "}
            <span className="bg-gradient-to-r from-orange-600 to-rose-500 bg-clip-text text-transparent">brand</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-neutral-500">
            Wide n Well handles monetization, AdSense, social growth, and web &amp; store builds — verified before
            it&apos;s called delivered, and supported after it is.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#contact"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-700 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-orange-700/20 transition-all hover:-translate-y-0.5 hover:bg-orange-800 hover:shadow-xl hover:shadow-orange-700/30 sm:w-auto"
            >
              Book a Meeting
              <ArrowRight className="size-4" />
            </a>
            <a
              href="#services"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 px-7 py-3.5 text-base font-semibold text-neutral-900 transition-colors hover:border-neutral-400 hover:bg-neutral-50 sm:w-auto"
            >
              See our services
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {["Verified before handover", "Direct communication, no ticket queue", "No bundled upsells"].map((claim) => (
              <span key={claim} className="flex items-center gap-1.5 text-sm text-neutral-500">
                <ShieldCheck className="size-4 text-neutral-400" />
                {claim}
              </span>
            ))}
          </div>
        </div>

        <div className="relative border-t border-neutral-100 bg-neutral-50/70 py-6">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-5 sm:px-8">
            {[
              { label: "YouTube Monetization", Icon: SiYoutube, fg: "#FF0000" },
              { label: "TikTok Growth", Icon: SiTiktok, fg: "#000000" },
              { label: "Google AdSense", Icon: SiGoogleadsense, fg: "#4285F4" },
              { label: "SMM Panels", Icon: Share2, fg: "#C2410C" },
              { label: "Web & App Design", Icon: Code2, fg: "#C2410C" },
              { label: "Shopify Growth", Icon: SiShopify, fg: "#5E8E3E" },
            ].map(({ label, Icon, fg }) => (
              <span key={label} className="flex items-center gap-1.5 text-sm font-medium text-neutral-600">
                <Icon aria-hidden="true" style={{ color: fg }} className="size-4 shrink-0" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Services ---------- */}
      <section id="services" className="py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className={EYEBROW}>What we offer</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
              Every service, built around one standard
            </h2>
            <p className="mt-4 text-lg text-neutral-500">It actually works — adapted to each client, never to the standard it&apos;s checked against.</p>
          </Reveal>

          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service, index) => (
              <Reveal key={service.name} delay={index * 50}>
                <div
                  style={{ "--brand": service.bg } as CSSProperties}
                  className="group h-full rounded-2xl border border-neutral-200 p-7 transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_16px_40px_-12px_var(--brand)]"
                >
                  <div
                    style={{ backgroundColor: service.bg, color: service.fg }}
                    className="flex size-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                  >
                    <service.icon aria-hidden="true" className="size-6" />
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-neutral-900">{service.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-500">{service.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Why us ---------- */}
      <section id="why-us" className="border-t border-neutral-100 bg-neutral-50/70 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className={EYEBROW}>Why Wide n Well</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
              Scams are common in this space. Accountability isn&apos;t.
            </h2>
            <p className="mt-4 text-lg text-neutral-500">That&apos;s the actual bar we hold ourselves to, on every order.</p>
          </Reveal>

          <div className="mt-16 grid gap-10 sm:grid-cols-3">
            {TRUST_POINTS.map((point, index) => (
              <Reveal key={point.title} delay={index * 70}>
                <div className="text-center sm:text-left">
                  <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-white text-orange-600 shadow-sm sm:mx-0">
                    <point.icon className="size-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-neutral-900">{point.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-500">{point.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Process ---------- */}
      <section id="process" className="py-24 sm:py-32">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className={EYEBROW}>How it works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">Four steps, start to finish</h2>
          </Reveal>

          <div className="relative mt-16 grid gap-10 sm:grid-cols-4">
            <div aria-hidden="true" className="absolute top-5 right-0 left-0 hidden h-px bg-neutral-200 sm:block" />
            {PROCESS_STEPS.map((step, index) => (
              <Reveal key={step.title} delay={index * 70} className="relative">
                <span className="relative z-10 flex size-10 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-base font-semibold text-neutral-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">{step.description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="border-t border-neutral-100 bg-neutral-50/70 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <Reveal className="text-center">
            <p className={EYEBROW}>Questions</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">Good to know before you reach out</h2>
          </Reveal>

          <div className="mt-12 space-y-3">
            {FAQS.map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <Reveal key={item.q} delay={index * 50}>
                  <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    >
                      <span className="text-sm font-semibold text-neutral-900 sm:text-base">{item.q}</span>
                      <ChevronDown className={cn("size-4 shrink-0 text-neutral-500 transition-transform", isOpen && "rotate-180")} />
                    </button>
                    {isOpen ? <p className="px-5 pb-5 text-sm leading-relaxed text-neutral-500">{item.a}</p> : null}
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section id="contact" className="py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <Reveal className="rounded-3xl bg-neutral-900 px-8 py-16 text-center sm:px-16 sm:py-20">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Ready to get started?</h2>
            <p className="mx-auto mt-4 max-w-lg text-lg text-neutral-400">
              Tell us what you need — a channel, an account, a store, or a site — and get a straight quote back.
            </p>

            <div className="mx-auto mt-10 grid max-w-xl gap-4 sm:grid-cols-2">
              <a
                href="mailto:hello@widenwell.com"
                className="flex flex-col items-center gap-2 rounded-xl bg-white/5 px-5 py-6 text-white transition-colors hover:bg-white/10"
              >
                <Mail className="size-5 text-orange-400" />
                <span className="text-sm font-medium">hello@widenwell.com</span>
              </a>
              <span className="flex flex-col items-center gap-2 rounded-xl bg-white/5 px-5 py-6 text-white">
                <MapPin className="size-5 text-orange-400" />
                <span className="text-sm font-medium">Remote-first, worldwide</span>
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-neutral-100 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 sm:flex-row sm:justify-between sm:px-8">
          <Logo />
          <nav className="flex flex-wrap items-center justify-center gap-6">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="text-sm text-neutral-500 hover:text-neutral-900">
                {link.label}
              </a>
            ))}
          </nav>
          <p className="text-xs text-neutral-500">© {new Date().getFullYear()} Wide n Well</p>
        </div>
      </footer>
    </div>
  );
}
