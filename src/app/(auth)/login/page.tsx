import type { Metadata } from "next";

import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { isDatabaseConfigured, isSupabaseConfigured } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

/** Sign-in for employees and external workers, inside the shared brand frame. */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : undefined;
  const linkExpired = params.error === "link-expired";

  const supabaseReady = isSupabaseConfigured();
  const databaseReady = isDatabaseConfigured();

  return (
    <AuthShell>
      <AuthHeading title="Welcome back" description="Sign in to Grow Xeno Business Manager." />
      {linkExpired ? (
        <div role="alert" className="gx-shake -mt-4 mb-6 rounded-[12px] border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-200">
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
        <div className="rounded-[10px] border border-amber-300/30 bg-amber-400/10 p-4">
          <p className="text-[13px] font-medium text-amber-200">This deployment is not configured yet</p>
          <p className="mt-1 text-[13px] text-amber-100/80">Sign-in is unavailable because the following is missing:</p>
          <ul className="mt-2 list-inside list-disc text-[13px] text-amber-100/80">
            {!supabaseReady ? <li>Supabase Auth (NEXT_PUBLIC_SUPABASE_*)</li> : null}
            {!databaseReady ? <li>Database connection (DATABASE_URL)</li> : null}
          </ul>
          <p className="mt-3 text-xs text-amber-200/70">
            See docs/ENVIRONMENT.md for the full list and where each value comes from.
          </p>
        </div>
      )}
    </AuthShell>
  );
}
