import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { getCurrentActor } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Clears a sign-in whose person no longer exists here (2026-11-16).
 *
 * A valid Supabase cookie for a deleted user used to loop forever: the page
 * found no profile and sent them to /login, and the proxy saw a session on
 * /login and sent them back. `requireActor` sends that case here instead.
 *
 * Only an orphaned session is cleared. With a real profile this does nothing
 * but go to the dashboard, so a link from another site can't sign anyone out.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (await getCurrentActor()) return NextResponse.redirect(new URL("/dashboard", request.url));

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // The user may be gone from Supabase Auth too; the cookies are removed below either way.
  }
  const store = await cookies();
  for (const cookie of store.getAll()) {
    if (cookie.name.startsWith("sb-")) store.delete(cookie.name);
  }
  return NextResponse.redirect(new URL("/login", request.url));
}
