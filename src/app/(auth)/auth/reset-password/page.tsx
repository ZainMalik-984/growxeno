import type { Metadata } from "next";
import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Set a new password" };

/**
 * Reached only after `/auth/callback` verifies an emailed link and starts a
 * session — this same page finishes both a password reset and a first-time
 * invitation. Landing here with no session means the link was already used or
 * has expired.
 */
export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-16">
      <div className="mb-10">
        <h1 className="text-lg font-medium tracking-[-0.01em] text-ink-strong">Set a new password</h1>
      </div>

      {user ? (
        <ResetPasswordForm />
      ) : (
        <div className="border-l-2 border-amber-500 pl-4">
          <p className="text-[13px] font-medium text-ink">This link has expired or was already used</p>
          <p className="mt-2 text-[13px] text-ink-muted">
            <Link href="/forgot-password" className="text-ink hover:underline">
              Request a new one
            </Link>
            .
          </p>
        </div>
      )}
    </main>
  );
}
