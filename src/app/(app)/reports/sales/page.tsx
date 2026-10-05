import type { Metadata } from "next";

import { PageHeader, Section } from "@/components/ui/page";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAllPermissions } from "@/lib/auth/authorize";
import { getSalesReport } from "@/lib/reports/queries";
import { formatPeriod, resolveReportRange } from "@/lib/reports/params";
import { Bar, ClampNotice, money, NoData, ReportRangeBar } from "../report-parts";

export const metadata: Metadata = { title: "Sales report" };

export default async function SalesReportPage({ searchParams }: PageProps<"/reports/sales">) {
  await requireAllPermissions(["reports.sales", "finance.revenue.view"]);
  const { range, bucket, clamped } = resolveReportRange(await searchParams);
  const report = await getSalesReport(range, bucket);

  const maxByCurrency: Record<string, number> = {};
  for (const row of report.series) maxByCurrency[row.currency] = Math.max(maxByCurrency[row.currency] ?? 0, row.amount);

  return (
    <>
      <PageHeader title="Sales" description="Revenue recognized on delivery, excluding refunded orders — per currency, never blended." />
      <ReportRangeBar />
      <ClampNotice clamped={clamped} />

      <Section title="Total">
        <p className="text-[15px] text-ink">{money(report.totalsByCurrency)}</p>
        <p className="mt-1 text-[13px] text-ink-faint">{report.orderCount} order(s)</p>
      </Section>

      <Section title={`By ${bucket}`}>
        {report.series.length === 0 ? (
          <NoData what="delivered orders" />
        ) : (
          <TableWrap>
            <Table>
              <caption className="sr-only">Sales by {bucket}</caption>
              <THead>
                <TR>
                  <TH>Period</TH>
                  <TH className="text-right">Orders</TH>
                  <TH className="text-right">Revenue</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {report.series.map((row) => (
                  <TR key={`${row.period.toISOString()}-${row.currency}`}>
                    <TD className="text-ink-muted">{formatPeriod(row.period, bucket)}</TD>
                    <TD className="text-right text-ink-muted">{row.count}</TD>
                    <TD className="text-right text-ink">
                      {row.amount.toFixed(2)} {row.currency}
                    </TD>
                    <TD>
                      <Bar value={row.amount} max={maxByCurrency[row.currency]} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Section>

      {report.topServices.length > 0 ? (
        <Section
          title="Top services"
          description="By item count — an Order Item carries no price of its own, so its share of the order's total price cannot be attributed accurately."
        >
          <TableWrap>
            <Table>
              <caption className="sr-only">Top services by item count</caption>
              <THead>
                <TR>
                  <TH>Service</TH>
                  <TH className="text-right">Items</TH>
                </TR>
              </THead>
              <TBody>
                {report.topServices.map((s) => (
                  <TR key={s.serviceId}>
                    <TD className="text-ink">{s.name}</TD>
                    <TD className="text-right text-ink-muted">{s.items}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </Section>
      ) : null}
    </>
  );
}
