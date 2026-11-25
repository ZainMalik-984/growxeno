import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";

import { AuthPageHeading, AuthPageLayout } from "@/components/auth/auth-page";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ExpiredLinkResend } from "./expired-link-resend";
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

  /* ── Expired / no session ─────────────────────────────────────────────── */
  if (!user) {
    return (
      <AuthPageLayout
        footer={
          <Link
            href="/login"
            className="text-[var(--gx-muted)] underline-offset-4 transition-colors hover:text-[var(--gx-text)] hover:underline"
          >
            Back to sign in
          </Link>
        }
      >
        <AuthPageHeading
          title="Link expired"
          description="Enter your email and we'll send a fresh link right away."
        />
        <ExpiredLinkResend />
      </AuthPageLayout>
    );
  }

  /* ── Active session — set / reset password ────────────────────────────── */
  const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const firstName = fullName.split(/\s+/)[0] ?? "";

  const title = welcome ? (firstName ? `Welcome, ${firstName}` : "Welcome aboard") : "Set a new password";
  const description = welcome
    ? "Create a password to finish setting up your account."
    : "Choose a new password for your account.";

  return (
    <AuthPageLayout>
      <AuthPageHeading title={title} description={description} />

      {user.email ? (
        <div className="mb-7 flex items-center gap-2.5 rounded-[12px] border border-[var(--gx-line)] bg-[var(--gx-s1)] px-4 py-3">
          <Mail aria-hidden="true" className="size-4 shrink-0 text-[var(--gx-muted)]" />
          <div className="min-w-0">
            <p className="text-xs text-[var(--gx-dim)]">Signing in as</p>
            <p className="truncate text-[13px] font-medium text-[var(--gx-text)]">{user.email}</p>
          </div>
        </div>
      ) : null}

      <ResetPasswordForm submitLabel={welcome ? "Create password" : "Save password"} />
    </AuthPageLayout>
  );
}
