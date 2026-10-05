import type { Metadata } from "next";

import { isDatabaseConfigured, isSupabaseConfigured } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : undefined;

  const supabaseReady = isSupabaseConfigured();
  const databaseReady = isDatabaseConfigured();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-16">
      <div className="mb-10">
        <h1 className="text-lg font-medium tracking-[-0.01em] text-ink-strong">Business Manager</h1>
        <p className="mt-1 text-[13px] text-ink-muted">Sign in to continue.</p>
      </div>

      {supabaseReady && databaseReady ? (
        <LoginForm next={nextParam} />
      ) : (
        <div className="border-l-2 border-amber-500 pl-4">
          <p className="text-[13px] font-medium text-ink">This deployment is not configured yet</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            Sign-in is unavailable because the following is missing:
          </p>
          <ul className="mt-2 list-inside list-disc text-[13px] text-ink-muted">
            {!supabaseReady ? <li>Supabase Auth (NEXT_PUBLIC_SUPABASE_*)</li> : null}
            {!databaseReady ? <li>Database connection (DATABASE_URL)</li> : null}
          </ul>
          <p className="mt-3 text-xs text-ink-faint">
            See docs/ENVIRONMENT.md for the full list and where each value comes from.
          </p>
        </div>
      )}

      <p className="mt-10 text-xs text-ink-faint">
        Accounts are created by an administrator inside the application. There is no self-service
        sign-up.
      </p>
    </main>
  );
}
