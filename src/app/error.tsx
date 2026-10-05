"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

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
    <div className="mx-auto max-w-lg px-6 py-20">
      <h1 className="text-xl font-medium tracking-[-0.01em] text-ink-strong">Something broke</h1>
      <p className="mt-2 text-[13px] text-ink-muted">
        The page could not be loaded. This has been recorded. You can retry, and if it keeps
        happening, send the reference below to an administrator.
      </p>

      {error.digest ? (
        <p className="mt-4 text-[13px] text-ink-muted">
          Reference:{" "}
          <code className="rounded-[3px] bg-canvas-subtle px-1.5 py-0.5 font-mono text-xs text-ink">
            {error.digest}
          </code>
        </p>
      ) : null}

      <div className="mt-6">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
