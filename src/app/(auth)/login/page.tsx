import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { isDatabaseConfigured, isSupabaseConfigured } from "@/lib/env";
import { SITE_HOME } from "@/lib/routing/hosts";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : undefined;
  const linkExpired = params.error === "link-expired";
  const passwordSet = params.passwordSet === "1";

  const supabaseReady = isSupabaseConfigured();
  const databaseReady = isDatabaseConfigured();

  return (
    <div className="gxo relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[var(--gx-bg)] px-6 py-10">
      {/* Animated curved line background */}
      <Lines />

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
            <Image src="/brand/gx-symbol-light.svg" alt="" aria-hidden width={1050} height={780} className="h-7 w-auto" priority />
            <span className="gx-display text-base tracking-[-0.03em] text-[var(--gx-text)]">Grow Xeno</span>
          </Link>
        </div>

        {/* Heading */}
        <div className="mb-8">
          <h1 className="gx-display text-[2rem] font-semibold leading-none tracking-[-0.04em] text-[var(--gx-text)]">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-[var(--gx-muted)]">Business Manager</p>
        </div>

        {/* Banners */}
        {passwordSet ? (
          <div
            role="status"
            className="gx-fade mb-6 rounded-[12px] border border-[rgb(8_229_47/0.3)] bg-[rgb(8_229_47/0.07)] px-4 py-3 text-[13px] text-[var(--gx-accent)]"
          >
            Password set — sign in to continue.
          </div>
        ) : null}
        {linkExpired ? (
          <div
            role="alert"
            className="gx-shake mb-6 rounded-[12px] border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-200"
          >
            That link has expired or was already used.{" "}
            <a href="/forgot-password" className="font-medium underline underline-offset-4 hover:text-amber-100">
              Request a new one
            </a>
            .
          </div>
        ) : null}

        {supabaseReady && databaseReady ? (
          <LoginForm next={nextParam} />
        ) : (
          <div className="rounded-[10px] border border-amber-300/30 bg-amber-400/10 p-4 text-[13px]">
            <p className="font-medium text-amber-200">Not configured</p>
            <ul className="mt-2 list-inside list-disc text-amber-100/80">
              {!supabaseReady ? <li>Supabase Auth (NEXT_PUBLIC_SUPABASE_*)</li> : null}
              {!databaseReady ? <li>Database (DATABASE_URL)</li> : null}
            </ul>
          </div>
        )}

        {/* Footer */}
        <p className="mt-10 text-center text-xs text-[var(--gx-dim)]">
          Need help? Contact your coordinator.
        </p>
      </div>
    </div>
  );
}

/** Animated SVG curved streaks spanning the full background. */
function Lines() {
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
          .s { fill: none; stroke-linecap: round; }
          .a { animation: gx-streak var(--d,28s) ease-in-out var(--dl,0s) infinite; }
          .ar { animation: gx-streak-r var(--d,28s) ease-in-out var(--dl,0s) infinite; }
          @media (prefers-reduced-motion: reduce) { .a, .ar { animation: none; opacity: 0.12; } }
        `}</style>
      </defs>

      {/* Green accent streaks */}
      <path className="s a" d="M-100 650 C200 580 400 200 700 160 S1050 300 1350 180"
        stroke="#08e52f" strokeWidth="1.2" strokeDasharray="2400"
        style={{ "--d": "32s", "--dl": "0s" } as React.CSSProperties} />

      <path className="s a" d="M-80 420 C150 350 380 480 620 380 S950 160 1300 220"
        stroke="#08e52f" strokeWidth="0.8" strokeDasharray="2200"
        style={{ "--d": "40s", "--dl": "6s" } as React.CSSProperties} />

      <path className="s ar" d="M1350 500 C1050 440 820 620 560 540 S200 350 -120 420"
        stroke="#00b95b" strokeWidth="1" strokeDasharray="2300"
        style={{ "--d": "36s", "--dl": "3s" } as React.CSSProperties} />

      {/* Dim white/silver streaks for depth */}
      <path className="s a" d="M-150 200 C100 260 320 140 580 200 S900 400 1200 300"
        stroke="#c7c8cc" strokeWidth="0.6" strokeDasharray="2000"
        style={{ "--d": "45s", "--dl": "10s" } as React.CSSProperties} />

      <path className="s ar" d="M1400 700 C1100 660 850 740 600 680 S280 560 -100 640"
        stroke="#c7c8cc" strokeWidth="0.5" strokeDasharray="2100"
        style={{ "--d": "50s", "--dl": "2s" } as React.CSSProperties} />

      <path className="s a" d="M-50 80 C180 130 400 60 650 110 S980 240 1300 150"
        stroke="#08e52f" strokeWidth="0.5" strokeDasharray="1900"
        style={{ "--d": "55s", "--dl": "18s" } as React.CSSProperties} />

      <path className="s ar" d="M1350 350 C1080 310 800 440 540 380 S220 250 -100 300"
        stroke="#00b95b" strokeWidth="0.7" strokeDasharray="2000"
        style={{ "--d": "38s", "--dl": "14s" } as React.CSSProperties} />

      <path className="s a" d="M-200 760 C150 700 380 780 650 720 S980 600 1350 660"
        stroke="#08e52f" strokeWidth="0.4" strokeDasharray="2200"
        style={{ "--d": "60s", "--dl": "8s" } as React.CSSProperties} />
    </svg>
  );
}
