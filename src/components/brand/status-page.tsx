import { ArrowLeft } from "lucide-react";
import { Inter, Inter_Tight } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { SITE_HOME } from "@/lib/routing/hosts";

/**
 * Full-page "not found" / "something broke" frame in the Grow Xeno identity
 * (2026-11-17), matching the sign-in pages: `.gxo` tokens, Inter Tight titles,
 * the green glow and grain. Usable from the client error boundary too, so no
 * server-only imports here.
 */
const bodyFont = Inter({ subsets: ["latin"], variable: "--font-gx-body", display: "swap" });
const displayFont = Inter_Tight({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-gx-display", display: "swap" });

/** The sign-in pages' green pill and outline buttons. */
export const STATUS_PRIMARY_CLASS =
  "gx-sheen inline-flex h-[52px] items-center justify-center rounded-full bg-[var(--gx-accent)] px-7 text-[0.9375rem] font-semibold text-[var(--gx-accent-ink)] " +
  "shadow-[0_12px_34px_-12px_rgb(8_229_47/0.75)] transition-colors hover:bg-[var(--gx-accent-hi)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgb(8_229_47/0.3)]";
export const STATUS_GHOST_CLASS =
  "inline-flex h-[52px] items-center justify-center rounded-full border border-[var(--gx-line-2)] px-7 text-[0.9375rem] font-medium " +
  "text-[var(--gx-text)] transition-colors hover:border-[var(--gx-text)]/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/15";

export function StatusPage({
  code,
  title,
  description,
  children,
  actions,
}: {
  /** Large background figure and eyebrow, e.g. "404". */
  code: string;
  title: string;
  description: ReactNode;
  /** Extra content under the description (an error reference). */
  children?: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className={`gxo ${bodyFont.variable} ${displayFont.variable} relative isolate flex min-h-dvh flex-col overflow-hidden bg-[var(--gx-bg)] px-6 py-7 text-[var(--gx-text)] sm:px-10 lg:px-16`}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="gx-ambient absolute -left-1/4 -top-1/3 h-[80%] w-[80%] rounded-full bg-[radial-gradient(closest-side,rgb(8_229_47/0.10),transparent)]" />
        <div className="absolute -bottom-1/3 -right-1/4 h-[70%] w-[70%] rounded-full bg-[radial-gradient(closest-side,rgb(0_185_91/0.06),transparent)]" />
        <svg viewBox="0 0 640 300" className="gx-trace absolute -bottom-[8%] -right-[3%] w-[min(78vw,880px)]">
          <text
            x="640"
            y="270"
            textAnchor="end"
            className="gx-display"
            fontSize="330"
            letterSpacing="-18"
            fill="none"
            stroke="rgb(199 200 204 / 0.16)"
            strokeWidth="1.2"
          >
            {code}
          </text>
        </svg>
        <div className="gx-grain absolute inset-0" />
      </div>

      <header className="flex items-center justify-between">
        <Link href={SITE_HOME} className="flex items-center gap-2.5 rounded-[6px]" aria-label="Grow Xeno home">
          <Image src="/brand/gx-symbol-light.svg" alt="" aria-hidden="true" width={1050} height={780} className="h-7 w-auto" priority />
          <span className="gx-display text-lg tracking-[-0.03em]">Grow Xeno</span>
        </Link>
        <Link
          href={SITE_HOME}
          className="group inline-flex items-center gap-2 text-[13px] text-[var(--gx-muted)] transition-colors hover:text-[var(--gx-text)]"
        >
          <ArrowLeft aria-hidden="true" className="size-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
          <span className="hidden sm:inline">Back to website</span>
        </Link>
      </header>

      <main className="gx-seq flex w-full max-w-[560px] flex-1 flex-col justify-center py-16">
        <p className="gx-eyebrow flex items-center gap-2.5 text-[var(--gx-accent)]">
          <span aria-hidden="true" className="relative inline-flex size-1.5">
            <span className="gx-ping absolute inset-0 rounded-full bg-[var(--gx-accent)]" />
            <span className="relative size-1.5 rounded-full bg-[var(--gx-accent)]" />
          </span>
          Error {code}
        </p>
        <h1 className="gx-display mt-5 text-[clamp(2.6rem,6vw,4.25rem)] leading-[0.98] tracking-[-0.05em]">{title}</h1>
        <div className="mt-4 max-w-[44ch] text-[0.9375rem] leading-relaxed text-[var(--gx-muted)]">{description}</div>
        {children}
        <div className="gx-stagger mt-9 flex flex-col gap-2.5 sm:flex-row">{actions}</div>
      </main>

      <footer className="text-xs text-[var(--gx-dim)]">© {new Date().getFullYear()} Grow Xeno</footer>
    </div>
  );
}
