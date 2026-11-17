"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, ArrowUpRight, Check, Mail, Menu, Phone, Play, Plus, ShoppingBag, X } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { FaLinkedinIn } from "react-icons/fa6";
import { SiFacebook, SiGoogleadsense, SiInstagram, SiPinterest, SiShopify, SiThreads, SiTiktok, SiWhatsapp, SiX, SiYoutube } from "react-icons/si";

import { NAV, audiences, comparison, faqs, handoverChecks, services, steps, whyPoints, type ServiceId } from "@/components/marketing/content";
import { GrowXenoLoader } from "@/components/brand/grow-xeno-loader";
import { GlassCursor, Magnetic, MaskWords, REDUCED, Tilt, getSmoothScroll, scrollToY, useMedia, useSmoothScroll } from "@/components/marketing/motion";
import { submitInquiryAction } from "@/lib/inquiries/actions";
import { HONEYPOT_FIELD } from "@/lib/inquiries/schema";
import { DEFAULT_SITE_CONTACT, telHref, whatsappHref, type SiteContact } from "@/lib/settings/site-contact";

/**
 * The public Grow Xeno home page (2026-11-16, premium agency redesign).
 *
 * Design system: `.gxo` tokens in src/app/globals.css (charcoal surfaces in
 * four elevations, white type, electric green accent, metallic silver, three
 * shadow depths; official brand palette since the 2026-11-16 brand correction).
 * Type: Inter Tight display, Instrument Serif italic for emphasis, Inter body.
 *
 * Every section has its own composition and motion:
 *  - Hero: a real three.js scene (src/components/marketing/hero-scene.tsx,
 *    lazy-loaded, simplified on phones) under floating interface panels that
 *    follow the pointer and separate in depth on scroll.
 *  - Services: an illustrated bento; "Learn more" expands a card to its full
 *    details while the others reflow (GSAP Flip). "Get a quote" pre-selects
 *    that service in the form.
 *  - Audience: four different interface compositions that tilt in 3D.
 *  - Why: a recessed "market" panel against a raised Grow Xeno panel.
 *  - Process: pinned horizontal timeline with oversized numbers.
 *  - Verification: an inspection report whose checks pass as you scroll.
 *  - FAQ, contact (inquiry form unchanged), footer with the wordmark.
 *
 * Motion is GSAP + ScrollTrigger, scoped with useGSAP so it cleans up, and
 * wrapped in matchMedia so prefers-reduced-motion gets a still page. All
 * content stays semantic HTML; the 3D and the panels are decorative.
 *
 * Contact details come from Settings → Website → Contact details through
 * context; phone, WhatsApp and socials appear only when set.
 */

gsap.registerPlugin(ScrollTrigger, Flip, useGSAP);

const HeroScene = dynamic(() => import("@/components/marketing/hero-scene"), { ssr: false, loading: () => null });

const ContactContext = createContext<SiteContact>(DEFAULT_SITE_CONTACT);
const useContact = () => useContext(ContactContext);

/** Event a service's "Get a quote" sends so the form selects that service. */
const SERVICE_EVENT = "gx:service";

/* ---------- primitives ---------- */

const ring =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gx-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gx-bg)]";

