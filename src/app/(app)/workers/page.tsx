import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs, EmptyState, PageHeader, Section } from "@/components/ui/page";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/authorize";
import { listWorkers } from "@/lib/workers/queries";

export const metadata: Metadata = { title: "Workers" };

/**
 * The internal worker roster (specification Sections 43–45) — active `User`s
 * in their Worker capacity. Gated by `workers.view.all`: a plain
 * `workers.view` shows a worker only their own profile at `/workers/[id]`,
 * never this list — see `getRosterAccess` there.
 */
export default async function WorkersPage() {
  await requirePermission("workers.view.all");
  const workers = await listWorkers();

  return (
    <>
      <Breadcrumbs items={[{ label: "Workforce" }, { label: "Workers" }]} />
      <PageHeader title="Workers" description="Internal users in their Worker capacity — assignments, categories and activity." />

      <Section>
        {workers.length === 0 ? (
          <EmptyState title="No workers yet" description="Active users appear here once they exist." />
        ) : (
          <TableWrap>
            <Table>
              <caption className="sr-only">Workers</caption>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Roles</TH>
                  <TH className="text-right">Open items</TH>
                </TR>
              </THead>
              <TBody>
                {workers.map((worker) => (
                  <TR key={worker.id}>
                    <TD>
                      <Link href={`/workers/${worker.id}`} className="font-medium text-ink hover:underline">
                        {worker.fullName}
                      </Link>
                    </TD>
                    <TD className="text-ink-muted">{worker.email}</TD>
                    <TD className="text-ink-muted">
                      {worker.roleNames.length > 0 ? worker.roleNames.join(", ") : <span className="text-ink-faint">None</span>}
                    </TD>
                    <TD className="text-right text-ink-muted">{worker.openItemCount}</TD>
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
