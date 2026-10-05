import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { requireActor } from "@/lib/auth/authorize";

export const metadata: Metadata = { title: "No access" };

/**
 * Shown when an authenticated user reaches something they are not permitted to
 * see. It names the missing permission, because the alternative — a blank page
 * — turns every access question into a support ticket.
 *
 * Naming the permission key is safe: it reveals nothing about the records
 * behind it, only which capability an administrator would need to grant.
 */
export default async function ForbiddenPage({ searchParams }: PageProps<"/forbidden">) {
  await requireActor();
  const params = await searchParams;
  const permission = typeof params.permission === "string" ? params.permission : undefined;

  return (
    <div className="max-w-lg py-10">
      <h1 className="text-xl font-medium tracking-[-0.01em] text-ink-strong">No access</h1>
      <p className="mt-2 text-[13px] text-ink-muted">
        You do not have permission to view this page.
      </p>

      {permission ? (
        <p className="mt-4 text-[13px] text-ink-muted">
          Required permission:{" "}
          <code className="rounded-[3px] bg-canvas-subtle px-1.5 py-0.5 font-mono text-xs text-ink">
            {permission}
          </code>
        </p>
      ) : null}

      <p className="mt-4 text-[13px] text-ink-muted">
        An administrator can grant this from Settings → Users, either by assigning a role that
        includes it or with a direct permission override.
      </p>

      <div className="mt-6">
        <Link href="/dashboard" className={buttonVariants({ variant: "secondary" })}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
