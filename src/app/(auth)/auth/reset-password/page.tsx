import type { Metadata } from "next";
import Link from "next/link";

import { AUTH_BUTTON_CLASS, AUTH_GHOST_CLASS, AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
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
        <>
          <AuthHeading
            title="This link has expired"
            description="Links work once and only for a limited time. Request a new one, or ask your coordinator to resend your invitation."
          />
          <div className="gx-stagger flex flex-col gap-2.5">
            <Link href="/forgot-password" className={cn(buttonVariants({ variant: "primary", size: "lg" }), AUTH_BUTTON_CLASS)}>
              Request a new link
            </Link>
            <Link href="/login" className={AUTH_GHOST_CLASS}>
              Back to sign in
            </Link>
          </div>
        </>
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
        <div className="gx-note -mt-4 mb-8 [--gx-note:var(--gx-line-2)]">
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
