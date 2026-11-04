import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Mail } from "lucide-react";

import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
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
        <div className="rounded-[12px] border border-zinc-200/80 bg-white/80 p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-14px_rgba(16,24,40,0.12)]">
          <span className="grid size-10 place-items-center rounded-[10px] bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200/70">
            <Clock aria-hidden="true" className="size-5" />
          </span>
          <h1 className="mt-4 text-lg font-semibold tracking-[-0.01em] text-ink-strong">This link has expired</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Links work once and only for a limited time. Request a new one, or ask your coordinator to resend your
            invitation.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link href="/forgot-password" className={buttonVariants({ variant: "primary", className: "h-10 flex-1 rounded-[8px] bg-[#0f171b] hover:bg-[#1b262c]" })}>
              Request a new link
            </Link>
            <Link href="/login" className={buttonVariants({ variant: "secondary", className: "h-10 flex-1 rounded-[8px]" })}>
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
        <div className="mb-6 flex items-center gap-3 rounded-[10px] border border-zinc-200/80 bg-white/80 px-3.5 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/70">
            <Mail aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">You&apos;ll sign in with</p>
            <p className="truncate text-sm font-medium text-ink-strong">{user.email}</p>
          </div>
        </div>
      ) : null}

      <ResetPasswordForm submitLabel={welcome ? "Create password" : "Save password"} />
    </AuthShell>
  );
}
