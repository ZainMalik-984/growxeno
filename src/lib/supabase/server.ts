import "server-only";

import { cookies } from "next/headers";

import { hardenAuthCookieOptions } from "./cookie-options";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env";

/**
 * Supabase client bound to the current request's cookies.
 *
 * This client carries the SIGNED-IN USER's identity. Use it to read the
 * authenticated session. It is not used to query business tables: those go
 * through Prisma behind server-side authorization (see docs/ARCHITECTURE.md §4).
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, hardenAuthCookieOptions(options, process.env.NODE_ENV === "production"));
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Session refresh is handled by middleware.ts, so ignoring this is
            // safe — see the Supabase SSR guide.
          }
        },
      },
    },
  );
}
