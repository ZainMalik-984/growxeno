import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { AuthLines } from "@/components/auth/auth-page";
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

