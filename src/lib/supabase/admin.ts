import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getPublicEnv, getSupabaseAdminEnv } from "@/lib/env";

/**
 * Privileged Supabase client.
 *
 * DANGER: the secret key bypasses Row Level Security and can act on any user.
 * Only import this from server-side administrative services (user provisioning,
 * invitations). Never expose it, log it, or pass anything derived from it to a
 * client component.
 *
 * Sessions are disabled: this client acts as the service, never as a person.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const { NEXT_PUBLIC_SUPABASE_URL } = getPublicEnv();
  const { SUPABASE_SECRET_KEY } = getSupabaseAdminEnv();

  return createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