function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1400px] px-5 sm:px-8 lg:px-12 ${className}`}>{children}</div>;
}

function Btn({
  href,
  children,
  variant = "primary",
  className = "",
  onClick,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  className?: string;
  onClick?: () => void;
}) {
  const base = `group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-full px-6 text-[0.9375rem] font-medium transition-[color,border-color,box-shadow] duration-500 ${ring}`;
  if (variant === "ghost") {
    return (
      <a href={href} onClick={onClick} className={`${base} border border-[var(--gx-line-2)] text-[var(--gx-text)] hover:border-[var(--gx-text)]/50 ${className}`}>
        <span className="relative">{children}</span>
      </a>
    );
  }
  return (
    <a
      href={href}
      onClick={onClick}
      className={`${base} bg-[var(--gx-accent)] text-[var(--gx-accent-ink)] shadow-[0_10px_30px_-12px_rgb(8_229_47/0.75)] hover:shadow-[0_14px_40px_-10px_rgb(8_229_47/0.9)] ${className}`}
    >
      {/* A lighter fill rises from below on hover. */}
      <span aria-hidden className="absolute inset-0 translate-y-full rounded-full bg-[var(--gx-accent-hi)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0" />
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </a>
  );
}

function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`gx-eyebrow text-[var(--gx-muted)] ${className}`}>{children}</p>
  );
}

/** A section heading whose words rise out of masks when it scrolls in. */
function SplitHeading({
  as: Tag = "h2",
  text,
  serif,
  className = "",
}: {
  as?: "h2" | "h3";
  text: string;
  /** A second sentence set in the serif italic. */
  serif?: string;
  className?: string;
}) {
  return (
    <Tag data-split className={`gx-display ${className}`}>
      <span className="sr-only">
        {text}
        {serif ? ` ${serif}` : ""}
      </span>
      <span aria-hidden>
        <MaskWords text={text} />
        {serif ? (
          <>
            {" "}
            <MaskWords text={serif} className="gx-serif text-[1.06em] text-[var(--gx-text)]/90" />
          </>
        ) : null}
      </span>
    </Tag>
  );
}

function Logo({ className = "", size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <Image src="/brand/gx-symbol-light.svg" alt="" aria-hidden width={1050} height={780} className={size === "lg" ? "h-9 w-auto" : "h-6 w-auto"} priority />
      <span className={`gx-display tracking-[-0.03em] text-[var(--gx-text)] ${size === "lg" ? "text-2xl" : "text-[1.0625rem]"}`}>Grow Xeno</span>
    </span>
  );
}

function SocialLinks({ className = "" }: { className?: string }) {
  const { whatsapp, whatsappMessage, instagram, twitter, facebook } = useContact();
  const links = [
    whatsapp ? { label: "WhatsApp", href: whatsappHref(whatsapp, whatsappMessage), Icon: SiWhatsapp } : null,
    instagram ? { label: "Instagram", href: instagram, Icon: SiInstagram } : null,
    twitter ? { label: "X (Twitter)", href: twitter, Icon: SiX } : null,
    facebook ? { label: "Facebook", href: facebook, Icon: SiFacebook } : null,
  ].filter((link) => link !== null);
  if (links.length === 0) return null;
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
            className={`grid size-10 place-items-center rounded-[var(--gx-r-sm)] border border-[var(--gx-line-2)] text-[var(--gx-muted)] transition-colors duration-300 hover:border-[var(--gx-accent)] hover:text-[var(--gx-text)] ${ring}`}
          >
            <Icon className="size-4" />
          </a>
        </li>
      ))}
    </ul>
  );
}

/* ---------- page ---------- */

export function MarketingHome({ contact = DEFAULT_SITE_CONTACT }: { contact?: SiteContact }) {
  const root = useRef<HTMLDivElement>(null);
  useSmoothScroll();

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Hero intro, timed to follow the opening curtain.
        gsap
          .timeline({ delay: 1.35, defaults: { ease: "expo.out" } })
          .to(".gx-hero-word", { y: 0, duration: 1.35, stagger: 0.045 })
          .fromTo("[data-hero='fade']", { y: 26 }, { y: 0, autoAlpha: 1, duration: 1.1, stagger: 0.09 }, 0.35)
          .fromTo("[data-hero='stage']", { scale: 1.06 }, { scale: 1, autoAlpha: 1, duration: 1.9, ease: "power2.out" }, 0.15)
          .fromTo(
            "[data-hero='panel']",
            { y: 80, z: -140, rotationX: 24, transformPerspective: 900 },
            { y: 0, z: 0, rotationX: 0, autoAlpha: 1, duration: 1.5, stagger: 0.14 },
            0.55,
          );

        // Hero scroll-out: copy lifts away, the stage sinks, panels separate in depth.
        gsap
          .timeline({ scrollTrigger: { trigger: "#top", start: "top top", end: "bottom top", scrub: 0.6 } })
          .to("[data-hero-copy]", { y: -110, autoAlpha: 0.1, ease: "none" }, 0)
          .to("[data-hero-depth]", { y: 150, scale: 0.94, ease: "none" }, 0)
          .to("[data-speed]", { y: (_i: number, el: HTMLElement) => -Number(el.dataset.speed) * 150, ease: "none" }, 0);

        // Section headings: words rise out of their masks.
        gsap.utils.toArray<HTMLElement>("[data-split]").forEach((heading) => {
          gsap.from(heading.querySelectorAll(".gx-word > span"), {
            yPercent: 115,
            duration: 1.15,
            ease: "expo.out",
            stagger: 0.035,
            scrollTrigger: { trigger: heading, start: "top 86%", toggleActions: "play none none none" },
          });
        });

        // Blocks that enter with depth (used sparingly, not on every element).
        gsap.utils.toArray<HTMLElement>("[data-rise]").forEach((el) => {
          gsap.from(el, {
            y: 90,
            rotationX: 9,
            autoAlpha: 0,
            transformPerspective: 1400,
            transformOrigin: "50% 100%",
            duration: 1.35,
            ease: "expo.out",
            delay: Number(el.dataset.rise || 0),
            scrollTrigger: { trigger: el, start: "top 90%", toggleActions: "play none none none" },
          });
        });

        // Visuals open from a smaller window, and their imagery settles in scale while scrolling.
        gsap.utils.toArray<HTMLElement>("[data-clip]").forEach((el) => {
          gsap.fromTo(
            el,
            { clipPath: "inset(14% 10% 14% 10% round 28px)" },
            { clipPath: "inset(0% 0% 0% 0% round 14px)", duration: 1.6, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none none" } },
          );
        });
        gsap.utils.toArray<HTMLElement>("[data-zoom]").forEach((el) => {
          gsap.fromTo(el, { scale: 1.2 }, { scale: 1, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
        });

        // Footer wordmark rises as the page ends.
        gsap.fromTo(
          "[data-wordmark]",
          { yPercent: 45, autoAlpha: 0.2 },
          { yPercent: 0, autoAlpha: 1, ease: "none", scrollTrigger: { trigger: "[data-wordmark]", start: "top bottom", end: "bottom bottom", scrub: true } },
        );
      });

      // Pinned sections are created by the section components first; order and measure everything once.
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
      void document.fonts?.ready.then(() => ScrollTrigger.refresh());
    },
    { scope: root },
  );

  return (
    <ContactContext.Provider value={contact}>
      <noscript>
        <style>{`.gxo [data-hero]{opacity:1!important;visibility:visible!important}.gxo [data-hero-words] .gx-word>span{transform:none!important}`}</style>
      </noscript>
      <div ref={root} className="gxo min-h-screen overflow-x-clip">
        <Curtain />
        <GlassCursor />
        <Nav />
        <main>
          <Hero />
          <Services />
          <Audience />
          <Why />
          <Process />
          <Verification />
          <Faq />
          <Contact />
        </main>
        <Footer />
        <MobileCta />
      </div>
    </ContactContext.Provider>
  );
}

/**
 * Opening curtain: the animated logo alone on the page background (2026-11-16:
 * no wordmark, no bar). Runs one fast loop of the loader, then lifts. CSS-only
 * timing, never blocks clicks, hidden for reduced motion.
 */
function Curtain() {
  return (
    <div aria-hidden className="gx-curtain pointer-events-none fixed inset-0 z-[100] grid place-items-center bg-[var(--gx-bg)]">
      <GrowXenoLoader size="xl" variant="light" speed={2} label="" />
    </div>
  );
}

/* ---------- navigation ---------- */

function subscribeScroll(cb: () => void) {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
}

function Nav() {
  const { email: EMAIL, phone } = useContact();
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const scrolled = useSyncExternalStore(subscribeScroll, () => window.scrollY > 40, () => false);
  const reduced = useMedia(REDUCED);

  // Hide while scrolling down the page, return on the way up.
  useEffect(() => {
    const el = header.current;
    if (!el || reduced) return;
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (open) return;
      if (y > 480 && y > last + 6) gsap.to(el, { yPercent: -120, duration: 0.5, ease: "power3.out" });
      else if (y < last - 6 || y < 480) gsap.to(el, { yPercent: 0, duration: 0.6, ease: "expo.out" });
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open, reduced]);

  // Mobile menu: lock the page and stagger the links in.
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    if (open) getSmoothScroll()?.stop();
    else getSmoothScroll()?.start();
    return () => {
      document.documentElement.style.overflow = "";
      getSmoothScroll()?.start();
    };
  }, [open]);
  useGSAP(
    () => {
      if (!open || reduced || !menu.current) return;
      gsap.fromTo(menu.current, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.7, ease: "expo.out" });
      gsap.fromTo(menu.current.querySelectorAll("[data-menu-item]"), { yPercent: 120 }, { yPercent: 0, duration: 0.9, stagger: 0.06, ease: "expo.out", delay: 0.12 });
    },
    { dependencies: [open, reduced] },
  );

  return (
    <>
      <header
        ref={header}
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500 ${
          scrolled || open ? "border-b border-[var(--gx-line)] bg-[var(--gx-bg)]/92" : "border-b border-transparent"
        }`}
      >
        <Container className="flex h-[76px] items-center justify-between gap-6">
          <a href="#top" aria-label="Grow Xeno home" className={`rounded-[var(--gx-r-sm)] ${ring}`}>
            <Logo />
          </a>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV.map(([label, href]) => (
              <a
                key={href}
                href={href}
                className={`group rounded-[var(--gx-r-sm)] px-3.5 py-2 text-sm text-[var(--gx-muted)] ${ring}`}
              >
                {/* The label rolls up and a brighter copy rolls in under it. */}
                <span className="relative block overflow-hidden">
                  <span className="block transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-full">{label}</span>
                  <span aria-hidden className="absolute inset-0 block translate-y-full text-[var(--gx-text)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0">
                    {label}
                  </span>
                </span>
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-6 md:flex">
            <p className="gx-eyebrow hidden text-right leading-[1.5] text-[var(--gx-dim)] lg:block">
              Remote-first
              <br />
              <span className="text-[var(--gx-muted)]">Worldwide</span>
            </p>
            <Magnetic>
              <Btn href="#contact" className="h-10 px-5 text-sm">
                Book a meeting
              </Btn>
            </Magnetic>
          </div>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className={`grid size-11 place-items-center rounded-[var(--gx-r-sm)] border border-[var(--gx-line-2)] text-[var(--gx-text)] md:hidden ${ring}`}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </Container>
      </header>

      {open ? (
        <div ref={menu} id="mobile-menu" className="fixed inset-0 z-40 flex flex-col bg-[var(--gx-bg)] pt-[76px] md:hidden">
          <div aria-hidden className="pointer-events-none absolute -right-1/3 top-1/4 h-2/3 w-[120%] rounded-full bg-[radial-gradient(closest-side,rgb(8_229_47/0.14),transparent)]" />
          <nav aria-label="Mobile" className="relative flex-1 px-5 pt-8">
            {NAV.map(([label, href], i) => (
              <div key={href} className="overflow-hidden border-b border-[var(--gx-line)]">
                <a
                  href={href}
                  data-menu-item
                  onClick={() => setOpen(false)}
                  className="gx-display flex items-baseline justify-between py-5 text-[2.5rem] text-[var(--gx-text)]"
                >
                  {label}
                  <span className="text-xs font-normal tabular-nums tracking-normal text-[var(--gx-dim)]">0{i + 1}</span>
                </a>
              </div>
            ))}
          </nav>
          <div className="relative space-y-3 border-t border-[var(--gx-line)] px-5 py-6 text-sm text-[var(--gx-muted)]">
            <Btn href="#contact" onClick={() => setOpen(false)} className="w-full">
              Book a meeting <ArrowRight className="size-4" aria-hidden />
            </Btn>
            <a href={`mailto:${EMAIL}`} className="flex items-center gap-2 break-all pt-2 hover:text-[var(--gx-text)]">
              <Mail className="size-4 shrink-0" aria-hidden />
              {EMAIL}
            </a>
            {phone ? (
              <a href={telHref(phone)} className="flex items-center gap-2 tabular-nums hover:text-[var(--gx-text)]">
                <Phone className="size-4" aria-hidden />
                {phone}
              </a>
            ) : null}
            <p className="gx-eyebrow pt-1 text-[var(--gx-dim)]">Remote-first · Worldwide</p>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ---------- hero ---------- */

function Hero() {
  return (
    <section id="top" className="relative isolate overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="gx-ambient absolute -top-1/4 right-[-15%] h-[85vh] w-[70vw] rounded-full bg-[radial-gradient(closest-side,rgb(8_229_47/0.13),transparent)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[var(--gx-bg)]" />
        <div className="gx-grain absolute inset-0" />
      </div>

      <Container className="relative grid grid-cols-12 items-center gap-y-6 pb-14 pt-28 sm:pt-32 lg:min-h-[100svh] lg:gap-x-8 lg:pb-20 lg:pt-28">
        <div data-hero-copy className="relative z-10 col-span-12 lg:col-span-6">
          <div data-hero="fade">
            <Eyebrow>Digital growth services, run honestly</Eyebrow>
          </div>
          <h1 data-hero-words className="gx-display mt-6 text-[clamp(2.9rem,6.4vw,6.4rem)] text-[var(--gx-text)]">
            <span className="sr-only">Real growth for your channels, store and brand.</span>
            <span aria-hidden>
              <MaskWords text="Real growth for your channels, store" wordClassName="gx-hero-word" />{" "}
              <MaskWords text="and brand" wordClassName="gx-hero-word gx-serif" />
              <span className="gx-word">
                <span className="gx-hero-word text-[var(--gx-accent)]">.</span>
              </span>
            </span>
          </h1>
          <p data-hero="fade" className="mt-7 max-w-[46ch] text-[1.0625rem] leading-[1.65] text-[var(--gx-muted)] sm:text-lg">
            Grow Xeno handles YouTube and TikTok monetization, Google AdSense, social media management, backlinks and guest posts, and website &amp; Shopify builds. Every delivery is verified before handover, and supported after it.
          </p>
          <div data-hero="fade" className="mt-9 flex flex-wrap items-center gap-3">
            <Magnetic>
              <Btn href="#contact">
                Book a meeting <ArrowUpRight className="size-4 transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
              </Btn>
            </Magnetic>
            <Btn href="#services" variant="ghost">
              Explore services
            </Btn>
          </div>
          <ul data-hero="fade" className="mt-12 grid max-w-xl grid-cols-3 border-t border-[var(--gx-line)] text-[0.8125rem] leading-snug text-[var(--gx-muted)]">
            {["Verified before handover", "Direct communication", "No bundled upsells"].map((t, i) => (
              <li key={t} className={`pt-4 ${i > 0 ? "border-l border-[var(--gx-line)] pl-4" : "pr-4"}`}>
                <span className="mb-1.5 block text-[0.6875rem] tabular-nums text-[var(--gx-accent)]">0{i + 1}</span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <HeroStage />
        </div>
      </Container>

      <div data-hero="fade" aria-hidden className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 lg:flex">
        <span className="gx-eyebrow text-[var(--gx-dim)]">Scroll</span>
        <span className="relative block h-10 w-px overflow-hidden bg-[var(--gx-line-2)]">
          <span className="absolute inset-x-0 top-0 block h-1/2 animate-[gx-scrollcue_2s_ease-in-out_infinite] bg-[var(--gx-accent)] motion-reduce:animate-none" />
        </span>
      </div>
    </section>
  );
}

function HeroStage() {
  const stage = useRef<HTMLDivElement>(null);
  const layers = useRef<HTMLDivElement>(null);
  const simplified = useMedia("(max-width: 1023px)");
  const reduced = useMedia(REDUCED);
  const [mountScene, setMountScene] = useState(false);
  const [inView, setInView] = useState(true);
  const [ready, setReady] = useState(false);

  // Load three.js just after first paint, and render only while the hero is on screen.
  useEffect(() => {
    const t = window.setTimeout(() => setMountScene(true), 300);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? true), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Panels drift with the pointer, nearer ones further.
  useEffect(() => {
    const host = layers.current;
    if (!host || reduced || !window.matchMedia("(pointer: fine)").matches) return;
    const items = Array.from(host.querySelectorAll<HTMLElement>("[data-mouse]")).map((el) => ({
      depth: Number(el.dataset.mouse),
      x: gsap.quickTo(el, "x", { duration: 1.1, ease: "power3.out" }),
      y: gsap.quickTo(el, "y", { duration: 1.1, ease: "power3.out" }),
    }));
    const move = (e: PointerEvent) => {
      const px = e.clientX / window.innerWidth - 0.5;
      const py = e.clientY / window.innerHeight - 0.5;
      items.forEach((it) => {
        it.x(px * it.depth);
        it.y(py * it.depth);
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [reduced]);

  return (
    <div data-hero-depth className="relative h-[400px] sm:h-[520px] lg:h-[min(720px,80vh)]">
      <div
        ref={stage}
        data-hero="stage"
        className="absolute -inset-x-5 inset-y-0 [will-change:transform] sm:inset-x-0 lg:-right-12 lg:-left-6"
      >
        <div
          aria-hidden
          className={`absolute inset-0 transition-opacity duration-1000 ${ready ? "opacity-0" : "opacity-100"} bg-[radial-gradient(60%_50%_at_60%_60%,rgb(8_229_47/0.18),transparent_70%)]`}
        />
        {mountScene ? <HeroScene simplified={simplified} reducedMotion={reduced} active={inView} onReady={() => setReady(true)} /> : null}
        {/* Edges painted in the page colour so the scene melts into the page. Painted, not a CSS mask:
            a mask over a live canvas is recomposited on every scroll frame and made scrolling stutter. */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[18%] bg-gradient-to-r from-[var(--gx-bg)] to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-[10%] bg-gradient-to-l from-[var(--gx-bg)] to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[12%] bg-gradient-to-b from-[var(--gx-bg)] to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%] bg-gradient-to-t from-[var(--gx-bg)] to-transparent" />
      </div>

      <div ref={layers} aria-hidden className="pointer-events-none absolute inset-0 [perspective:1100px]">
        <div data-speed="0.55" className="absolute left-0 top-[4%] sm:left-[2%] lg:left-[-2%] lg:top-[8%]">
          <div data-mouse="34">
            <div data-hero="panel">
              <PerformancePanel />
            </div>
          </div>
        </div>
        <div data-speed="0.9" className="absolute bottom-[3%] right-0 sm:bottom-auto sm:right-[4%] sm:top-[2%] lg:top-[6%]">
          <div data-mouse="52">
            <div data-hero="panel">
              <VerifiedChip />
            </div>
          </div>
        </div>
        <div data-speed="0.35" className="absolute bottom-[4%] right-0 hidden sm:block lg:bottom-[10%] lg:right-[-2%]">
          <div data-mouse="22">
            <div data-hero="panel">
              <StatusPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <span className="mt-2 block h-1 overflow-hidden rounded-full bg-[var(--gx-line)]">
      <span className="block h-full rounded-full bg-gradient-to-r from-[var(--gx-accent)] to-[var(--gx-accent-hi)]" style={{ width: `${value}%` }} />
    </span>
  );
}

const panelSurface =
  // Solid, no backdrop blur: a blur over the live 3D canvas has to be recomputed every frame.
  "rounded-[var(--gx-r-md)] border border-[var(--gx-line-2)] bg-[var(--gx-s2)]/95 shadow-[var(--gx-shadow-3)]";

function PerformancePanel() {
  return (
    <div className={`w-[236px] p-4 sm:w-[268px] ${panelSurface}`}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[0.8125rem] font-medium text-[var(--gx-text)]">
          <SiYoutube className="size-4 text-[var(--gx-accent)]" />
          Channel performance
        </span>
        <span className="gx-eyebrow text-[0.5625rem] text-[var(--gx-dim)]">Target</span>
      </div>
      <svg viewBox="0 0 240 70" className="mt-3 h-14 w-full" aria-hidden>
        <defs>
          <linearGradient id="gx-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#08E52F" stopOpacity="0.35" />
            <stop offset="1" stopColor="#08E52F" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 62 C 30 60, 45 54, 70 50 S 110 44, 130 34 S 170 22, 195 14 S 225 6, 240 4 L 240 70 L 0 70 Z" fill="url(#gx-area)" />
        <path d="M0 62 C 30 60, 45 54, 70 50 S 110 44, 130 34 S 170 22, 195 14 S 225 6, 240 4" fill="none" stroke="#08E52F" strokeWidth="1.6" />
        <circle cx="240" cy="4" r="3" fill="#E9FFEC" />
      </svg>
      <div className="mt-2 space-y-3 text-[0.75rem]">
        <div>
          <div className="flex justify-between text-[var(--gx-muted)]">
            <span>Subscribers</span>
            <span className="tabular-nums text-[var(--gx-text)]">1,000 / 1,000</span>
          </div>
          <Bar value={100} />
        </div>
        <div>
          <div className="flex justify-between text-[var(--gx-muted)]">
            <span>Watch hours</span>
            <span className="tabular-nums text-[var(--gx-text)]">4,000 / 4,000</span>
          </div>
          <Bar value={100} />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[var(--gx-line)] pt-3 text-[0.75rem]">
        <span className="text-[var(--gx-muted)]">Partner Program</span>
        <span className="flex items-center gap-1.5 font-medium text-[var(--gx-accent-hi)]">
          <span className="size-1.5 rounded-full bg-[var(--gx-accent)]" />
          Eligible
        </span>
      </div>
    </div>
  );
}

function StatusPanel() {
  const rows: { Icon: typeof SiYoutube; label: string; value: string }[] = [
    { Icon: SiYoutube, label: "YouTube", value: "Monetized" },
    { Icon: SiGoogleadsense, label: "AdSense", value: "PIN verified" },
    { Icon: SiTiktok, label: "TikTok", value: "10K · 1M+ / 28d" },
  ];
  return (
    <div className={`w-[248px] p-4 ${panelSurface}`}>
      <p className="gx-eyebrow text-[0.5625rem] text-[var(--gx-dim)]">Monetization status</p>
      <ul className="mt-3 divide-y divide-[var(--gx-line)] text-[0.75rem]">
        {rows.map(({ Icon, label, value }) => (
          <li key={label} className="flex items-center justify-between py-2.5">
            <span className="flex items-center gap-2 text-[var(--gx-muted)]">
              <Icon className="size-3.5 text-[var(--gx-text)]" />
              {label}
            </span>
            <span className="tabular-nums text-[var(--gx-text)]">{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VerifiedChip() {
  return (
    <div className={`flex items-center gap-3 py-3 pl-3 pr-4 ${panelSurface}`}>
      <span className="grid size-8 place-items-center rounded-full bg-[var(--gx-accent)] text-[var(--gx-accent-ink)]">
        <Check className="size-4" strokeWidth={2.5} />
      </span>
      <span className="text-[0.75rem] leading-tight">
        <span className="block font-medium text-[var(--gx-text)]">Verified before handover</span>
        <span className="tabular-nums text-[var(--gx-dim)]">Checks 3 / 3 passed</span>
      </span>
    </div>
  );
}

/* ---------- services ---------- */

/*
 * Services as a bento (2026-11-16, owner reference; reworked 2026-11-17): seven
 * illustrated tiles of mixed sizes. Large screens, 12 columns:
 *
 *   [ YouTube (wide)        ][ TikTok ][ AdSense ]
 *   [ Social   ][ Website   ][ (tall)  ][ (tall)  ]
 *   [ Shopify  ][ Backlinks & Guest Posts (wide)   ]
 *
 * Phones and tablets keep it a bento in two columns: YouTube across the top,
 * TikTok tall beside AdSense and Social Media, small square tiles, Backlinks
 * across the bottom. Small tiles show the title and an arrow on phones, the
 * short line from sm up, and big tiles the full summary. "Learn more" expands
 * a tile to the full width with every detail while the others settle into
 * rows of three beneath it (GSAP Flip animates each from where it was to where
 * it lands); on phones a tile opens in place.
 */

/** hero: wide, art behind the text. tall: two rows. small: one cell. wide: text beside art. */
type Kind = "hero" | "tall" | "small" | "wide";

const BENTO: Record<ServiceId, { span: string; kind: Kind; art: () => ReactNode }> = {
  youtube: { span: "col-span-2 lg:col-span-6", kind: "hero", art: () => <YouTubeArt /> },
  tiktok: { span: "row-span-2 lg:col-span-3", kind: "tall", art: () => <TikTokArt /> },
  adsense: { span: "lg:col-span-3 lg:row-span-2", kind: "tall", art: () => <AdSenseArt /> },
  smm: { span: "lg:col-span-3", kind: "small", art: () => <SmmArt /> },
  web: { span: "lg:col-span-3", kind: "small", art: () => <WebArt /> },
  shopify: { span: "lg:col-span-3", kind: "small", art: () => <ShopifyArt /> },
  backlinks: { span: "col-span-2 lg:col-span-9", kind: "wide", art: () => <BacklinksArt /> },
};

/** Which side each tile slides in from on large screens: -1 left, 1 right, 0 from below. */
const ENTER_FROM: Record<ServiceId, number> = { youtube: -1, tiktok: 0, adsense: 1, smm: -1, web: 0, shopify: -1, backlinks: 1 };

/** Spans while one tile is open: the other six in rows of three (full-width rows on phones). */
const COMPACT = "col-span-2 sm:col-span-1 lg:col-span-4";

function Services() {
  const reduced = useMedia(REDUCED);
  const [open, setOpen] = useState<number | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const flip = useRef<Flip.FlipState | null>(null);

  // Each card slides in from its side of the grid with a little depth, then its
  // illustration layers and its text follow in sequence. Once per card; nothing
  // moves for reduced motion. Inline styles are cleared afterwards so the
  // expand animation (Flip) starts from clean boxes.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add({ motion: "(prefers-reduced-motion: no-preference)", wide: "(min-width: 1024px)" }, (ctx) => {
        if (!ctx.conditions?.motion) return;
        const wide = Boolean(ctx.conditions.wide);
        gsap.utils.toArray<HTMLElement>("[data-card]").forEach((card, i) => {
          const dir = wide ? Number(card.dataset.from ?? 0) : 0;
          const art = card.querySelectorAll<HTMLElement>("[data-art] > *");
          const text = card.querySelectorAll<HTMLElement>("[data-slide]");
          gsap
            .timeline({
              scrollTrigger: { trigger: card, start: "top 90%", toggleActions: "play none none none" },
              onComplete: () => gsap.set([card, ...art, ...text], { clearProps: "transform,transformOrigin,opacity,visibility" }),
            })
            .from(card, {
              x: dir * 140,
              y: dir ? 40 : 110,
              rotationY: dir * -10,
              rotationX: dir ? 0 : 12,
              transformPerspective: 1400,
              transformOrigin: dir < 0 ? "100% 50%" : dir > 0 ? "0% 50%" : "50% 100%",
              autoAlpha: 0,
              duration: 1.25,
              ease: "expo.out",
              delay: wide ? (i % 3) * 0.08 : 0,
            })
            .from(art, { y: 46, x: dir * 36, scale: 0.92, autoAlpha: 0, duration: 1, stagger: 0.07, ease: "expo.out" }, "-=0.95")
            .from(text, { y: 30, x: dir * 24, autoAlpha: 0, duration: 0.9, stagger: 0.07, ease: "expo.out" }, "-=0.85");
        });
      });
    },
    { scope: grid },
  );

  const toggle = (i: number | null) => {
    if (!reduced && grid.current) flip.current = Flip.getState(grid.current.querySelectorAll("[data-card]"));
    setOpen((prev) => (prev === i ? null : i));
  };

  // Close with Escape.
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") toggle(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Every card travels from its old box to its new one; the opened card's details then arrive.
  useGSAP(
    () => {
      const state = flip.current;
      flip.current = null;
      const host = grid.current;
      if (!host) return;
      const opened = open === null ? null : host.querySelector<HTMLElement>(`[data-card="${services[open]!.id}"]`);
      // Where the opened card ends up, measured before Flip moves anything back to its old spot.
      const target = opened ? opened.getBoundingClientRect().top + window.scrollY - 96 : null;
      if (state) {
        Flip.from(state, {
          duration: 0.95,
          ease: "expo.inOut",
          nested: true,
          onComplete: () => ScrollTrigger.refresh(),
        });
      }
      if (opened) {
        if (!reduced) {
          gsap.fromTo(
            opened.querySelectorAll("[data-detail]"),
            { autoAlpha: 0, y: 22 },
            { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.05, delay: state ? 0.45 : 0, ease: "expo.out" },
          );
        }
        if (target !== null) scrollToY(target);
      }
    },
    { dependencies: [open], scope: grid },
  );


  return (
    <section id="services" className="gx-section relative scroll-mt-[var(--gx-anchor)] border-t border-[var(--gx-line)] bg-[var(--gx-s1)]">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[40rem] bg-[radial-gradient(60%_50%_at_50%_0%,rgb(0_185_91/0.08),transparent_70%)]" />
      <Container className="relative">
        <div className="grid grid-cols-12 items-end gap-y-6">
          <div className="col-span-12 lg:col-span-8">
            <Eyebrow>Services</Eyebrow>
            <SplitHeading text="Seven services, held to one standard:" serif="it actually works." className="mt-5 text-[clamp(2.4rem,5.2vw,5rem)]" />
          </div>
          <p className="col-span-12 max-w-[40ch] leading-[1.65] text-[var(--gx-muted)] lg:col-span-4 lg:justify-self-end">
            Pick a service to see who it&apos;s for, what&apos;s included, and what you end up with.
          </p>
        </div>

        <div
          ref={grid}
          className={`mt-12 grid grid-flow-row-dense grid-cols-2 gap-3 sm:gap-4 lg:mt-16 lg:grid-cols-12 ${open === null ? "auto-rows-[minmax(200px,auto)] sm:auto-rows-[minmax(240px,auto)] lg:auto-rows-[minmax(270px,auto)]" : ""}`}
        >
          {services.map((s, i) => {
            const isOpen = open === i;
            const b = BENTO[s.id];
            const span = open === null ? b.span : isOpen ? "col-span-2 lg:col-span-12 lg:order-first" : COMPACT;
            return (
              <ServiceCard key={s.id} service={s} index={i} span={span} kind={b.kind} art={b.art()} isOpen={isOpen} compact={open !== null && !isOpen} onToggle={() => toggle(i)} />
            );
          })}
        </div>
      </Container>
    </section>
  );
}

function ServiceCard({
  service: s,
  index,
  span,
  kind,
  art,
  isOpen,
  compact,
  onToggle,
}: {
  service: (typeof services)[number];
  index: number;
  span: string;
  kind: Kind;
  art: ReactNode;
  isOpen: boolean;
  compact: boolean;
  onToggle: () => void;
}) {
  const quote = () => window.dispatchEvent(new CustomEvent(SERVICE_EVENT, { detail: s.name }));
  const spot = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  const detailId = `svc-detail-${s.id}`;

  const learnMore = (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-controls={detailId}
      className={`group/btn relative inline-flex h-11 items-center gap-2 overflow-hidden rounded-full border border-[var(--gx-line-2)] bg-[var(--gx-s3)] px-5 text-sm font-medium text-[var(--gx-text)] shadow-[var(--gx-shadow-1)] transition-[border-color,box-shadow,color] duration-500 hover:border-[var(--gx-accent)]/60 hover:text-[var(--gx-accent-ink)] hover:shadow-[0_0_0_4px_rgb(8_229_47/0.12),0_10px_30px_-10px_rgb(8_229_47/0.6)] ${ring}`}
    >
      <span aria-hidden className="absolute inset-0 translate-y-full rounded-full bg-[var(--gx-accent)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/btn:translate-y-0" />
      <span className="relative">Learn more</span>
      <ArrowRight className="relative size-4 transition-transform duration-500 group-hover/btn:translate-x-0.5" aria-hidden />
    </button>
  );

  const head = (
    <>
      <p data-slide className="text-xs tabular-nums text-[var(--gx-dim)]">0{index + 1}</p>
      <h3 data-slide className={`gx-display gx-metal mt-2 ${compact ? "text-[1.4rem] sm:text-[1.6rem]" : kind === "hero" || kind === "wide" ? "text-[clamp(1.6rem,2.4vw,2.3rem)]" : "text-[1.2rem] leading-[1.1] sm:text-[1.5rem]"}`}>{s.name}</h3>
    </>
  );

  return (
    <article
      data-card={s.id}
      data-from={ENTER_FROM[s.id]}
      onPointerMove={spot}
      className={`group relative isolate flex flex-col overflow-hidden rounded-[22px] border bg-[var(--gx-s2)] shadow-[var(--gx-shadow-2)] transition-[border-color,box-shadow] duration-500 ${span} ${
        isOpen ? "border-[var(--gx-line-2)]" : "border-[var(--gx-line)] hover:border-[var(--gx-line-2)]"
      }`}
    >
      {/* Light catching the top edge, and a soft emerald spotlight that follows the pointer. */}
      <span aria-hidden className="pointer-events-none absolute inset-x-10 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "radial-gradient(460px circle at var(--mx, 50%) var(--my, 0%), rgb(8 229 47 / 0.07), transparent 60%)" }}
      />

      {isOpen ? (
        <div className="grid flex-1 lg:grid-cols-12">
          <div className="relative min-h-[260px] overflow-hidden border-b border-[var(--gx-line)] lg:col-span-5 lg:min-h-[520px] lg:border-b-0 lg:border-r">{art}</div>
          <div id={detailId} role="region" aria-label={`${s.name} details`} className="p-6 sm:p-10 lg:col-span-7 lg:p-12">
            <div data-detail className="flex items-start justify-between gap-6">
              <div>{head}</div>
              <button
                type="button"
                onClick={onToggle}
                aria-label={`Close ${s.name}`}
                className={`grid size-11 shrink-0 place-items-center rounded-full border border-[var(--gx-line-2)] text-[var(--gx-muted)] transition-colors duration-300 hover:border-[var(--gx-accent)] hover:text-[var(--gx-text)] ${ring}`}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <p data-detail className="mt-5 max-w-[58ch] leading-[1.7] text-[var(--gx-muted)] sm:text-lg">
              {s.summary}
            </p>
            <dl data-detail className="mt-8 grid grid-cols-2 border-y border-[var(--gx-line)]">
              {s.target.map(([k, v], i) => (
                <div key={k} className={`py-5 ${i === 1 ? "border-l border-[var(--gx-line)] pl-5 sm:pl-8" : "pr-5"}`}>
                  <dt className="gx-eyebrow text-[var(--gx-dim)]">{k}</dt>
                  <dd className="gx-display gx-metal mt-2 text-[clamp(1.4rem,2.6vw,2.4rem)] tabular-nums tracking-[-0.03em]">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-8 grid gap-8 md:grid-cols-[1.15fr_1fr]">
              <div data-detail>
                <p className="gx-eyebrow text-[var(--gx-dim)]">What&apos;s included</p>
                <ol className="mt-4 space-y-3">
                  {s.includes.map((item, i) => (
                    <li key={item} className="flex gap-4 text-[0.9375rem] text-[var(--gx-text)]/90">
                      <span className="pt-0.5 text-xs tabular-nums text-[var(--gx-accent)]">0{i + 1}</span>
                      {item}
                    </li>
                  ))}
                </ol>
              </div>
              <div data-detail className="space-y-6">
                <div>
                  <p className="gx-eyebrow text-[var(--gx-dim)]">Who it&apos;s for</p>
                  <p className="mt-3 leading-[1.6] text-[var(--gx-text)]/90">{s.audience}</p>
                </div>
                <div className="border-l border-[var(--gx-accent)] pl-4">
                  <p className="gx-eyebrow text-[var(--gx-accent)]">Where it leads</p>
                  <p className="mt-2 leading-[1.6] text-[var(--gx-text)]/90">{s.outcome}</p>
                </div>
              </div>
            </div>
            <div data-detail className="mt-9 flex flex-wrap items-center gap-3">
              <Magnetic>
                <Btn href="#contact" onClick={quote}>
                  Get a quote <ArrowRight className="size-4" aria-hidden />
                </Btn>
              </Magnetic>
              <button type="button" onClick={onToggle} className={`rounded-full px-4 py-2 text-sm text-[var(--gx-muted)] transition-colors hover:text-[var(--gx-text)] ${ring}`}>
                Back to all services
              </button>
            </div>
          </div>
        </div>
      ) : compact ? (
        <div className="flex flex-1 items-end gap-5 p-6">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-[var(--gx-r-md)] border border-[var(--gx-line)] bg-[var(--gx-bg)]">
            <div className="absolute inset-0 origin-top-left scale-[0.42]" style={{ width: "238%", height: "238%" }}>
              {art}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            {head}
            <div className="mt-4">{learnMore}</div>
          </div>
        </div>
      ) : kind === "wide" ? (
        <div className="flex flex-1 flex-col lg:grid lg:grid-cols-12">
          <div className="relative p-5 sm:p-7 lg:col-span-5 lg:self-center lg:p-8">
            {head}
            <p data-slide className="mt-2.5 max-w-[46ch] text-[0.9375rem] leading-[1.6] text-[var(--gx-muted)]">
              <span className="sm:hidden">{s.short}</span>
              <span className="hidden sm:inline">{s.summary}</span>
            </p>
            <div data-slide className="mt-5">{learnMore}</div>
          </div>
          <div className="relative min-h-[330px] flex-1 lg:col-span-7 lg:min-h-0">{art}</div>
        </div>
      ) : (
        <div className={`relative flex flex-1 flex-col justify-end ${kind === "hero" ? "min-h-[270px] sm:min-h-0" : ""}`}>
          <div className={`absolute inset-x-0 top-0 overflow-hidden ${kind === "hero" ? "h-[58%] sm:bottom-0 sm:h-auto" : kind === "tall" ? "h-[68%]" : "h-[64%]"}`}>
            <div
              className={
                kind === "hero"
                  ? "absolute inset-0 max-sm:-top-[18%] max-sm:h-[118%]"
                  : kind === "small"
                    ? "absolute left-0 top-0 h-[166.67%] w-[166.67%] origin-top-left scale-[0.6] sm:h-[125%] sm:w-[125%] sm:scale-[0.8]"
                    : "absolute inset-0 max-sm:h-[133.33%] max-sm:w-[133.33%] max-sm:origin-top-left max-sm:scale-[0.75]"
              }
            >
              {art}
            </div>
          </div>
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[var(--gx-s2)] from-30% via-[var(--gx-s2)]/75 to-transparent" />
          <div className="relative p-4 sm:p-6">
            {head}
            {kind === "hero" ? (
              <p data-slide className="mt-2.5 max-w-[52ch] text-[0.9375rem] leading-[1.6] text-[var(--gx-muted)]">
                <span className="sm:hidden">{s.short}</span>
                <span className="hidden sm:inline">{s.summary}</span>
              </p>
            ) : (
              <p data-slide className="mt-2 hidden text-[0.875rem] leading-[1.55] text-[var(--gx-muted)] sm:block">
                {kind === "tall" ? (
                  <>
                    <span className="lg:hidden">{s.short}</span>
                    <span className="hidden lg:inline">{s.summary}</span>
                  </>
                ) : (
                  s.short
                )}
              </p>
            )}
            {kind === "hero" ? <div data-slide className="mt-5">{learnMore}</div> : null}
          </div>
          {kind === "hero" ? null : (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isOpen}
              aria-controls={detailId}
              aria-label={`Learn more about ${s.name}`}
              className={`absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full border border-[var(--gx-line-2)] bg-[var(--gx-s3)]/90 text-[var(--gx-text)] shadow-[var(--gx-shadow-1)] transition-[background-color,border-color,color,transform] duration-300 group-hover:border-[var(--gx-accent)]/60 hover:border-[var(--gx-accent)] hover:bg-[var(--gx-accent)] hover:text-[var(--gx-accent-ink)] sm:right-4 sm:top-4 sm:size-11 ${ring}`}
            >
              <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-px group-hover:translate-x-px" aria-hidden />
            </button>
          )}
        </div>
      )}
    </article>
  );
}

/* Card illustrations: interface fragments built from the brand palette, layered for depth. */

const glass = "border border-white/10 bg-[linear-gradient(180deg,rgb(255_255_255/0.07),rgb(255_255_255/0.02))] shadow-[0_20px_40px_-18px_rgb(0_0_0/0.9)] backdrop-blur-sm";

function Keycap({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`absolute grid h-14 min-w-14 place-items-center rounded-[12px] border border-white/15 bg-[linear-gradient(160deg,#2a322d,#141917)] px-3 text-xs font-medium tabular-nums text-[var(--gx-silver)] shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_14px_24px_-10px_rgb(0_0_0/0.9),0_0_0_1px_rgb(0_0_0/0.4)] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${className}`}
    >
      {children}
    </span>
  );
}

function YouTubeArt() {
  return (
    <div aria-hidden data-art className="absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-[-6%] h-[70%] w-[78%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(0_185_91/0.22),transparent)]" />
      <div className={`absolute left-[16%] top-[9%] h-[62%] w-[66%] rounded-[14px] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1.5 ${glass}`}>
        <div className="flex items-center gap-1.5 px-3 py-2.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-1.5 rounded-full bg-white/25" />
          ))}
          <span className="ml-3 rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[0.5625rem] text-white/45">youtube.com/@yourchannel</span>
        </div>
        <div className="relative mx-3 mt-1 h-[62%] overflow-hidden rounded-[8px] bg-[radial-gradient(80%_80%_at_70%_20%,rgb(0_185_91/0.35),transparent_65%),linear-gradient(160deg,#1c2420,#0b0f0d)]">
          <span className="absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[var(--gx-silver)] text-[var(--gx-bg)] shadow-[0_10px_30px_-6px_rgb(0_0_0/0.8)]">
            <Play className="ml-0.5 size-4 fill-current" />
          </span>
          <span className="absolute inset-x-3 bottom-3 h-1 overflow-hidden rounded-full bg-white/15">
            <span className="block h-full w-[64%] rounded-full bg-[var(--gx-accent)] shadow-[0_0_10px_rgb(8_229_47/0.8)]" />
          </span>
        </div>
      </div>
      <Keycap className="left-[7%] top-[12%] -rotate-[14deg] group-hover:-rotate-[8deg]">1,000</Keycap>
      <Keycap className="right-[6%] top-[38%] rotate-[12deg] group-hover:rotate-[6deg]">4,000 h</Keycap>
    </div>
  );
}

function TikTokArt() {
  return (
    <div aria-hidden data-art className="absolute inset-0 overflow-hidden">
      <div className="absolute right-[8%] top-[-10%] h-[80%] w-[60%] rounded-full bg-[radial-gradient(closest-side,rgb(8_229_47/0.14),transparent)]" />
      <div className={`absolute left-[40%] top-[6%] h-[78%] w-[26%] min-w-[130px] -rotate-6 rounded-[22px] p-2 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-rotate-3 ${glass}`}>
        <div className="relative h-full overflow-hidden rounded-[16px] bg-[linear-gradient(170deg,#1d2621,#090c0a)]">
          <div className="absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(70%_60%_at_40%_40%,rgb(0_185_91/0.4),transparent_70%)]" />
          <div className="absolute bottom-3 left-3 space-y-1.5">
            <span className="block h-1.5 w-16 rounded-full bg-white/60" />
            <span className="block h-1.5 w-10 rounded-full bg-white/25" />
          </div>
          <div className="absolute bottom-3 right-2 flex flex-col items-center gap-2 text-[0.5rem] text-white/60">
            <span className="grid size-6 place-items-center rounded-full bg-white/10">♥</span>
            <span className="grid size-6 place-items-center rounded-full bg-white/10">↗</span>
          </div>
        </div>
      </div>
      <div className={`absolute left-[14%] top-[8%] w-[26%] min-w-[120px] rounded-[12px] p-3 transition-transform duration-700 group-hover:translate-x-1 ${glass}`}>
        <span className="flex items-center gap-2 text-[0.625rem] text-white/55">
          <SiTiktok className="size-3 text-[var(--gx-silver)]" />
          Followers
        </span>
        <span className="mt-1 block text-lg font-medium tabular-nums text-[var(--gx-text)]">10,000</span>
        <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/10">
          <span className="block h-full w-full rounded-full bg-[var(--gx-accent)]" />
        </span>
      </div>
      <Keycap className="right-[10%] top-[16%] rotate-[10deg] group-hover:rotate-[4deg]">1M+</Keycap>
    </div>
  );
}

function AdSenseArt() {
  return (
    <div aria-hidden data-art className="absolute inset-0 grid place-items-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(50%_45%_at_50%_55%,rgb(0_185_91/0.16),transparent_70%)]" />
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="absolute rounded-[22px] border border-white/[0.07] bg-[linear-gradient(180deg,rgb(255_255_255/0.025),transparent)] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
          style={{ width: `${88 - i * 14}%`, height: `${82 - i * 13}%`, transitionDelay: `${i * 40}ms` }}
        />
      ))}
      <span className="relative grid size-24 place-items-center rounded-[18px] border border-[var(--gx-accent)]/40 bg-[linear-gradient(160deg,#1d2a22,#0b100d)] shadow-[0_0_40px_-6px_rgb(8_229_47/0.55),inset_0_1px_0_rgb(255_255_255/0.1)]">
        <SiGoogleadsense className="size-9 text-[var(--gx-accent)] drop-shadow-[0_0_10px_rgb(8_229_47/0.7)]" />
      </span>
      <span className={`absolute bottom-[12%] right-[10%] flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.625rem] font-medium text-[var(--gx-text)] ${glass}`}>
        <Check className="size-3 text-[var(--gx-accent)]" strokeWidth={3} />
        PIN verified
      </span>
    </div>
  );
}

/*
 * Social media management: a post card at the centre with the platforms it is
 * published to orbiting it on two faint rings, and the results popping up.
 * Glyphs are silver and turn green on hover, when they also drift along their
 * orbits. The gentle bob runs on the inner glyph, so the entrance timeline
 * (which animates the outer layers) never fights it.
 */
const SMM_ORBIT: { Icon: (p: { className?: string }) => ReactNode; label: string; pos: string; hover: string; delay: string }[] = [
  { Icon: SiInstagram, label: "Instagram", pos: "left-[13%] top-[18%]", hover: "group-hover:-translate-y-1.5 group-hover:translate-x-2", delay: "0s" },
  { Icon: SiFacebook, label: "Facebook", pos: "left-[5%] top-[56%]", hover: "group-hover:-translate-y-2 group-hover:translate-x-1", delay: "-1.2s" },
  { Icon: FaLinkedinIn, label: "LinkedIn", pos: "left-[24%] top-[78%]", hover: "group-hover:-translate-x-2 group-hover:translate-y-1", delay: "-2.1s" },
  { Icon: SiX, label: "X", pos: "right-[13%] top-[14%]", hover: "group-hover:translate-y-1.5 group-hover:translate-x-1", delay: "-0.6s" },
  { Icon: SiThreads, label: "Threads", pos: "right-[4%] top-[50%]", hover: "group-hover:translate-y-2 group-hover:-translate-x-1", delay: "-1.8s" },
  { Icon: SiPinterest, label: "Pinterest", pos: "right-[22%] top-[80%]", hover: "group-hover:translate-x-2 group-hover:-translate-y-1", delay: "-2.6s" },
];

function SmmArt() {
  const ease = "transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]";
  return (
    <div aria-hidden data-art className="absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-1/2 h-[90%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(8_229_47/0.16),transparent)]" />
      <svg viewBox="0 0 400 200" preserveAspectRatio="none" className={`absolute inset-[6%_2%] h-[88%] w-[96%] ${ease} group-hover:rotate-[2deg]`}>
        <ellipse cx="200" cy="100" rx="190" ry="88" fill="none" stroke="rgb(255 255 255 / 0.08)" />
        <ellipse cx="200" cy="100" rx="128" ry="60" fill="none" stroke="rgb(255 255 255 / 0.06)" strokeDasharray="3 5" />
      </svg>

      {/* The post being published. */}
      <div className={`absolute left-1/2 top-[46%] w-[26%] min-w-[118px] max-w-[150px] -translate-x-1/2 -translate-y-1/2 rounded-[14px] p-1.5 ${ease} group-hover:-translate-y-[54%] ${glass}`}>
        <div className="flex items-center gap-1.5 px-1 pb-2 pt-0.5">
          <span className="size-4 rounded-full bg-[linear-gradient(135deg,var(--gx-accent),var(--gx-accent-hi))]" />
          <span className="h-1.5 w-12 rounded-full bg-white/40" />
        </div>
        <div className="aspect-[16/10] overflow-hidden rounded-[9px] bg-[linear-gradient(160deg,#1d2a22,#0a0e0c)]">
          <div className="h-full w-full bg-[radial-gradient(60%_70%_at_35%_35%,rgb(8_229_47/0.35),transparent_70%)]" />
        </div>
        <div className="flex items-center gap-2 px-1 pt-2 text-[0.5625rem] text-white/55">
          <span className="text-[var(--gx-accent)]">♥</span>
          <span className="h-1 w-8 rounded-full bg-white/25" />
          <span className="ml-auto h-1 w-5 rounded-full bg-white/15" />
        </div>
      </div>

      {SMM_ORBIT.map(({ Icon, label, pos, hover, delay }) => (
        <span key={label} className={`absolute ${pos} ${ease} ${hover}`}>
          <span
            className={`gx-bob grid size-9 place-items-center rounded-[11px] text-[var(--gx-silver)] transition-colors duration-500 group-hover:text-[var(--gx-accent)] ${glass}`}
            style={{ animationDelay: delay }}
          >
            <Icon className="size-4" />
          </span>
        </span>
      ))}

      <span className={`absolute right-[29%] top-[3%] flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.625rem] font-medium tabular-nums text-[var(--gx-text)] ${ease} group-hover:-translate-y-1 ${glass}`}>
        <span className="text-[var(--gx-accent)]">♥</span> 2.4k
      </span>
      <span className={`absolute bottom-[3%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.625rem] font-medium tabular-nums text-[var(--gx-accent)] ${ease} group-hover:translate-y-1 ${glass}`}>
        +312 followers
      </span>
    </div>
  );
}

/*
 * Backlinks & guest posts: an article on a publisher's site with the client's
 * keyword as a highlighted link, a green thread running from it to the client's
 * site, whose authority and referring domains climb. Two more publisher pages
 * sit behind, for "many placements". On hover the thread brightens and the
 * pages fan out a little.
 */
function BacklinksArt() {
  const ease = "transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]";
  const line = (w: string, o = "bg-white/15") => <span className={`block h-1.5 rounded-full ${o}`} style={{ width: w }} />;
  return (
    <div aria-hidden data-art className="@container absolute inset-0 overflow-hidden">
      <div className="absolute left-[30%] top-[10%] h-[90%] w-[60%] rounded-full bg-[radial-gradient(closest-side,rgb(8_229_47/0.13),transparent)]" />

      {/* Publisher pages behind. */}
      <div className={`absolute left-[9%] top-[14%] h-[58%] w-[34%] min-w-[150px] -rotate-6 @max-[520px]:left-[5%] @max-[520px]:h-[34%] @max-[520px]:w-[62%] rounded-[14px] opacity-50 ${ease} group-hover:-translate-x-2 group-hover:-rotate-[9deg] ${glass}`} />
      <div className={`absolute left-[12%] top-[10%] h-[62%] w-[34%] min-w-[150px] -rotate-3 @max-[520px]:left-[8%] @max-[520px]:h-[36%] @max-[520px]:w-[62%] rounded-[14px] opacity-70 ${ease} group-hover:-translate-x-1 group-hover:-rotate-[5deg] ${glass}`} />

      {/* The article carrying the link. */}
      <div className={`absolute left-[15%] top-[8%] w-[36%] min-w-[170px] rounded-[14px] p-4 @max-[520px]:left-[10%] @max-[520px]:w-[62%] ${ease} group-hover:-translate-y-1 ${glass}`}>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-white/25" />
          <span className="text-[0.5625rem] tracking-wide text-white/45">niche-blog.com / guide</span>
        </div>
        <span className="mt-3 block h-2.5 w-[80%] rounded-full bg-white/55" />
        <div className="mt-3 space-y-2">
          {line("100%")}
          {line("92%")}
          <span className="flex items-center gap-1.5">
            {line("26%")}
            <span className="whitespace-nowrap rounded-[4px] bg-[rgb(8_229_47/0.14)] px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--gx-accent)] underline decoration-[var(--gx-accent)]/60 underline-offset-2">
              your keyword
            </span>
            {line("30%")}
          </span>
          {line("86%")}
          {line("60%")}
        </div>
      </div>

      {/* The link travelling to the client's site. */}
      <svg viewBox="0 0 400 200" preserveAspectRatio="none" className="absolute inset-0 hidden h-full w-full @min-[520px]:block">
        <path
          d="M 150 92 C 215 92, 215 150, 268 150"
          fill="none"
          stroke="#08E52F"
          strokeWidth="1.5"
          strokeDasharray="4 5"
          vectorEffect="non-scaling-stroke"
          className="opacity-60 transition-opacity duration-500 group-hover:opacity-100"
        />
      </svg>
      {/* Narrow spaces (the opened card's panel, phones): the pages stack, so the thread runs down. */}
      <svg viewBox="0 0 400 200" preserveAspectRatio="none" className="absolute inset-0 h-full w-full @min-[520px]:hidden">
        <path
          d="M 70 84 C 70 118, 80 128, 118 128"
          fill="none"
          stroke="#08E52F"
          strokeWidth="1.5"
          strokeDasharray="4 5"
          vectorEffect="non-scaling-stroke"
          className="opacity-60 transition-opacity duration-500 group-hover:opacity-100"
        />
      </svg>

      {/* The client's site gaining authority. */}
      <div className={`absolute right-[9%] top-[46%] w-[30%] min-w-[150px] rounded-[14px] p-4 @max-[520px]:right-[8%] @max-[520px]:top-[54%] @max-[520px]:w-[62%] ${ease} group-hover:translate-x-1 ${glass}`}>
        <div className="flex items-center justify-between">
          <span className="text-[0.625rem] font-medium text-[var(--gx-text)]">yoursite.com</span>
          <span className="rounded-full border border-[var(--gx-accent)]/40 px-1.5 py-px text-[0.5rem] uppercase tracking-wider text-[var(--gx-accent)]">do-follow</span>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <span className="block text-[0.5625rem] text-white/45">Authority</span>
            <span className="whitespace-nowrap text-lg font-medium tabular-nums text-[var(--gx-text)]">
              52 <span className="text-[var(--gx-accent)]">→ 61</span>
            </span>
          </div>
          <svg viewBox="0 0 60 24" className="h-6 w-16">
            <path d="M0 22 L12 19 L24 20 L36 13 L48 9 L60 3" fill="none" stroke="#08E52F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="mt-2 block text-[0.5625rem] tabular-nums text-white/45">
          Referring domains <span className="text-[var(--gx-accent)]">+38</span>
        </span>
      </div>
    </div>
  );
}

function WebArt() {
  const t = "text-white/40";
  const a = "text-[var(--gx-silver)]";
  const v = "text-[var(--gx-accent)]";
  return (
    <div aria-hidden data-art className="absolute inset-0 overflow-hidden">
      <div className="absolute -right-10 bottom-0 h-3/4 w-3/4 rounded-full bg-[radial-gradient(closest-side,rgb(0_185_91/0.14),transparent)]" />
      <div className="absolute left-[8%] top-[4%] h-[110%] w-[110%] rounded-[16px] border border-white/[0.06]" />
      <div className={`absolute left-[14%] top-[10%] h-[110%] w-[100%] rounded-[16px] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-x-1.5 ${glass}`}>
        <div className="flex gap-1.5 px-4 py-3">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-2 rounded-full bg-white/20" />
          ))}
        </div>
        <pre className="px-5 font-mono text-[0.6875rem] leading-[2.1]">
          <span className={t}>&lt;head&gt;</span>
          {"\n  "}
          <span className={t}>&lt;meta </span>
          <span className={a}>charset</span>=<span className={v}>&apos;UTF-8&apos;</span>
          <span className={t}>&gt;</span>
          {"\n  "}
          <span className={t}>&lt;meta </span>
          <span className={a}>name</span>=<span className={v}>&apos;viewport&apos;</span>
          <span className={t}>&gt;</span>
          {"\n  "}
          <span className={t}>&lt;title&gt;</span>
          <span className="text-white/80">Your business</span>
          <span className={t}>&lt;/title&gt;</span>
          {"\n  "}
          <span className={t}>&lt;link </span>
          <span className={a}>rel</span>=<span className={v}>&apos;stylesheet&apos;</span>
          <span className={t}>&gt;</span>
          {"\n"}
          <span className={t}>&lt;/head&gt;</span>
          {"\n"}
          <span className={t}>&lt;body&gt;</span>
          {"\n  "}
          <span className={t}>&lt;main </span>
          <span className={a}>class</span>=<span className={v}>&apos;fast usable&apos;</span>
          <span className={t}>&gt;</span>
        </pre>
      </div>
    </div>
  );
}

function ShopifyArt() {
  return (
    <div aria-hidden data-art className="absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-0 h-full w-2/3 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(8_229_47/0.12),transparent)]" />
      <svg viewBox="0 0 300 150" className="absolute inset-x-6 bottom-2 h-[78%] w-[calc(100%-3rem)]" preserveAspectRatio="none">
        {[22, 30, 26, 40, 46, 58, 72, 92, 118].map((h, i) => (
          <rect
            key={i}
            x={8 + i * 32}
            y={150 - h}
            width="18"
            height={h}
            rx="3"
            fill={i > 6 ? "#08E52F" : "rgb(199 200 204 / 0.22)"}
            className="origin-bottom transition-transform duration-700 group-hover:scale-y-110"
            style={{ transformBox: "fill-box", transitionDelay: `${i * 30}ms` }}
          />
        ))}
      </svg>
      <span className="absolute left-7 top-6 grid size-14 place-items-center rounded-[14px] border border-white/15 bg-[linear-gradient(160deg,#26302a,#121614)] shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_14px_24px_-10px_rgb(0_0_0/0.9)]">
        <SiShopify className="size-6 text-[var(--gx-silver)]" />
      </span>
      <span className={`absolute right-7 top-7 rounded-full px-3 py-1.5 text-[0.625rem] font-medium text-[var(--gx-text)] ${glass}`}>SEO · Google Ads</span>
    </div>
  );
}

/* ---------- audience ---------- */

function CreatorsVisual() {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--gx-r-md)] bg-[var(--gx-s3)] shadow-[var(--gx-shadow-3)]">
      <div data-zoom className="absolute inset-0 bg-[radial-gradient(90%_70%_at_75%_15%,rgb(8_229_47/0.45),transparent_60%),linear-gradient(155deg,#1F2622_0%,#141417_70%)]" />
      <div aria-hidden className="absolute -bottom-1/3 -left-1/4 size-[80%] rounded-full border border-white/10" />
      <div aria-hidden className="absolute -bottom-1/4 -left-[15%] size-[60%] rounded-full border border-white/10" />
      <div data-depth="24" className="absolute left-5 top-5 flex items-center gap-3">
        <span className="size-9 rounded-full bg-gradient-to-br from-[var(--gx-accent-hi)] to-[#005A2C]" />
        <span className="space-y-1.5">
          <span className="block h-2 w-28 rounded-full bg-white/70" />
          <span className="block h-1.5 w-16 rounded-full bg-white/30" />
        </span>
      </div>
      <div data-depth="60" className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[var(--gx-text)] text-[var(--gx-bg)] shadow-[0_20px_40px_-10px_rgb(0_0_0/0.6)]">
        <Play className="ml-1 size-6 fill-current" />
      </div>
      <div data-depth="18" className="absolute inset-x-5 bottom-5">
        <div className="h-1 overflow-hidden rounded-full bg-white/20">
          <div className="h-full w-[62%] rounded-full bg-[var(--gx-accent)]" />
        </div>
        <div className="mt-2 flex justify-between text-[0.6875rem] tabular-nums text-white/60">
          <span>8:41</span>
          <span>14:02</span>
        </div>
      </div>
      <div data-depth="80" className="absolute right-4 top-1/4 w-44 rounded-[var(--gx-r-sm)] border border-white/15 bg-[var(--gx-bg)]/80 p-3 text-[0.6875rem] backdrop-blur-md sm:right-6">
        <p className="flex justify-between text-white/60">
          Subscribers <span className="tabular-nums text-white">1,000</span>
        </p>
        <p className="mt-1.5 flex justify-between text-white/60">
          Watch hours <span className="tabular-nums text-white">4,000</span>
        </p>
        <p className="mt-2.5 border-t border-white/10 pt-2 font-medium text-[var(--gx-accent-hi)]">Monetization eligible</p>
      </div>
    </div>
  );
}

function PublishersVisual() {
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--gx-r-md)] bg-[#E6E8E7] p-6 text-[#0D110F] shadow-[var(--gx-shadow-3)] sm:aspect-[5/6]">
      <div data-zoom className="absolute inset-0 bg-[linear-gradient(180deg,#F4F5F4,#CDD1CF)]" />
      <div className="relative">
        <p className="gx-eyebrow text-[0.5625rem] text-[#0D110F]/50">Article</p>
        <div className="mt-3 space-y-2">
          <span className="block h-3.5 w-[92%] rounded-sm bg-[#0D110F]" />
          <span className="block h-3.5 w-[64%] rounded-sm bg-[#0D110F]" />
        </div>
        <div className="mt-5 space-y-1.5">
          {[100, 96, 88, 94, 70].map((w, i) => (
            <span key={i} className="block h-1.5 rounded-full bg-[#0D110F]/20" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div data-depth="40" className="mt-5 grid h-24 place-items-center rounded-[var(--gx-r-sm)] border border-dashed border-[var(--gx-accent)] bg-[rgb(8_229_47/0.08)]">
          <span className="text-[0.6875rem] font-medium text-[#00873F]">Ad · Google AdSense</span>
        </div>
        <div className="mt-5 space-y-1.5">
          {[98, 90, 76].map((w, i) => (
            <span key={i} className="block h-1.5 rounded-full bg-[#0D110F]/20" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
      <div data-depth="70" className="absolute bottom-5 right-5 flex items-center gap-2 rounded-[var(--gx-r-sm)] bg-[#0D110F] px-3 py-2 text-[0.6875rem] text-[#F4F5F4] shadow-[0_16px_30px_-12px_rgb(0_0_0/0.5)]">
        <SiGoogleadsense className="size-3.5 text-[var(--gx-accent-hi)]" />
        Site approved
      </div>
    </div>
  );
}

function StoreVisual() {
  return (
    <div className="relative aspect-[5/4] overflow-hidden rounded-[var(--gx-r-md)] bg-[var(--gx-s3)] shadow-[var(--gx-shadow-3)]">
      <div data-zoom className="absolute inset-0 bg-[radial-gradient(70%_60%_at_30%_40%,#222A26,#141417_75%)]" />
      <div data-depth="30" className="absolute left-5 top-5 w-[52%] rounded-[var(--gx-r-sm)] border border-white/10 bg-[var(--gx-s2)] p-3">
        <div className="relative grid aspect-square place-items-center overflow-hidden rounded-[4px] bg-[linear-gradient(160deg,#2A332E,#1b1a1f)]">
          <span className="block h-[62%] w-[34%] rounded-t-[40%] rounded-b-md bg-[linear-gradient(90deg,#8D9290,#E4E6E8_45%,#9A9EA2)] shadow-[0_20px_30px_-10px_rgb(0_0_0/0.7)]" />
        </div>
        <span className="mt-3 block h-2 w-3/4 rounded-full bg-white/60" />
        <span className="mt-1.5 block h-1.5 w-1/3 rounded-full bg-white/25" />
        <span className="mt-3 flex items-center justify-center gap-1.5 rounded-[4px] bg-[var(--gx-accent)] py-1.5 text-[0.625rem] font-medium text-[var(--gx-accent-ink)]">
          <ShoppingBag className="size-3" /> Add to cart
        </span>
      </div>
      <div data-depth="70" className="absolute bottom-5 right-5 w-[44%] rounded-[var(--gx-r-sm)] border border-white/15 bg-[var(--gx-bg)]/85 p-3 backdrop-blur-md">
        <p className="flex items-center justify-between text-[0.625rem] text-white/60">
          <span className="flex items-center gap-1.5">
            <SiShopify className="size-3 text-white" /> Store traffic
          </span>
          <span className="text-[var(--gx-accent-hi)]">SEO · Ads</span>
        </p>
        <svg viewBox="0 0 120 40" className="mt-2 h-10 w-full" aria-hidden>
          {[8, 12, 10, 16, 15, 21, 24, 30, 34].map((h, i) => (
            <rect key={i} x={i * 13.5} y={40 - h} width="8" height={h} rx="1.5" fill={i > 6 ? "#08E52F" : "rgb(244 245 244 / 0.25)"} />
          ))}
        </svg>
      </div>
    </div>
  );
}

function BusinessVisual() {
  return (
    <div className="relative aspect-[16/9] overflow-hidden rounded-[var(--gx-r-md)] bg-[var(--gx-s3)] shadow-[var(--gx-shadow-3)] sm:aspect-[21/9]">
      <div data-zoom className="absolute inset-0 bg-[radial-gradient(80%_90%_at_85%_100%,rgb(8_229_47/0.28),transparent_60%),linear-gradient(180deg,#1d1d22,#121215)]" />
      <div data-depth="20" className="absolute left-5 top-5 bottom-5 w-[62%] overflow-hidden rounded-[var(--gx-r-sm)] border border-white/10 bg-[var(--gx-s2)]">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-2 rounded-full bg-white/15" />
          ))}
          <span className="ml-3 h-4 flex-1 rounded-[4px] bg-white/[0.06] px-2 text-[0.5625rem] leading-4 text-white/40">yourbrand.com</span>
        </div>
        <div className="grid grid-cols-5 gap-3 p-4">
          <div className="col-span-3 space-y-2">
            <span className="block h-3 w-[90%] rounded-sm bg-white/70" />
            <span className="block h-3 w-[60%] rounded-sm bg-white/70" />
            <span className="mt-3 block h-1.5 w-full rounded-full bg-white/15" />
            <span className="block h-1.5 w-[80%] rounded-full bg-white/15" />
            <span className="mt-3 inline-block h-5 w-20 rounded-full bg-[var(--gx-accent)]" />
          </div>
          <div className="col-span-2 rounded-[4px] bg-[linear-gradient(140deg,#2A332E,#1b1a1f)]" />
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-10 rounded-[4px] bg-white/[0.05] ${i === 2 ? "col-span-1" : "col-span-2"}`} />
          ))}
        </div>
      </div>
      <div data-depth="80" className="absolute bottom-6 right-5 w-[34%] min-w-[150px] rounded-[var(--gx-r-sm)] border border-white/15 bg-[var(--gx-bg)]/85 p-3 backdrop-blur-md sm:right-8">
        <div className="flex items-center gap-2">
          <span className="size-6 rounded-full bg-gradient-to-br from-[var(--gx-accent-hi)] to-[#005A2C]" />
          <span className="h-1.5 w-16 rounded-full bg-white/50" />
        </div>
        <div className="mt-2.5 aspect-[4/3] rounded-[4px] bg-[linear-gradient(140deg,#0E3A22,#1b1a1f)]" />
        <div className="mt-2 flex gap-3 text-[0.5625rem] tabular-nums text-white/60">
          <span>♥ 2.4k</span>
          <span>↻ 318</span>
          <span className="ml-auto text-[var(--gx-accent-hi)]">SMM</span>
        </div>
      </div>
    </div>
  );
}

function Audience() {
  const visual = {
    creators: <CreatorsVisual />,
    publishers: <PublishersVisual />,
    stores: <StoreVisual />,
    business: <BusinessVisual />,
  } as const;
  // Each audience sits in its own place on the grid, so no two read alike.
  const layout: Record<(typeof audiences)[number]["id"], { box: string; textFirst?: boolean }> = {
    creators: { box: "lg:col-span-7" },
    publishers: { box: "lg:col-span-4 lg:col-start-9 lg:mt-40", textFirst: true },
    stores: { box: "lg:col-span-5 lg:col-start-2 lg:-mt-16" },
    business: { box: "lg:col-span-6 lg:col-start-7 lg:mt-24" },
  };
  return (
    <section className="gx-section relative overflow-hidden">
      <Container>
        <div className="grid grid-cols-12 items-end gap-y-6">
          <div className="col-span-12 lg:col-span-9">
            <Eyebrow>Who we work with</Eyebrow>
            <SplitHeading text="Built for people turning" serif="attention into income." className="mt-5 text-[clamp(2.4rem,5.2vw,5rem)]" />
          </div>
        </div>

        <div className="mt-16 grid grid-cols-12 gap-x-6 gap-y-16 lg:mt-24 lg:gap-y-10">
          {audiences.map((a, i) => {
            const l = layout[a.id];
            const text = (
              <div className={l.textFirst ? "mb-6" : "mt-6"}>
                <p className="gx-eyebrow flex items-center gap-3 text-[var(--gx-accent-hi)]">
                  <span className="tabular-nums text-[var(--gx-dim)]">0{i + 1}</span>
                  {a.tag}
                </p>
                <h3 className="gx-display mt-3 text-[clamp(1.75rem,2.6vw,2.4rem)] text-[var(--gx-text)]">{a.t}</h3>
                <p className="mt-3 max-w-[44ch] leading-[1.65] text-[var(--gx-muted)]">{a.d}</p>
              </div>
            );
            return (
              <article key={a.id} data-rise className={`col-span-12 ${l.box}`}>
                {l.textFirst ? text : null}
                <div data-clip>
                  <Tilt max={5}>{visual[a.id]}</Tilt>
                </div>
                {!l.textFirst ? text : null}
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

/* ---------- why ---------- */

function Why() {
  const reduced = useMedia(REDUCED);
  const stage = useRef<HTMLDivElement>(null);

  // The market recedes while the Grow Xeno panel rises and its rows light up in turn.
  useGSAP(
    () => {
      if (reduced) return;
      const q = gsap.utils.selector(stage);
      gsap
        .timeline({ scrollTrigger: { trigger: stage.current, start: "top 85%", end: "center 45%", scrub: 0.8 } })
        .fromTo(q("[data-market]"), { scale: 1, autoAlpha: 1 }, { scale: 0.965, autoAlpha: 0.6, ease: "none" }, 0)
        .fromTo(q("[data-ours]"), { y: 110 }, { y: 0, ease: "none" }, 0)
        .fromTo(q("[data-ours-row]"), { autoAlpha: 0.25 }, { autoAlpha: 1, stagger: 0.12, ease: "none" }, 0.1)
        .fromTo(q("[data-ours-tick]"), { scale: 0 }, { scale: 1, stagger: 0.12, ease: "back.out(2)" }, 0.15);
    },
    { scope: stage, dependencies: [reduced] },
  );

  return (
    <section id="why" className="gx-section relative scroll-mt-[var(--gx-anchor)] overflow-hidden border-y border-[var(--gx-line)] bg-[var(--gx-s1)]">
      <div aria-hidden className="pointer-events-none absolute -right-1/4 top-1/3 h-[70%] w-[60%] rounded-full bg-[radial-gradient(closest-side,rgb(8_229_47/0.08),transparent)]" />
      <Container className="relative">
        <div className="grid grid-cols-12 gap-y-10">
          <div className="col-span-12 lg:col-span-7">
            <Eyebrow>Why Grow Xeno</Eyebrow>
            <SplitHeading text="Scams are common in this space." serif="Accountability isn't." className="mt-5 text-[clamp(2.4rem,5.2vw,5rem)]" />
          </div>
          <div className="col-span-12 lg:col-span-4 lg:col-start-9 lg:pt-10">
            <p className="leading-[1.65] text-[var(--gx-muted)]">That&apos;s the bar we hold ourselves to on every order. Here&apos;s what it means in practice.</p>
            <ul className="mt-8 divide-y divide-[var(--gx-line)] border-y border-[var(--gx-line)]">
              {whyPoints.map(([t, d], i) => (
                <li key={t} className="flex gap-4 py-4">
                  <span className="pt-0.5 text-xs tabular-nums text-[var(--gx-accent)]">0{i + 1}</span>
                  <span>
                    <span className="block font-medium text-[var(--gx-text)]">{t}</span>
                    <span className="mt-1 block text-sm leading-[1.6] text-[var(--gx-muted)]">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div ref={stage} className="relative mt-20 grid grid-cols-12 gap-y-4 lg:mt-28">
          {/* Recessed: what is common in the market. */}
          <div
            data-market
            className="col-span-12 rounded-[var(--gx-r-lg)] border border-[var(--gx-line)] bg-[var(--gx-bg)] p-6 shadow-[inset_0_2px_18px_rgb(0_0_0/0.55)] sm:p-9 lg:col-span-7 lg:col-start-1 lg:row-start-1 lg:pr-[31%]"
          >
            <p className="gx-eyebrow text-[var(--gx-dim)]">Common in the market</p>
            <ul className="mt-6 divide-y divide-[var(--gx-line)]">
              {comparison.map((c) => (
                <li key={c.area} className="grid gap-1 py-4 sm:grid-cols-[1fr_1.2fr] sm:gap-6">
                  <span className="text-xs text-[var(--gx-dim)]">{c.area}</span>
                  <span className="flex gap-2.5 text-[0.9375rem] text-[var(--gx-dim)]">
                    <X className="mt-1 size-3.5 shrink-0" aria-hidden />
                    <span>
                      <span className="sr-only">Common in the market: </span>
                      {c.market}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Raised: the Grow Xeno approach. */}
          <div data-ours className="relative z-10 col-span-12 lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:mt-24">
            <Tilt max={3}>
              <div className="relative overflow-hidden rounded-[var(--gx-r-lg)] border border-[var(--gx-line-2)] bg-[var(--gx-s3)] p-6 shadow-[var(--gx-shadow-3)] sm:p-9">
                <span aria-hidden className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[var(--gx-accent)] to-transparent" />
                <div className="flex items-center justify-between">
                  <Logo />
                  <span className="gx-eyebrow text-[var(--gx-accent-hi)]">The Grow Xeno way</span>
                </div>
                <ul className="mt-6 divide-y divide-[var(--gx-line)]">
                  {comparison.map((c) => (
                    <li key={c.area} data-ours-row className="grid gap-1 py-4 sm:grid-cols-[1fr_1.4fr] sm:gap-6">
                      <span className="text-xs font-medium text-[var(--gx-text)]">{c.area}</span>
                      <span className="flex gap-3 text-[0.9375rem] text-[var(--gx-text)]">
                        <span data-ours-tick className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-[var(--gx-accent)] text-[var(--gx-accent-ink)]">
                          <Check className="size-2.5" strokeWidth={3} aria-hidden />
                        </span>
                        <span>
                          <span className="sr-only">Grow Xeno: </span>
                          {c.us}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Tilt>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ---------- process ---------- */

function Process() {
  const reduced = useMedia(REDUCED);
  const section = useRef<HTMLElement>(null);
  const pinEl = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLOListElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const vline = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (reduced) return;
      const mm = gsap.matchMedia();
      const markSteps = (progress: number) => {
        const reached = Math.floor(progress * steps.length + 0.15);
        track.current?.querySelectorAll<HTMLElement>("[data-step]").forEach((el, i) => {
          el.dataset.on = String(i < Math.max(1, reached));
        });
      };
      // Large screens: the steps travel sideways while the section is pinned.
      mm.add("(min-width: 1024px) and (min-height: 680px)", () => {
        const distance = () => Math.max(0, (track.current?.scrollWidth ?? 0) - window.innerWidth + 96);
        gsap
          .timeline({
            scrollTrigger: {
              trigger: pinEl.current,
              start: "top top",
              end: () => `+=${distance() + window.innerHeight * 0.6}`,
              pin: true,
              scrub: 0.8,
              anticipatePin: 1,
              invalidateOnRefresh: true,
              onUpdate: (self) => markSteps(self.progress),
            },
          })
          .to(track.current, { x: () => -distance(), ease: "none" }, 0)
          .fromTo(line.current, { scaleX: 0 }, { scaleX: 1, ease: "none" }, 0);
      });
      // Smaller screens: a vertical line draws down through the steps.
      mm.add("(max-width: 1023px), (max-height: 679px)", () => {
        gsap.fromTo(vline.current, { scaleY: 0 }, {
          scaleY: 1,
          ease: "none",
          scrollTrigger: { trigger: track.current, start: "top 70%", end: "bottom 60%", scrub: 0.6, onUpdate: (self) => markSteps(self.progress) },
        });
      });
    },
    { scope: section, dependencies: [reduced] },
  );

  return (
    <section ref={section} id="process" className="relative scroll-mt-[var(--gx-anchor)]">
      <div ref={pinEl} className="relative overflow-hidden lg:flex lg:min-h-screen lg:flex-col lg:justify-center">
        <Container className="pt-[var(--gx-section)] lg:pt-24">
          <div className="grid grid-cols-12 items-end gap-y-6">
            <div className="col-span-12 lg:col-span-8">
              <Eyebrow>How it works</Eyebrow>
              <SplitHeading text="What happens after" serif="you get in touch." className="mt-5 text-[clamp(2.4rem,5.2vw,5rem)]" />
            </div>
            <p className="col-span-12 max-w-[36ch] leading-[1.65] text-[var(--gx-muted)] lg:col-span-4 lg:justify-self-end">
              Four steps, start to finish. You&apos;ll always know where your order stands.
            </p>
          </div>
        </Container>

        <div className="relative mt-14 lg:mt-20">
          <span aria-hidden className="absolute left-0 right-0 top-[clamp(4.5rem,8vw,7.5rem)] hidden h-px bg-[var(--gx-line)] lg:block">
            <span ref={line} className="block h-full origin-left scale-x-0 bg-[var(--gx-accent)] motion-reduce:scale-x-100" />
          </span>
          <Container className="relative lg:max-w-none lg:px-0">
            <span aria-hidden className="absolute bottom-6 left-[calc(1.25rem+1.4rem)] top-6 w-px bg-[var(--gx-line)] sm:left-[calc(2rem+1.4rem)] lg:hidden">
              <span ref={vline} className="block h-full origin-top scale-y-0 bg-[var(--gx-accent)] motion-reduce:scale-y-100" />
            </span>
            <ol ref={track} className="relative space-y-12 lg:flex lg:w-max lg:space-y-0 lg:pl-12 lg:pr-[20vw]">
              {steps.map((s, i) => (
                <li key={s.t} data-step data-on={reduced || i === 0 ? "true" : "false"} className="group relative grid grid-cols-[2.8rem_1fr] gap-x-5 lg:block lg:w-[min(36vw,520px)] lg:pr-16">
                  <span
                    aria-hidden
                    className="gx-display block text-[2.8rem] leading-none text-transparent transition-[color,-webkit-text-stroke-color] duration-700 [-webkit-text-stroke:1px_var(--gx-line-2)] group-data-[on=true]:text-[var(--gx-text)] group-data-[on=true]:[-webkit-text-stroke-color:transparent] lg:text-[clamp(9rem,15vw,15rem)] lg:tracking-[-0.06em]"
                  >
                    0{i + 1}
                  </span>
                  <span aria-hidden className="absolute left-0 top-[clamp(4.5rem,8vw,7.5rem)] hidden size-3 -translate-y-1/2 rounded-full border border-[var(--gx-line-2)] bg-[var(--gx-bg)] transition-colors duration-500 group-data-[on=true]:border-[var(--gx-accent)] group-data-[on=true]:bg-[var(--gx-accent)] lg:block" />
                  <div className="lg:mt-10">
                    <p className="gx-eyebrow text-[var(--gx-accent-hi)]">{s.when}</p>
                    <h3 className="gx-display mt-3 text-[clamp(1.6rem,2.4vw,2.25rem)] text-[var(--gx-text)]">
                      <span className="sr-only">Step {i + 1}: </span>
                      {s.t}
                    </h3>
                    <p className="mt-3 max-w-[34ch] leading-[1.65] text-[var(--gx-muted)]">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Container>
        </div>
      </div>
    </section>
  );
}

/* ---------- verification ---------- */

function Verification() {
  const reduced = useMedia(REDUCED);
  const box = useRef<HTMLDivElement>(null);
  const count = useRef<HTMLSpanElement>(null);
  const meter = useRef<HTMLSpanElement>(null);
  const stamp = useRef<HTMLDivElement>(null);

  // Scroll runs the inspection: each check passes in turn, then the report is stamped.
  useGSAP(
    () => {
      const rows = box.current?.querySelectorAll<HTMLElement>("[data-qc]") ?? [];
      const apply = (passed: number) => {
        rows.forEach((row, i) => (row.dataset.passed = String(i < passed)));
        if (count.current) count.current.textContent = String(passed);
        if (meter.current) meter.current.style.transform = `scaleX(${passed / handoverChecks.length})`;
        if (stamp.current) stamp.current.dataset.on = String(passed === handoverChecks.length);
      };
      if (reduced) {
        apply(handoverChecks.length);
        return;
      }
      apply(0);
      ScrollTrigger.create({
        trigger: box.current,
        start: "top 70%",
        end: "bottom 65%",
        scrub: true,
        onUpdate: (self) => apply(Math.min(handoverChecks.length, Math.floor(self.progress * (handoverChecks.length + 0.6)))),
      });
    },
    { scope: box, dependencies: [reduced] },
  );

  return (
    <section className="gx-section relative">
      <Container>
        <div
          ref={box}
          className="relative grid overflow-hidden rounded-[var(--gx-r-lg)] border border-[var(--gx-line-2)] bg-[var(--gx-s2)] shadow-[var(--gx-shadow-3)] lg:grid-cols-12"
        >
          <div aria-hidden className="gx-grain absolute inset-0" />
          <div className="relative border-b border-[var(--gx-line)] p-6 sm:p-10 lg:col-span-5 lg:border-b-0 lg:border-r lg:p-12">
            <Eyebrow className="text-[var(--gx-accent-hi)]">Pre-handover verification</Eyebrow>
            <SplitHeading text="Before every" serif="handover." className="mt-5 text-[clamp(2.2rem,4vw,3.75rem)]" />
            <p className="mt-6 max-w-[40ch] leading-[1.65] text-[var(--gx-muted)]">
              The work is checked against what was promised before it&apos;s called done. Nothing is handed over until every check has passed.
            </p>
            <div className="mt-10">
              <div className="flex items-baseline justify-between">
                <span className="gx-eyebrow text-[var(--gx-dim)]">Checks passed</span>
                <span className="gx-display text-3xl tabular-nums text-[var(--gx-text)]">
                  <span ref={count}>{reduced ? handoverChecks.length : 0}</span>
                  <span className="text-[var(--gx-dim)]"> / {handoverChecks.length}</span>
                </span>
              </div>
              <span className="mt-3 block h-1 overflow-hidden rounded-full bg-[var(--gx-line)]">
                <span ref={meter} className="block h-full origin-left rounded-full bg-[var(--gx-accent)] transition-transform duration-500" style={{ transform: `scaleX(${reduced ? 1 : 0})` }} />
              </span>
            </div>
          </div>

          <div className="relative p-6 sm:p-10 sm:pb-44 lg:col-span-7 lg:p-12 lg:pb-44">
            <div className="hidden grid-cols-[4.5rem_1fr_6.5rem] gap-4 border-b border-[var(--gx-line)] pb-3 sm:grid">
              {["Check", "What is verified", "Status"].map((h) => (
                <span key={h} className="gx-eyebrow text-[var(--gx-dim)] last:text-right">
                  {h}
                </span>
              ))}
            </div>
            <ol>
              {handoverChecks.map((c) => (
                <li
                  key={c.code}
                  data-qc
                  data-passed={reduced ? "true" : "false"}
                  className="gx-check grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-[var(--gx-line)] py-6 sm:grid-cols-[4.5rem_1fr_6.5rem] sm:items-center"
                >
                  <span className="text-xs tabular-nums text-[var(--gx-accent)] sm:order-none">{c.code}</span>
                  <span className="relative col-start-2 row-start-1 h-5 w-[6.5rem] justify-self-end sm:col-start-3">
                    <span className="gx-check-pending absolute inset-0 flex items-center justify-end gap-2 text-xs text-[var(--gx-dim)] transition-all duration-500">
                      <span className="size-1.5 animate-pulse rounded-full bg-[var(--gx-dim)] motion-reduce:animate-none" />
                      Pending
                    </span>
                    <span className="gx-check-passed absolute inset-0 flex items-center justify-end gap-2 text-xs font-medium text-[var(--gx-accent-hi)] transition-all duration-500">
                      <Check className="size-3.5" strokeWidth={3} aria-hidden />
                      Passed
                    </span>
                  </span>
                  <span className="col-span-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                    <span className="block font-medium text-[var(--gx-text)]">{c.t}</span>
                    <span className="mt-1 block text-sm text-[var(--gx-muted)]">{c.how}</span>
                  </span>
                </li>
              ))}
            </ol>

            <div ref={stamp} data-on={reduced ? "true" : "false"} aria-hidden className="gx-stamp pointer-events-none mt-8 ml-auto w-max sm:absolute sm:bottom-8 sm:right-10 sm:mt-0">
              <div className="grid size-28 place-items-center rounded-full border-2 border-[var(--gx-accent)] p-2 text-center text-[var(--gx-accent)]">
                <div className="grid size-full place-items-center rounded-full border border-dashed border-[var(--gx-accent)]/60">
                  <span className="gx-eyebrow text-[0.5625rem] leading-[1.5]">
                    Cleared
                    <br />
                    for
                    <br />
                    handover
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-5 border-t border-[var(--gx-line)] pt-8 sm:flex-row sm:items-center">
          <div>
            <p className="text-lg font-medium text-[var(--gx-text)]">Step one takes a couple of minutes.</p>
            <p className="mt-1 text-[var(--gx-muted)]">Tell us your goal and we&apos;ll come back with a straight quote.</p>
          </div>
          <Magnetic>
            <Btn href="#contact">
              Start with step one <ArrowRight className="size-4" aria-hidden />
            </Btn>
          </Magnetic>
        </div>
      </Container>
    </section>
  );
}

/* ---------- FAQ ---------- */

function Faq() {
  const { email: EMAIL } = useContact();
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="gx-section scroll-mt-[var(--gx-anchor)] border-t border-[var(--gx-line)]">
      <Container className="grid grid-cols-12 gap-y-12 lg:gap-x-10">
        <div className="col-span-12 lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <Eyebrow>FAQ</Eyebrow>
            <SplitHeading text="Good to know" serif="before you reach out." className="mt-5 text-[clamp(2.2rem,4vw,3.75rem)]" />
            <div className="mt-10 border-t border-[var(--gx-line)] pt-6">
              <p className="font-medium text-[var(--gx-text)]">Have a different question?</p>
              <p className="mt-1 text-sm text-[var(--gx-muted)]">You&apos;ll get an answer from a real person.</p>
              <a href={`mailto:${EMAIL}`} className={`mt-4 inline-flex items-center gap-1.5 break-all rounded-[var(--gx-r-sm)] text-sm font-medium text-[var(--gx-accent-hi)] hover:text-[var(--gx-text)] ${ring}`}>
                {EMAIL} <ArrowUpRight className="size-4 shrink-0" aria-hidden />
              </a>
            </div>
          </div>
        </div>
        <div className="col-span-12 border-t border-[var(--gx-line)] lg:col-span-7 lg:col-start-6">
          {faqs.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <div key={q} className="border-b border-[var(--gx-line)]">
                <h3>
                  <button
                    type="button"
                    id={`faq-q-${i}`}
                    aria-controls={`faq-a-${i}`}
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    className={`group grid w-full grid-cols-[2.25rem_1fr_auto] items-start gap-x-3 py-6 text-left sm:py-7 ${ring}`}
                  >
                    <span className={`pt-1 text-xs tabular-nums transition-colors duration-500 ${isOpen ? "text-[var(--gx-accent)]" : "text-[var(--gx-dim)]"}`}>0{i + 1}</span>
                    <span className={`text-[1.0625rem] font-medium leading-snug transition-colors duration-300 sm:text-xl ${isOpen ? "text-[var(--gx-text)]" : "text-[var(--gx-text)]/80 group-hover:text-[var(--gx-text)]"}`}>
                      {q}
                    </span>
                    <span
                      aria-hidden
                      className={`grid size-9 place-items-center rounded-[var(--gx-r-sm)] border transition-colors duration-500 ${
                        isOpen ? "border-[var(--gx-accent)] text-[var(--gx-accent)]" : "border-[var(--gx-line-2)] text-[var(--gx-muted)] group-hover:border-[var(--gx-text)]/40"
                      }`}
                    >
                      <Plus className={`size-4 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isOpen ? "rotate-45" : ""}`} />
                    </span>
                  </button>
                </h3>
                <div
                  id={`faq-a-${i}`}
                  role="region"
                  aria-labelledby={`faq-q-${i}`}
                  className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                >
                  <div className="overflow-hidden">
                    <p className="max-w-[62ch] pb-7 pl-[3rem] leading-[1.7] text-[var(--gx-muted)]">{a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

/* ---------- contact ---------- */

function Contact() {
  const { email: EMAIL, phone, whatsapp, whatsappMessage } = useContact();
  const [service, setService] = useState("");
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A service's "Get a quote" pre-selects it here.
  useEffect(() => {
    const pick = (e: Event) => {
      const name = (e as CustomEvent<string>).detail;
      if (typeof name === "string") setService(name);
    };
    window.addEventListener(SERVICE_EVENT, pick);
    return () => window.removeEventListener(SERVICE_EVENT, pick);
  }, []);

  // Saved as an Inquiry (2026-11-04). The server validates and rate-limits it.
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

  const input =
    "mt-2 w-full rounded-[var(--gx-r-sm)] border border-[var(--gx-line-2)] bg-[var(--gx-s1)] px-4 py-3 text-[0.9375rem] text-[var(--gx-text)] outline-none transition-[border-color,box-shadow] duration-300 placeholder:text-[var(--gx-dim)] hover:border-[var(--gx-text)]/25 focus:border-[var(--gx-accent)] focus:shadow-[0_0_0_4px_rgb(8_229_47/0.15)]";

  return (
    <section id="contact" className="gx-section relative scroll-mt-[var(--gx-anchor)] overflow-hidden border-t border-[var(--gx-line)] bg-[var(--gx-s1)]">
      <div aria-hidden className="pointer-events-none absolute -left-1/4 top-0 h-[80%] w-[60%] rounded-full bg-[radial-gradient(closest-side,rgb(8_229_47/0.09),transparent)]" />
      <Container className="relative grid grid-cols-12 gap-y-14 lg:gap-x-12">
        <div className="col-span-12 lg:col-span-5">
          <Eyebrow>Get started</Eyebrow>
          <SplitHeading text="Tell us what you need." serif="Get a straight quote back." className="mt-5 text-[clamp(2.4rem,4.6vw,4.5rem)]" />
          <p className="mt-7 max-w-[42ch] leading-[1.65] text-[var(--gx-muted)] sm:text-lg">
            A channel, an account, a store or a site. Describe your goal and we&apos;ll reply directly.
          </p>
          <ul className="mt-8 border-t border-[var(--gx-line)] text-[0.9375rem] text-[var(--gx-text)]/90">
            {["A clear price for exactly what you asked for", "No bundled upsells", "Verified before handover, supported after"].map((t, i) => (
              <li key={t} className="flex gap-4 border-b border-[var(--gx-line)] py-3.5">
                <span className="pt-0.5 text-xs tabular-nums text-[var(--gx-accent)]">0{i + 1}</span>
                {t}
              </li>
            ))}
          </ul>

          <dl className="mt-10 space-y-6">
            <div>
              <dt className="gx-eyebrow text-[var(--gx-dim)]">Email</dt>
              <dd>
                <a href={`mailto:${EMAIL}`} className={`gx-display mt-2 inline-block break-all rounded-[var(--gx-r-sm)] text-[clamp(1.4rem,2.2vw,1.9rem)] tracking-[-0.03em] text-[var(--gx-text)] transition-colors hover:text-[var(--gx-accent-hi)] ${ring}`}>
                  {EMAIL}
                </a>
              </dd>
            </div>
            {whatsapp ? (
              <div>
                <dt className="gx-eyebrow text-[var(--gx-dim)]">WhatsApp</dt>
                <dd>
                  <a
                    href={whatsappHref(whatsapp, whatsappMessage)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`group mt-2 inline-flex items-center gap-3 rounded-[var(--gx-r-sm)] text-lg font-medium tabular-nums text-[var(--gx-text)] transition-colors hover:text-[var(--gx-accent-hi)] ${ring}`}
                  >
                    <SiWhatsapp className="size-5 text-[var(--gx-accent)]" />
                    {whatsapp}
                    <ArrowUpRight className="size-4 transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                  </a>
                </dd>
              </div>
            ) : null}
            {phone ? (
              <div>
                <dt className="gx-eyebrow text-[var(--gx-dim)]">Call us</dt>
                <dd>
                  <a href={telHref(phone)} className={`mt-2 inline-flex items-center gap-3 rounded-[var(--gx-r-sm)] text-lg font-medium tabular-nums text-[var(--gx-text)] transition-colors hover:text-[var(--gx-accent-hi)] ${ring}`}>
                    <Phone className="size-5 text-[var(--gx-accent)]" aria-hidden />
                    {phone}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="gx-eyebrow mt-8 text-[var(--gx-dim)]">Remote-first · Worldwide</p>
        </div>

        <div data-rise className="col-span-12 lg:col-span-7">
          <div className="relative overflow-hidden rounded-[var(--gx-r-lg)] border border-[var(--gx-line-2)] bg-[var(--gx-s3)] shadow-[var(--gx-shadow-3)]">
            <span aria-hidden className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[var(--gx-accent)] to-transparent" />
            {sent ? (
              <div className="flex min-h-[540px] flex-col items-start justify-center p-6 sm:p-12" role="status">
                <span className="grid size-14 place-items-center rounded-full bg-[var(--gx-accent)] text-[var(--gx-accent-ink)] shadow-[0_12px_30px_-10px_rgb(8_229_47/0.8)]">
                  <Check className="size-7" strokeWidth={2.5} aria-hidden />
                </span>
                <h3 className="gx-display mt-7 text-4xl text-[var(--gx-text)]">Thanks, your inquiry is in.</h3>
                <p className="mt-3 max-w-[44ch] leading-[1.65] text-[var(--gx-muted)]">
                  We&apos;ll reply to the email you gave us. Need to add something? Write to{" "}
                  <a href={`mailto:${EMAIL}`} className="font-medium text-[var(--gx-accent-hi)] hover:underline">
                    {EMAIL}
                  </a>
                  .
                </p>
                <button type="button" onClick={() => setSent(false)} className={`mt-7 rounded-[var(--gx-r-sm)] text-sm font-medium text-[var(--gx-accent-hi)] hover:underline ${ring}`}>
                  Send another inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="relative p-6 sm:p-10 lg:p-12" aria-busy={pending}>
                {/* Honeypot: hidden from people and screen readers; bots tend to fill it. */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                  <label>
                    Company
                    <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
                  </label>
                </div>
                <fieldset>
                  <legend className="gx-eyebrow text-[var(--gx-dim)]">What can we help with?</legend>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[...services.map((x) => x.name), "Not sure yet"].map((n) => (
                      <button
                        type="button"
                        key={n}
                        onClick={() => setService(service === n ? "" : n)}
                        aria-pressed={service === n}
                        className={`rounded-[var(--gx-r-sm)] border px-3.5 py-3 text-left text-[0.8125rem] font-medium leading-snug transition-[border-color,background-color,color] duration-300 sm:text-sm ${ring} ${
                          service === n
                            ? "border-[var(--gx-accent)] bg-[rgb(8_229_47/0.1)] text-[var(--gx-text)]"
                            : "border-[var(--gx-line-2)] text-[var(--gx-muted)] hover:border-[var(--gx-text)]/30 hover:text-[var(--gx-text)]"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div className="mt-7 grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-[var(--gx-text)]">
                    Name
                    <input required name="name" autoComplete="name" className={input} placeholder="Your name" />
                  </label>
                  <label className="block text-sm font-medium text-[var(--gx-text)]">
                    Email
                    <input required type="email" name="email" autoComplete="email" className={input} placeholder="you@example.com" />
                  </label>
                </div>
                <label className="mt-4 block text-sm font-medium text-[var(--gx-text)]">
                  Your goal
                  <textarea required name="message" rows={5} className={`${input} resize-none`} placeholder="e.g. I want my YouTube channel to reach monetization" />
                </label>
                {error ? (
                  <p role="alert" className="mt-4 rounded-[var(--gx-r-sm)] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={pending}
                  className={`group relative mt-7 inline-flex h-13 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-[var(--gx-accent)] px-6 py-3.5 font-medium text-[var(--gx-accent-ink)] shadow-[0_10px_30px_-12px_rgb(8_229_47/0.75)] transition-shadow duration-500 hover:shadow-[0_14px_40px_-10px_rgb(8_229_47/0.9)] disabled:opacity-70 ${ring}`}
                >
                  <span aria-hidden className="absolute inset-0 translate-y-full rounded-full bg-[var(--gx-accent-hi)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0" />
                  <span className="relative inline-flex items-center gap-2">
                    {pending ? "Sending…" : (
                      <>
                        Send inquiry <ArrowRight className="size-4" aria-hidden />
                      </>
                    )}
                  </span>
                </button>
                <p className="mt-3 text-center text-xs text-[var(--gx-dim)]">We&apos;ll reply to the email you give us.</p>
              </form>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ---------- footer ---------- */

function Footer() {
  const { email: EMAIL, phone, whatsapp, whatsappMessage } = useContact();
  return (
    <footer className="relative isolate overflow-hidden border-t border-[var(--gx-line)] pb-24 md:pb-0">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="gx-ambient absolute -bottom-1/2 left-1/4 h-[90%] w-[70%] rounded-full bg-[radial-gradient(closest-side,rgb(8_229_47/0.16),transparent)]" />
        <div className="gx-grain absolute inset-0" />
      </div>
      <Container className="grid grid-cols-2 gap-x-6 gap-y-12 pt-20 md:grid-cols-12 lg:pt-28">
        <div className="col-span-2 md:col-span-5">
          <Logo size="lg" />
          <p className="mt-5 max-w-[36ch] leading-[1.65] text-[var(--gx-muted)]">Digital growth services, run honestly. Verified before handover, supported after.</p>
          <Magnetic className="mt-8">
            <Btn href="#contact">
              Book a meeting <ArrowUpRight className="size-4" aria-hidden />
            </Btn>
          </Magnetic>
        </div>
        <nav aria-label="Services" className="md:col-span-2 md:col-start-7">
          <p className="gx-eyebrow text-[var(--gx-dim)]">Services</p>
          <ul className="mt-5 space-y-3 text-sm text-[var(--gx-muted)]">
            {services.map((x) => (
              <li key={x.id}>
                <a href="#services" className="transition-colors hover:text-[var(--gx-text)]">
                  {x.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Company" className="md:col-span-2">
          <p className="gx-eyebrow text-[var(--gx-dim)]">Company</p>
          <ul className="mt-5 space-y-3 text-sm text-[var(--gx-muted)]">
            {([["Why Grow Xeno", "#why"], ["How it works", "#process"], ["FAQ", "#faq"], ["Contact", "#contact"]] as [string, string][]).map(([l, h]) => (
              <li key={h}>
                <a href={h} className="transition-colors hover:text-[var(--gx-text)]">
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="col-span-2 md:col-span-2">
          <p className="gx-eyebrow text-[var(--gx-dim)]">Contact</p>
          <ul className="mt-5 space-y-3 text-sm text-[var(--gx-muted)]">
            <li>
              <a href={`mailto:${EMAIL}`} className="break-all transition-colors hover:text-[var(--gx-text)]">
                {EMAIL}
              </a>
            </li>
            {whatsapp ? (
              <li>
                <a href={whatsappHref(whatsapp, whatsappMessage)} target="_blank" rel="noreferrer noopener" className="tabular-nums transition-colors hover:text-[var(--gx-text)]">
                  WhatsApp {whatsapp}
                </a>
              </li>
            ) : null}
            {phone ? (
              <li>
                <a href={telHref(phone)} className="tabular-nums transition-colors hover:text-[var(--gx-text)]">
                  {phone}
                </a>
              </li>
            ) : null}
            <li>Remote-first, worldwide</li>
          </ul>
          <SocialLinks className="mt-5" />
        </div>
      </Container>
      <Container className="mt-16 flex flex-col justify-between gap-2 border-t border-[var(--gx-line)] py-6 text-xs text-[var(--gx-dim)] sm:flex-row">
        <span>© {new Date().getFullYear()} Grow Xeno. All rights reserved.</span>
        <a href="#top" className="transition-colors hover:text-[var(--gx-text)]">
          Back to top ↑
        </a>
      </Container>
      <svg data-wordmark aria-hidden viewBox="0 0 1000 118" className="relative -mb-[1.2vw] block w-full select-none">
        <defs>
          <linearGradient id="gx-wordmark" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#F4F5F4" stopOpacity="0.9" />
            <stop offset="1" stopColor="#F4F5F4" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <text
          x="0"
          y="114"
          textLength="1000"
          lengthAdjust="spacingAndGlyphs"
          fill="url(#gx-wordmark)"
          style={{ fontFamily: "var(--font-gx-display), sans-serif", fontWeight: 600, fontSize: 160, letterSpacing: "-0.05em" }}
        >
          GROW XENO
        </text>
      </svg>
    </footer>
  );
}

function MobileCta() {
  const { email: EMAIL, whatsapp, whatsappMessage } = useContact();
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--gx-line)] bg-[var(--gx-bg)]/85 p-3 backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-[auto_1fr] gap-2">
        {whatsapp ? (
          <Btn href={whatsappHref(whatsapp, whatsappMessage)} variant="ghost" className="h-11 px-4">
            <SiWhatsapp className="size-4" />
            WhatsApp
          </Btn>
        ) : (
          <Btn href={`mailto:${EMAIL}`} variant="ghost" className="h-11 px-4">
            <Mail className="size-4" aria-hidden />
            Email
          </Btn>
        )}
        <Btn href="#contact" className="h-11">
          Book a meeting
        </Btn>
      </div>
    </div>
  );
}
