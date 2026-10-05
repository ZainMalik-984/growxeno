import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { safeRedirectPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Verifies a Supabase Auth email link (password recovery, invite, or any
 * other OTP-email type) and starts the resulting session.
 *
 * This is a Route Handler, not a Server Component, so it must redirect with
 * `NextResponse.redirect`, not `next/navigation`'s `redirect()` — the latter
 * relies on the React rendering tree catching a thrown signal, which a plain
 * request handler never does.
 *
 * REQUIRES a one-time manual step: the Supabase project's email templates
 * (Confirm signup, Invite user, Reset password) must link here —
 * `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type={{ .Type }}&next={{ .RedirectTo }}`
 * — instead of Supabase's default template. See docs/ACCOUNTS_AND_CREDENTIALS.md.
 * Without that change no email points at this route, though the route itself
 * works as soon as it is reached.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const fallback = type === "recovery" || type === "invite" ? "/auth/reset-password" : "/dashboard";
      return NextResponse.redirect(new URL(safeRedirectPath(searchParams.get("next"), fallback), request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=link-expired", request.url));
}

/** Only a relative, single-slash path is a valid redirect target. */
