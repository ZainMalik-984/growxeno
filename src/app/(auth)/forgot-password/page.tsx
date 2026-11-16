import type { Metadata } from "next";
import Link from "next/link";

import { AUTH_LINK_CLASS, AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { isDatabaseConfigured, isSupabaseConfigured } from "@/lib/env";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  const ready = isSupabaseConfigured() && isDatabaseConfigured();

  return (
    <AuthShell
      footer={
        <Link href="/login" className={AUTH_LINK_CLASS}>
          Back to sign in
        </Link>
      }
    >
      <AuthHeading
        title="Reset your password"
        description="Enter your email address. If it matches an account, we'll send a link to set a new password."
      />

      {ready ? (
        <ForgotPasswordForm />
      ) : (
        <p className="text-[13px] text-[var(--gx-muted)]">This deployment is not configured yet. See docs/ENVIRONMENT.md.</p>
      )}
    </AuthShell>
  );
}
