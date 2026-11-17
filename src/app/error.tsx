"use client";

import { useEffect } from "react";

import { STATUS_GHOST_CLASS, STATUS_PRIMARY_CLASS, StatusPage } from "@/components/brand/status-page";
import { SITE_HOME } from "@/lib/routing/hosts";

/**
 * Global error boundary.
 *
 * Shows a plain, actionable message. It never renders the stack trace or the
 * error message itself, because those can carry connection strings, table names
 * and other internals (specification Sections 118 and 137). The digest is a
 * server-generated correlation id and is safe to show — it is what an
 * administrator needs to find the full trace in the logs.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No error-reporting service is used; the server log is the record. Logging
    // the digest on the client keeps it discoverable.
    console.error("Unhandled application error", error.digest ?? "(no digest)");
  }, [error]);

  return (
    <StatusPage
      code="500"
      title="Something broke"
      description="The page couldn't be loaded. It has been recorded. Try again, and if it keeps happening, send the reference below to an administrator."
      actions={
        <>
          <button type="button" onClick={reset} className={STATUS_PRIMARY_CLASS}>
            Try again
          </button>
          <a href={SITE_HOME} className={STATUS_GHOST_CLASS}>
            Go to website
          </a>
        </>
      }
    >
      {error.digest ? (
        <p className="mt-5 text-[13px] text-[var(--gx-muted)]">
          Reference:{" "}
          <code className="rounded-[6px] border border-[var(--gx-line)] bg-[var(--gx-s2)] px-2 py-0.5 font-mono text-xs text-[var(--gx-text)]">
            {error.digest}
          </code>
        </p>
      ) : null}
    </StatusPage>
  );
}
