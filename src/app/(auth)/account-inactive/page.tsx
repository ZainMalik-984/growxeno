import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Account inactive" };

/**
 * Shown to a signed-in user whose profile has been deactivated.
 *
 * This route lives OUTSIDE the (app) group deliberately: the app layout calls
 * requireActor(), which redirects inactive users here, so rendering it inside
 * that layout would loop.
 */
export default function AccountInactivePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="text-lg font-medium tracking-[-0.01em] text-ink-strong">Account inactive</h1>
      <p className="mt-2 text-[13px] text-ink-muted">
        This account has been deactivated, so it currently has no access. Your work history is
        preserved. Contact an administrator if this is unexpected.
      </p>
      <form action={signOut} className="mt-6">
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
    </main>
  );
}
