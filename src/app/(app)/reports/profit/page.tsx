import type { Metadata } from "next";

import { PageHeader, Section } from "@/components/ui/page";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAllPermissions } from "@/lib/auth/authorize";
import { formatPeriod, resolveReportRange } from "@/lib/reports/params";
import { getProfitReport } from "@/lib/reports/queries";
import { ClampNotice, money, NoData, ReportRangeBar } from "../report-parts";

export const metadata: Metadata = { title: "Profit report" };

export default async function ProfitReportPage({ searchParams }: PageProps<"/reports/profit">) {
  await requireAllPermissions(["reports.profit", "finance.profit.view"]);
  const { range, bucket, clamped } = resolveReportRange(await searchParams);
  const report = await getProfitReport(range, bucket);

  return (
    <>
      <PageHeader
        title="Profit"
        description="Revenue, outsourced worker cost and expenses per period, each shown separately per currency. A net figure appears only when a period is entirely in one currency — costs in a different currency are never netted against revenue."
      />
      <ReportRangeBar />
      <ClampNotice clamped={clamped} />

      <Section title={`By ${bucket}`}>
        {report.rows.length === 0 ? (
          <NoData what="revenue, cost or expenses" />
        ) : (
          <TableWrap>
            <Table>
              <caption className="sr-only">Profit by {bucket}</caption>
              <THead>
                <TR>
                  <TH>Period</TH>
                  <TH className="text-right">Revenue</TH>
                  <TH className="text-right">Worker cost</TH>
                  <TH className="text-right">Expenses</TH>
                  <TH className="text-right">Net</TH>
                </TR>
              </THead>
              <TBody>
                {report.rows.map((row) => (
                  <TR key={row.period.toISOString()}>
                    <TD className="text-ink-muted">{formatPeriod(row.period, bucket)}</TD>
                    <TD className="text-right text-ink-muted">{money(row.revenue)}</TD>
                    <TD className="text-right text-ink-muted">{money(row.workerCost)}</TD>
                    <TD className="text-right text-ink-muted">{money(row.expenses)}</TD>
                    <TD className="text-right text-ink">{row.net ? money(row.net) : <span className="text-ink-faint">not netted</span>}</TD>
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
