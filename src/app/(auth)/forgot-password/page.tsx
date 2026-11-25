import type { Metadata } from "next";
import Link from "next/link";

import { AuthPageHeading, AuthPageLayout } from "@/components/auth/auth-page";
import { isDatabaseConfigured, isSupabaseConfigured } from "@/lib/env";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  const ready = isSupabaseConfigured() && isDatabaseConfigured();

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
        title="Reset password"
        description="Enter your email and we'll send a link to set a new password."
      />

      {ready ? (
        <ForgotPasswordForm />
      ) : (
        <p className="text-[13px] text-[var(--gx-muted)]">
          This deployment is not configured yet.
        </p>
      )}
    </AuthPageLayout>
  );
}
