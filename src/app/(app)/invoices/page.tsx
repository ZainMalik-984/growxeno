import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page";
import { requirePermission } from "@/lib/auth/authorize";
import { InvoiceBuilder } from "./invoice-builder";

export const metadata: Metadata = { title: "Create Invoice" };

/**
 * Standalone invoice generator: fill in the details, add items, download a
 * PDF. Owner-directed (2026-10-28): no tracking and no database — nothing on
 * this page is read from or written to storage.
 */
export default async function InvoicesPage() {
  await requirePermission("finance.view");

  return (
    <>
      <PageHeader
        title="Create Invoice"
        description="Add the client and line items, check the preview, and download a branded PDF. Nothing is saved."
      />
      <InvoiceBuilder />
    </>
  );
}
