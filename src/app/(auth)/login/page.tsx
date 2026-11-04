import type { Metadata } from "next";

import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { isDatabaseConfigured, isSupabaseConfigured } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

/** Sign-in for employees and external workers, inside the shared brand frame. */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : undefined;

  const supabaseReady = isSupabaseConfigured();
  const databaseReady = isDatabaseConfigured();

  return (
    <AuthShell>
      <AuthHeading title="Welcome back" description="Sign in to Grow Xeno Business Manager." />

      {supabaseReady && databaseReady ? (
        <LoginForm next={nextParam} />
      ) : (
        <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-4">
          <p className="text-[13px] font-medium text-amber-900">This deployment is not configured yet</p>
          <p className="mt-1 text-[13px] text-amber-800">Sign-in is unavailable because the following is missing:</p>
          <ul className="mt-2 list-inside list-disc text-[13px] text-amber-800">
            {!supabaseReady ? <li>Supabase Auth (NEXT_PUBLIC_SUPABASE_*)</li> : null}
            {!databaseReady ? <li>Database connection (DATABASE_URL)</li> : null}
          </ul>
          <p className="mt-3 text-xs text-amber-700">
            See docs/ENVIRONMENT.md for the full list and where each value comes from.
          </p>
        </div>
      )}
    </AuthShell>
  );
}
