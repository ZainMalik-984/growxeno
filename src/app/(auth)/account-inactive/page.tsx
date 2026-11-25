import type { Metadata } from "next";
import { CircleOff } from "lucide-react";

import { AuthPageLayout } from "@/components/auth/auth-page";
import { AUTH_BUTTON_CLASS } from "@/components/auth/auth-shell";
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
    <AuthPageLayout>
      {/* Icon */}
      <div className="mb-7 grid size-12 place-items-center rounded-[14px] border border-[var(--gx-line)] bg-[var(--gx-s1)] text-[var(--gx-muted)]">
        <CircleOff aria-hidden="true" className="size-5" />
      </div>

      <div className="mb-8">
        <h1 className="gx-display text-[2rem] font-semibold leading-none tracking-[-0.04em] text-[var(--gx-text)]">
          Account inactive
        </h1>
        <p className="mt-2.5 max-w-[36ch] text-[0.875rem] leading-relaxed text-[var(--gx-muted)]">
          This account has been deactivated and no longer has access. Your work history is preserved. Contact an administrator if this is unexpected.
        </p>
      </div>

      <form action={signOut}>
        <button type="submit" className={AUTH_BUTTON_CLASS}>
          Sign out
        </button>
      </form>
    </AuthPageLayout>
  );
}
