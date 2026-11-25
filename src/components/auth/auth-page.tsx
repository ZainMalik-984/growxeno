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
        {/* Glow halo: blurred duplicate behind the sharp core = 3-D depth illusion */}
        <filter id="gx-glow" x="-40%" y="-40%" width="180%" height="180%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="3" result="blur" />
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

      {/* ── Far depth — very faint, slow, wide arcs ── */}
      <path className="gxs gxc" d="M-200 720 C100 620 500 280 820 200 S1250 360 1550 140"
        stroke="#08e52f" strokeWidth="0.4" strokeDasharray="380 2320" opacity="0.13"
        style={{ "--d": "24s", "--dl": "0s" } as React.CSSProperties} />
      <path className="gxs gxcr" d="M1550 580 C1200 510 900 660 580 590 S180 390 -180 460"
        stroke="#08e52f" strokeWidth="0.4" strokeDasharray="320 2380" opacity="0.1"
        style={{ "--d": "28s", "--dl": "10s" } as React.CSSProperties} />

      {/* ── Mid depth — moderate opacity ── */}
      <path className="gxs gxc" d="M-80 420 C150 350 380 480 620 380 S950 160 1300 220"
        stroke="#08e52f" strokeWidth="0.55" strokeDasharray="190 2510" opacity="0.38"
        style={{ "--d": "15s", "--dl": "3s" } as React.CSSProperties} />
      <path className="gxs gxcr" d="M1350 350 C1080 310 800 440 540 380 S220 250 -100 300"
        stroke="#00b95b" strokeWidth="0.5" strokeDasharray="170 2530" opacity="0.3"
        style={{ "--d": "17s", "--dl": "12s" } as React.CSSProperties} />

      {/* ── Foreground — glowing comet: soft halo layer ── */}
      <path className="gxs gxc" d="M-100 650 C200 580 400 200 700 160 S1050 300 1350 180"
        stroke="#08e52f" strokeWidth="1" strokeDasharray="220 2480" opacity="0.55"
        filter="url(#gx-glow)"
        style={{ "--d": "11s", "--dl": "0s" } as React.CSSProperties} />
      {/* Bright thin core on top — creates 3-D tube effect */}
      <path className="gxs gxc" d="M-100 650 C200 580 400 200 700 160 S1050 300 1350 180"
        stroke="#b0ffcc" strokeWidth="0.35" strokeDasharray="100 2600" opacity="0.95"
        style={{ "--d": "11s", "--dl": "0s" } as React.CSSProperties} />

      {/* ── Reverse foreground comet with glow ── */}
      <path className="gxs gxcr" d="M1400 500 C1100 440 860 620 580 540 S220 350 -120 420"
        stroke="#08e52f" strokeWidth="0.85" strokeDasharray="190 2510" opacity="0.5"
        filter="url(#gx-glow-sm)"
        style={{ "--d": "13s", "--dl": "5s" } as React.CSSProperties} />
      <path className="gxs gxcr" d="M1400 500 C1100 440 860 620 580 540 S220 350 -120 420"
        stroke="#b0ffcc" strokeWidth="0.3" strokeDasharray="85 2615" opacity="0.85"
        style={{ "--d": "13s", "--dl": "5s" } as React.CSSProperties} />

      {/* ── Phase-offset fills — same paths, staggered so something is always moving ── */}
      <path className="gxs gxc" d="M-100 650 C200 580 400 200 700 160 S1050 300 1350 180"
        stroke="#08e52f" strokeWidth="0.45" strokeDasharray="150 2550" opacity="0.4"
        style={{ "--d": "11s", "--dl": "5.5s" } as React.CSSProperties} />
      <path className="gxs gxc" d="M-80 420 C150 350 380 480 620 380 S950 160 1300 220"
        stroke="#00b95b" strokeWidth="0.4" strokeDasharray="130 2570" opacity="0.35"
        style={{ "--d": "15s", "--dl": "9s" } as React.CSSProperties} />

      {/* ── Silver accents — different plane, adds visual layering ── */}
      <path className="gxs gxc" d="M-150 200 C100 260 320 140 580 200 S900 400 1200 300"
        stroke="#c7c8cc" strokeWidth="0.45" strokeDasharray="100 2600" opacity="0.26"
        style={{ "--d": "18s", "--dl": "2s" } as React.CSSProperties} />
      <path className="gxs gxcr" d="M1400 700 C1100 660 850 740 600 680 S280 560 -100 640"
        stroke="#c7c8cc" strokeWidth="0.4" strokeDasharray="85 2615" opacity="0.2"
        style={{ "--d": "20s", "--dl": "7s" } as React.CSSProperties} />
      <path className="gxs gxc" d="M-50 80 C180 130 400 60 650 110 S980 240 1300 150"
        stroke="#c7c8cc" strokeWidth="0.35" strokeDasharray="70 2630" opacity="0.16"
        style={{ "--d": "22s", "--dl": "14s" } as React.CSSProperties} />
      <path className="gxs gxcr" d="M1400 300 C1150 280 900 180 650 220 S300 400 -100 350"
        stroke="#08e52f" strokeWidth="0.35" strokeDasharray="80 2620" opacity="0.2"
        style={{ "--d": "19s", "--dl": "16s" } as React.CSSProperties} />
    </svg>
  );
}
