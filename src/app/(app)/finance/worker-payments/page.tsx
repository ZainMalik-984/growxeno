import type { Metadata } from "next";
import { z } from "zod";

import { PageHeader, Section } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/authorize";
import { FINANCE_PAGE_SIZE, listWorkerPayments, MAX_PAGE_SIZE } from "@/lib/finance/queries";
import { listAssignableWorkers } from "@/lib/orders/queries";
import { listAssignableOutsourcedWorkers } from "@/lib/outsourced-workers/queries";
import { WorkerPaymentForm, EditWorkerPaymentButton } from "./worker-payment-form";

export const metadata: Metadata = { title: "Worker Payments" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

const searchParamsSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(FINANCE_PAGE_SIZE),
});

export default async function WorkerPaymentsPage({ searchParams }: PageProps<"/finance/worker-payments">) {
  const actor = await requirePermission("finance.worker_payments.view");
  const raw = await searchParams;
  const params = searchParamsSchema.parse(raw);

  const canManage = actor.permissions.has("finance.worker_payments.manage");

  const [result, workers, outsourcedWorkers] = await Promise.all([
    listWorkerPayments({ page: params.page, pageSize: params.size }),
    listAssignableWorkers(),
    listAssignableOutsourcedWorkers(),
  ]);

  const buildHref = (target: number) => (target > 1 ? `/finance/worker-payments?page=${target}` : "/finance/worker-payments");

  return (
    <>
      <PageHeader
        title="Worker Payments"
        description="A lump sum paid to a worker for everything completed since their last payment — not itemized per task."
        actions={canManage ? <WorkerPaymentForm workers={workers} outsourcedWorkers={outsourcedWorkers} canCreate /> : undefined}
      />

      <Section title="History">
        {result.rows.length === 0 ? (
          <p className="text-[13px] text-ink-faint">No payments recorded yet.</p>
        ) : (
          <>
            <TableWrap>
              <Table>
                <caption className="sr-only">Worker payments</caption>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Worker</TH>
                    <TH className="text-right">Amount</TH>
                    <TH>Reference</TH>
                    {canManage ? <TH /> : null}
                  </TR>
                </THead>
                <TBody>
                  {result.rows.map((row) => (
                    <TR key={row.id}>
                      <TD className="text-ink-muted">{dateFormat.format(row.paymentDate)}</TD>
                      <TD className="font-medium text-ink">{row.workerName}</TD>
                      <TD className="text-right text-ink-muted">
                        {row.amount} {row.currency}
                      </TD>
                      <TD className="text-ink-muted">{row.reference ?? <span className="text-ink-faint">—</span>}</TD>
                      {canManage ? (
                        <TD>
                          <EditWorkerPaymentButton row={row} workers={workers} outsourcedWorkers={outsourcedWorkers} />
                        </TD>
                      ) : null}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
            <Pagination page={result.page} pageCount={result.pageCount} total={result.total} itemLabel="payment" buildHref={buildHref} />
          </>
        )}
      </Section>
    </>
  );
}
