import type { Metadata } from "next";
import Link from "next/link";

import { isDatabaseConfigured, isSupabaseConfigured } from "@/lib/env";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  const ready = isSupabaseConfigured() && isDatabaseConfigured();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-16">
      <div className="mb-10">
        <h1 className="text-lg font-medium tracking-[-0.01em] text-ink-strong">Reset your password</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          Enter your email address. If it matches an account, we&apos;ll send a link to set a new
          password.
        </p>
      </div>

      {ready ? (
        <ForgotPasswordForm />
      ) : (
        <p className="text-[13px] text-ink-muted">
          This deployment is not configured yet. See docs/ENVIRONMENT.md.
        </p>
      )}

      <p className="mt-10 text-xs text-ink-faint">
        <Link href="/login" className="hover:text-ink-muted hover:underline">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
