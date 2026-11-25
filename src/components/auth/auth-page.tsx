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

/** Animated SVG curved streaks — identical to /login. Pure CSS, no JS. */
export function AuthLines() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 1200 800"
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity: 0.45 }}
    >
      <defs>
        <style>{`
          @keyframes gx-streak {
            0%   { stroke-dashoffset: 2400; opacity: 0; }
            8%   { opacity: 1; }
            80%  { opacity: 1; }
            100% { stroke-dashoffset: 0; opacity: 0; }
          }
          @keyframes gx-streak-r {
            0%   { stroke-dashoffset: -2400; opacity: 0; }
            8%   { opacity: 1; }
            80%  { opacity: 1; }
            100% { stroke-dashoffset: 0; opacity: 0; }
          }
          .gxs { fill: none; stroke-linecap: round; }
          .gxa { animation: gx-streak var(--d,28s) ease-in-out var(--dl,0s) infinite; }
          .gxar { animation: gx-streak-r var(--d,28s) ease-in-out var(--dl,0s) infinite; }
          @media (prefers-reduced-motion: reduce) { .gxa, .gxar { animation: none; opacity: 0.12; } }
        `}</style>
      </defs>

      <path className="gxs gxa" d="M-100 650 C200 580 400 200 700 160 S1050 300 1350 180"
        stroke="#08e52f" strokeWidth="1.2" strokeDasharray="2400"
        style={{ "--d": "32s", "--dl": "0s" } as React.CSSProperties} />

      <path className="gxs gxa" d="M-80 420 C150 350 380 480 620 380 S950 160 1300 220"
        stroke="#08e52f" strokeWidth="0.8" strokeDasharray="2200"
        style={{ "--d": "40s", "--dl": "6s" } as React.CSSProperties} />

      <path className="gxs gxar" d="M1350 500 C1050 440 820 620 560 540 S200 350 -120 420"
        stroke="#00b95b" strokeWidth="1" strokeDasharray="2300"
        style={{ "--d": "36s", "--dl": "3s" } as React.CSSProperties} />

      <path className="gxs gxa" d="M-150 200 C100 260 320 140 580 200 S900 400 1200 300"
        stroke="#c7c8cc" strokeWidth="0.6" strokeDasharray="2000"
        style={{ "--d": "45s", "--dl": "10s" } as React.CSSProperties} />

      <path className="gxs gxar" d="M1400 700 C1100 660 850 740 600 680 S280 560 -100 640"
        stroke="#c7c8cc" strokeWidth="0.5" strokeDasharray="2100"
        style={{ "--d": "50s", "--dl": "2s" } as React.CSSProperties} />

      <path className="gxs gxa" d="M-50 80 C180 130 400 60 650 110 S980 240 1300 150"
        stroke="#08e52f" strokeWidth="0.5" strokeDasharray="1900"
        style={{ "--d": "55s", "--dl": "18s" } as React.CSSProperties} />

      <path className="gxs gxar" d="M1350 350 C1080 310 800 440 540 380 S220 250 -100 300"
        stroke="#00b95b" strokeWidth="0.7" strokeDasharray="2000"
        style={{ "--d": "38s", "--dl": "14s" } as React.CSSProperties} />

      <path className="gxs gxa" d="M-200 760 C150 700 380 780 650 720 S980 600 1350 660"
        stroke="#08e52f" strokeWidth="0.4" strokeDasharray="2200"
        style={{ "--d": "60s", "--dl": "8s" } as React.CSSProperties} />
    </svg>
  );
}
