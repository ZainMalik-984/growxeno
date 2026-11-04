import Image from "next/image";
import type { ReactNode } from "react";
import { CalendarDays, ClipboardList, Wallet } from "lucide-react";

import { BrandWordmark } from "@/components/brand/brand-logo";

/**
 * Shared frame for the signed-out pages (sign in, set password, forgot
 * password). On large screens: a dark Grow Xeno brand panel on the left and
 * the page's content in an off-white column on the right. Below `lg` the
 * brand panel is hidden and the wordmark sits above the content.
 */
export function AuthShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-[#f7f8f6] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <BrandPanel />

      {/* Content sits directly on the off-white column — no floating card. */}
      <main className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-[380px]">
          <BrandWordmark className="mb-10 h-11 lg:hidden" />
          {children}
          <div className="mt-8 border-t border-zinc-200/80 pt-6 text-center text-xs leading-relaxed text-ink-faint">
            {footer ?? "Need assistance? Contact your coordinator or supervisor for support."}
          </div>
        </div>
      </main>
    </div>
  );
}

/** Page title + one-line description, sized to match the sign-in page. */
export function AuthHeading({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink-strong">{title}</h1>
      {description ? <p className="mt-1.5 text-sm text-ink-muted">{description}</p> : null}
    </div>
  );
}

/** Field styling for these pages only: hairline border on a near-transparent fill. */
export const AUTH_FIELD_CLASS =
  "h-11 rounded-[8px] border-zinc-200 bg-white/70 px-3.5 text-sm placeholder:text-zinc-400 " +
  "hover:border-zinc-300 focus:border-zinc-400 focus:bg-white focus:ring-4 focus:ring-zinc-900/5";

/** The dark, full-width primary button used on these pages. */
export const AUTH_BUTTON_CLASS =
  "h-auto w-full rounded-[8px] bg-[#0f171b] shadow-none px-4 py-3 text-sm font-semibold tracking-[0.01em] text-white hover:bg-[#1b262c] active:bg-black";

// Seen by employees and external workers, so it names only what they use —
// never admin-only areas such as finance or invoicing.
const HIGHLIGHTS = [
  {
    icon: ClipboardList,
    title: "Tasks & Shifts",
    text: "View your assigned work and tracking from intake to completion.",
  },
  { icon: CalendarDays, title: "Schedules", text: "Keep track of active projects and upcoming timelines." },
  {
    icon: Wallet,
    title: "Payouts",
    text: "Monitor your completed tasks and upcoming payment summaries transparently.",
  },
] as const;

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-[#0f171b] text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      {/* Decorative layers: green glows and a faint grid, all CSS. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 size-[28rem] rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 size-[32rem] rounded-full bg-green-400/15 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        <GrowthLine />
      </div>

      <div className="relative flex items-center gap-3">
        <Image src="/brand/gx-app-icon.svg" alt="" aria-hidden="true" width={44} height={44} className="size-11" priority />
        <div className="leading-tight">
          <p className="text-lg font-semibold tracking-tight">Grow Xeno</p>
          <p className="text-xs text-white/55">Business Manager</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <h2 className="text-4xl font-semibold leading-[1.1] tracking-[-0.03em] xl:text-5xl">
          Your workspace,
          <br />
          <span className="bg-gradient-to-r from-emerald-300 to-green-400 bg-clip-text text-transparent">
            all in one place.
          </span>
        </h2>

        <ul className="mt-10 space-y-5">
          {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-[12px] border border-white/10 bg-white/[0.06] text-emerald-300">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-sm text-white/55">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-white/40">© {new Date().getFullYear()} Grow Xeno</p>
    </aside>
  );
}

/** A soft rising line in the brand green, echoing the logo's arrow. */
function GrowthLine() {
  return (
    <svg
      className="absolute bottom-0 right-0 h-2/3 w-full opacity-60"
      viewBox="0 0 600 400"
      preserveAspectRatio="none"
      fill="none"
    >
      <defs>
        <linearGradient id="gx-line" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#10b981" stopOpacity="0" />
          <stop offset="1" stopColor="#4ade80" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="gx-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#10b981" stopOpacity="0.18" />
          <stop offset="1" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 380 C120 360 180 330 260 280 S400 200 460 140 S560 40 600 20 L600 400 L0 400 Z" fill="url(#gx-fill)" />
      <path d="M0 380 C120 360 180 330 260 280 S400 200 460 140 S560 40 600 20" stroke="url(#gx-line)" strokeWidth="2.5" />
    </svg>
  );
}
