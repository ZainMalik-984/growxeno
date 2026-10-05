import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-6 py-20">
      <h1 className="text-xl font-medium tracking-[-0.01em] text-ink-strong">Not found</h1>
      <p className="mt-2 text-[13px] text-ink-muted">
        That page or record does not exist, or you do not have access to it.
      </p>
      <div className="mt-6">
        <Link href="/dashboard" className={buttonVariants({ variant: "secondary" })}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
