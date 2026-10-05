import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Breadcrumbs, EmptyState, PageHeader, Section } from "@/components/ui/page";
import { StatusDot } from "@/components/ui/status-dot";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/authorize";
import { listOutsourcedWorkers } from "@/lib/outsourced-workers/queries";

export const metadata: Metadata = { title: "Outsourced Workers" };

/**
 * Third-party workers with no application account — a cost-tracking contact
 * for Order Items, not an actor in the system. See
 * `prisma/schema/orders.prisma`'s `OutsourcedWorker` doc comment.
 */
export default async function OutsourcedWorkersPage() {
  const actor = await requirePermission("workers.view.all");
  const workers = await listOutsourcedWorkers({ includeInactive: true });

  return (
    <>
      <Breadcrumbs items={[{ label: "Workforce" }, { label: "Outsourced Workers" }]} />
      <PageHeader
        title="Outsourced Workers"
        description="Third parties who fulfil Order Items, with no application login of their own."
        actions={
          actor.permissions.has("workers.create") ? (
            <Link href="/outsourced-workers/new" className={buttonVariants({ variant: "primary" })}>
              New worker
            </Link>
          ) : undefined
        }
      />

      <Section>
        {workers.length === 0 ? (
          <EmptyState
            title="No outsourced workers yet"
            description="Add one to assign them to an Order Item."
          />
        ) : (
          <TableWrap>
            <Table>
              <caption className="sr-only">Outsourced workers</caption>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Phone</TH>
                  <TH className="text-right">Assigned items</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {workers.map((worker) => (
                  <TR key={worker.id}>
                    <TD>
                      <Link href={`/outsourced-workers/${worker.id}`} className="font-medium text-ink hover:underline">
                        {worker.name}
                      </Link>
                    </TD>
                    <TD className="text-ink-muted">{worker.email ?? <span className="text-ink-faint">—</span>}</TD>
                    <TD className="text-ink-muted">{worker.phone ?? <span className="text-ink-faint">—</span>}</TD>
                    <TD className="text-right text-ink-muted">{worker.assignedItemCount}</TD>
                    <TD>
                      <StatusDot tone={worker.isActive ? "done" : "neutral"} label={worker.isActive ? "Active" : "Inactive"} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Section>
    </>
  );
}
