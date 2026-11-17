import Link from "next/link";

import { STATUS_GHOST_CLASS, STATUS_PRIMARY_CLASS, StatusPage } from "@/components/brand/status-page";
import { DASHBOARD_PATH, SITE_HOME } from "@/lib/routing/hosts";

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="Page not found"
      description="That page or record doesn't exist, or you don't have access to it."
      actions={
        <>
          <Link href={DASHBOARD_PATH} className={STATUS_PRIMARY_CLASS}>
            Back to dashboard
          </Link>
          <Link href={SITE_HOME} className={STATUS_GHOST_CLASS}>
            Go to website
          </Link>
        </>
      }
    />
  );
}
