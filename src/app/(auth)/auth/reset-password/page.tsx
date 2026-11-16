import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Mail } from "lucide-react";

import { AUTH_BUTTON_CLASS, AUTH_GHOST_CLASS, AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Set your password" };

/**
 * Reached only after `/auth/callback` verifies an emailed link and starts a
 * session — this same page finishes both a password reset and a first-time
 * invitation (`?welcome=1`, added by the callback for invite links). Landing
 * here with no session means the link was already used or has expired.
 */
export default async function ResetPasswordPage({ searchParams }: PageProps<"/auth/reset-password">) {
  const params = await searchParams;
  const welcome = params.welcome === "1";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AuthShell>
        <div>
          <span className="grid size-11 place-items-center rounded-[12px] border border-amber-300/25 bg-amber-400/10 text-amber-300">
            <Clock aria-hidden="true" className="size-5" />
          </span>
          <h1 className="gx-display mt-5 text-[2rem] tracking-[-0.04em] text-[var(--gx-text)]">This link has expired</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--gx-muted)]">
            Links work once and only for a limited time. Request a new one, or ask your coordinator to resend your
            invitation.
          </p>
          <div className="mt-7 flex flex-col gap-2.5">
            <Link href="/forgot-password" className={buttonVariants({ variant: "primary", className: AUTH_BUTTON_CLASS })}>
              Request a new link
            </Link>
            <Link href="/login" className={AUTH_GHOST_CLASS}>
              Back to sign in
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const firstName = fullName.split(/\s+/)[0] ?? "";

  return (
    <AuthShell>
      <AuthHeading
        title={welcome ? (firstName ? `Welcome, ${firstName}` : "Welcome aboard") : "Set a new password"}
        description={
          welcome
            ? "Create a password to finish setting up your account."
            : "Choose a new password for your account."
        }
      />

      {user.email ? (
        <div className="mb-6 flex items-center gap-3 rounded-[12px] border border-[var(--gx-line)] bg-[var(--gx-s1)] px-3.5 py-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[rgb(8_229_47/0.12)] text-[var(--gx-accent)]">
            <Mail aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="gx-eyebrow text-[0.625rem] text-[var(--gx-dim)]">You&apos;ll sign in with</p>
            <p className="mt-0.5 truncate text-sm font-medium text-[var(--gx-text)]">{user.email}</p>
          </div>
        </div>
      ) : null}

      <ResetPasswordForm submitLabel={welcome ? "Create password" : "Save password"} />
    </AuthShell>
  );
}
