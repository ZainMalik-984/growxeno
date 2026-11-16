import type { Metadata } from "next";

import { AUTH_GHOST_CLASS, AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { signOut } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Account inactive" };

/**
 * Shown to a signed-in user whose profile has been deactivated.
 *
 * This route lives OUTSIDE the (app) group deliberately: the app layout calls
 * requireActor(), which redirects inactive users here, so rendering it inside
 * that layout would loop. Uses the shared signed-out frame (2026-11-16).
 */
export default function AccountInactivePage() {
  return (
    <AuthShell>
      <AuthHeading
        title="Account inactive"
        description="This account has been deactivated, so it currently has no access. Your work history is preserved. Contact an administrator if this is unexpected."
      />
      <form action={signOut}>
        <button type="submit" className={AUTH_GHOST_CLASS}>
          Sign out
        </button>
      </form>
    </AuthShell>
  );
}
