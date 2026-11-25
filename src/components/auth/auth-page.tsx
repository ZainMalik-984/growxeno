import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { SITE_HOME } from "@/lib/routing/hosts";

/**
 * Full-page auth shell — same animated-line background as /login.
 * Used by forgot-password, reset-password, account-inactive (2026-11-25).
 *
 * Server component: no "use client" needed here. The animated SVG uses pure
 * CSS @keyframes so it works without JavaScript.
 */
export function AuthPageLayout({
  children,
  footer,
}: {
  children: ReactNode;
  /** Optional content below the card (e.g. "Back to sign in" link). */
  footer?: ReactNode;
}) {
  return (
    <div className="gxo relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[var(--gx-bg)] px-6 py-10">
      <AuthLines />

      {/* Radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 55%, rgb(8 229 47 / 0.055) 0%, transparent 70%)",
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-[400px]">
        {/* Logo */}
        <div className="mb-10 flex items-center gap-2.5">
          <Link href={SITE_HOME} aria-label="Grow Xeno home" className="flex items-center gap-2.5 rounded-[6px]">
            <Image
              src="/brand/gx-symbol-light.svg"
              alt=""
              aria-hidden
              width={1050}
              height={780}
              className="h-7 w-auto"
              priority
            />
            <span className="gx-display text-base tracking-[-0.03em] text-[var(--gx-text)]">Grow Xeno</span>
          </Link>
        </div>

        {children}

        {footer ? (
          <div className="mt-8 border-t border-[var(--gx-line)] pt-6 text-center text-xs text-[var(--gx-dim)]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Heading block: large title + optional description. */
export function AuthPageHeading({
  title,
  description,
}: {
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="mb-8">
      <h1 className="gx-display text-[2rem] font-semibold leading-none tracking-[-0.04em] text-[var(--gx-text)]">
        {title}
      </h1>
      {description ? (
        <p className="mt-2.5 max-w-[36ch] text-[0.875rem] leading-relaxed text-[var(--gx-muted)]">{description}</p>
      ) : null}
    </div>
  );
}

/**
 * Animated SVG curved streaks — comet effect (2026-11-25).
 *
 * Short bright segments travel along each path using stroke-dasharray + dashoffset.
 * stroke-dasharray: "HEAD GAP" — HEAD px visible, GAP px invisible.
 * Animating dashoffset from (HEAD+GAP) → 0 moves the comet along the full path.
 * Multiple comets at staggered delays keep at least 2–3 always in motion.
 *
 * Two glow tracks (thicker, very low opacity) provide a soft ambient depth
 * behind the sharper comets.
 */
export function AuthLines() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 1200 800"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="gx-glow" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="gx-glow-sm" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <style>{`
          @keyframes gx-c {
            0%   { stroke-dashoffset: 2700; opacity: 0; }
            5%   { opacity: 1; }
            85%  { opacity: 1; }
            100% { stroke-dashoffset: 0; opacity: 0; }
          }
          @keyframes gx-cr {
            0%   { stroke-dashoffset: -2700; opacity: 0; }
            5%   { opacity: 1; }
            85%  { opacity: 1; }
            100% { stroke-dashoffset: 0; opacity: 0; }
          }
          .gxs { fill: none; stroke-linecap: round; }
          .gxc  { animation: gx-c  var(--d,12s) linear var(--dl,0s) infinite; }
          .gxcr { animation: gx-cr var(--d,12s) linear var(--dl,0s) infinite; }
          @media (prefers-reduced-motion: reduce) {
            .gxc, .gxcr { animation: none; opacity: 0.07; }
          }
        `}</style>
      </defs>

      {/* ══ PLANE A — main sweep, bottom-left → top-right ══ */}
      {/* Halo */}
      <path className="gxs gxc" d="M-100 650 C200 580 400 200 700 160 S1050 300 1350 180"
        stroke="#08e52f" strokeWidth="1.1" strokeDasharray="220 2480" opacity="0.5"
        filter="url(#gx-glow)"
        style={{ "--d": "11s", "--dl": "0s" } as React.CSSProperties} />
      {/* Bright thin core */}
      <path className="gxs gxc" d="M-100 650 C200 580 400 200 700 160 S1050 300 1350 180"
        stroke="#b0ffcc" strokeWidth="0.3" strokeDasharray="90 2610" opacity="1"
        style={{ "--d": "11s", "--dl": "0s" } as React.CSSProperties} />
      {/* Phase fill */}
      <path className="gxs gxc" d="M-100 650 C200 580 400 200 700 160 S1050 300 1350 180"
        stroke="#08e52f" strokeWidth="0.45" strokeDasharray="140 2560" opacity="0.38"
        style={{ "--d": "11s", "--dl": "5.5s" } as React.CSSProperties} />

      {/* ══ PLANE B — reverse sweep, top-right → bottom-left ══ */}
      <path className="gxs gxcr" d="M1400 500 C1100 440 860 620 580 540 S220 350 -120 420"
        stroke="#08e52f" strokeWidth="0.9" strokeDasharray="190 2510" opacity="0.45"
        filter="url(#gx-glow-sm)"
        style={{ "--d": "13s", "--dl": "5s" } as React.CSSProperties} />
      <path className="gxs gxcr" d="M1400 500 C1100 440 860 620 580 540 S220 350 -120 420"
        stroke="#b0ffcc" strokeWidth="0.28" strokeDasharray="75 2625" opacity="0.9"
        style={{ "--d": "13s", "--dl": "5s" } as React.CSSProperties} />
      <path className="gxs gxcr" d="M1400 500 C1100 440 860 620 580 540 S220 350 -120 420"
        stroke="#00b95b" strokeWidth="0.4" strokeDasharray="130 2570" opacity="0.3"
        style={{ "--d": "13s", "--dl": "11.5s" } as React.CSSProperties} />

      {/* ══ PLANE C — crossing diagonal, top-left → bottom-right ══ */}
      {/* Crosses planes A & B — creates the 3-D intersection feel */}
      <path className="gxs gxc" d="M-80 50 C180 220 420 380 650 440 S1000 580 1380 720"
        stroke="#08e52f" strokeWidth="0.75" strokeDasharray="160 2540" opacity="0.4"
        filter="url(#gx-glow-sm)"
        style={{ "--d": "14s", "--dl": "2s" } as React.CSSProperties} />
      <path className="gxs gxc" d="M-80 50 C180 220 420 380 650 440 S1000 580 1380 720"
        stroke="#b0ffcc" strokeWidth="0.25" strokeDasharray="60 2640" opacity="0.9"
        style={{ "--d": "14s", "--dl": "2s" } as React.CSSProperties} />
      {/* Counter-traffic on same path */}
      <path className="gxs gxcr" d="M-80 50 C180 220 420 380 650 440 S1000 580 1380 720"
        stroke="#00b95b" strokeWidth="0.45" strokeDasharray="110 2590" opacity="0.3"
        style={{ "--d": "16s", "--dl": "9s" } as React.CSSProperties} />

      {/* ══ PLANE D — near-horizontal mid-screen spark rail ══ */}
      {/* Tiny 8 px sparks fly across a nearly flat curve — very different rhythm */}
      <path className="gxs gxc" d="M-100 390 C200 370 500 415 800 395 S1100 375 1420 400"
        stroke="#08e52f" strokeWidth="0.5" strokeDasharray="8 2650" opacity="0.65"
        style={{ "--d": "5s", "--dl": "0s" } as React.CSSProperties} />
      <path className="gxs gxc" d="M-100 390 C200 370 500 415 800 395 S1100 375 1420 400"
        stroke="#08e52f" strokeWidth="0.5" strokeDasharray="8 2650" opacity="0.65"
        style={{ "--d": "5s", "--dl": "2.5s" } as React.CSSProperties} />
      <path className="gxs gxcr" d="M-100 390 C200 370 500 415 800 395 S1100 375 1420 400"
        stroke="#c7c8cc" strokeWidth="0.4" strokeDasharray="6 2652" opacity="0.35"
        style={{ "--d": "6s", "--dl": "1.5s" } as React.CSSProperties} />

      {/* ══ PLANE E — left edge vertical curve (into/out-of screen feel) ══ */}
      <path className="gxs gxc" d="M75 -60 C100 150 45 350 85 560 S55 760 90 900"
        stroke="#c7c8cc" strokeWidth="0.45" strokeDasharray="90 2610" opacity="0.2"
        style={{ "--d": "21s", "--dl": "4s" } as React.CSSProperties} />
      <path className="gxs gxcr" d="M75 -60 C100 150 45 350 85 560 S55 760 90 900"
        stroke="#08e52f" strokeWidth="0.35" strokeDasharray="55 2645" opacity="0.17"
        style={{ "--d": "24s", "--dl": "14s" } as React.CSSProperties} />

      {/* ══ PLANE F — right edge vertical curve ══ */}
      <path className="gxs gxcr" d="M1125 -60 C1095 150 1155 350 1115 560 S1145 760 1110 900"
        stroke="#c7c8cc" strokeWidth="0.4" strokeDasharray="80 2620" opacity="0.17"
        style={{ "--d": "23s", "--dl": "8s" } as React.CSSProperties} />
      <path className="gxs gxc" d="M1125 -60 C1095 150 1155 350 1115 560 S1145 760 1110 900"
        stroke="#08e52f" strokeWidth="0.3" strokeDasharray="50 2650" opacity="0.14"
        style={{ "--d": "27s", "--dl": "19s" } as React.CSSProperties} />

      {/* ══ PLANE G — far ghost arcs (z-depth background layer) ══ */}
      <path className="gxs gxc" d="M-200 720 C100 620 500 280 820 200 S1250 360 1550 140"
        stroke="#08e52f" strokeWidth="0.4" strokeDasharray="300 2400" opacity="0.1"
        style={{ "--d": "26s", "--dl": "0s" } as React.CSSProperties} />
      <path className="gxs gxcr" d="M1550 580 C1200 510 900 660 580 590 S180 390 -180 460"
        stroke="#08e52f" strokeWidth="0.35" strokeDasharray="260 2440" opacity="0.08"
        style={{ "--d": "30s", "--dl": "12s" } as React.CSSProperties} />
    </svg>
  );
}
