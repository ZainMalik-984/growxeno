import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client for Client Components.
 *
 * Only the publishable key reaches the browser. Every application table has RLS
 * enabled with no permissive policies, so this client cannot read business data
 * even if someone tries — business reads go through the server.
 *
 * The NEXT_PUBLIC_* variables are referenced literally so Next.js inlines them
 * at build time.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. See docs/ENVIRONMENT.md.",
    );
  }

  return createBrowserClient(url, key);
}
