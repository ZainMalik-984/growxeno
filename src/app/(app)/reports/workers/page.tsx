import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader, Section } from "@/components/ui/page";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/authorize";
import { resolveReportRange } from "@/lib/reports/params";
import { getWorkersReport } from "@/lib/reports/queries";
import { ClampNotice, money, NoData, ReportRangeBar } from "../report-parts";

export const metadata: Metadata = { title: "Workers report" };

export default async function WorkersReportPage({ searchParams }: PageProps<"/reports/workers">) {
  const actor = await requirePermission("reports.workers");
  const { range, clamped } = resolveReportRange(await searchParams);
  const showMoney = actor.permissions.has("finance.worker_payments.view");
  const rows = await getWorkersReport(range, showMoney);

  return (
    <>
      <PageHeader
        title="Workers"
        description="Items finished in the range, open work right now, and — where you may see it — earned, paid and outstanding."
      />
      <ReportRangeBar />
      <ClampNotice clamped={clamped} />

      <Section title="By worker">
        {rows.length === 0 ? (
          <NoData what="worker activity" />
        ) : (
          <TableWrap>
            <Table>
              <caption className="sr-only">Worker report</caption>
              <THead>
                <TR>
                  <TH>Worker</TH>
                  <TH className="text-right">Completed</TH>
                  <TH className="text-right">Cancelled</TH>
                  <TH className="text-right">Open now</TH>
                  <TH className="text-right">Overdue now</TH>
                  {showMoney ? (
                    <>
                      <TH className="text-right">Earned</TH>
                      <TH className="text-right">Paid</TH>
                      <TH className="text-right">Outstanding (all time)</TH>
                    </>
                  ) : null}
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.key}>
                    <TD>
                      <Link
                        href={row.kind === "internal" ? `/workers/${row.id}` : `/outsourced-workers/${row.id}`}
                        className="text-ink hover:underline"
                      >
                        {row.name}
                      </Link>
                      {row.kind === "outsourced" ? <span className="text-ink-faint"> · outsourced</span> : null}
                    </TD>
                    <TD className="text-right text-ink">{row.completed}</TD>
                    <TD className="text-right text-ink-muted">{row.cancelled}</TD>
                    <TD className="text-right text-ink-muted">{row.open}</TD>
                    <TD className={`text-right ${row.overdue > 0 ? "text-red-600" : "text-ink-muted"}`}>{row.overdue}</TD>
                    {showMoney ? (
                      <>
                        <TD className="text-right text-ink-muted">{money(row.earned)}</TD>
                        <TD className="text-right text-ink-muted">{money(row.paid)}</TD>
                        <TD className="text-right text-ink">{money(row.outstanding)}</TD>
                      </>
                    ) : null}
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
