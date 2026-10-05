import type { Metadata } from "next";

import { MetaList, PageHeader, Section } from "@/components/ui/page";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/authorize";
import { ORDER_STATUS_LABELS } from "@/lib/orders/state-machine";
import { formatPeriod, resolveReportRange } from "@/lib/reports/params";
import { getOrdersReport } from "@/lib/reports/queries";
import { Bar, ClampNotice, NoData, ReportRangeBar } from "../report-parts";

export const metadata: Metadata = { title: "Orders report" };

const SOURCE_LABELS: Record<string, string> = { DIRECT: "Direct", WHOLESALE: "Wholesale", MANUAL: "Manual", OTHER: "Other" };

export default async function OrdersReportPage({ searchParams }: PageProps<"/reports/orders">) {
  await requirePermission("reports.orders");
  const { range, bucket, clamped } = resolveReportRange(await searchParams);
  const report = await getOrdersReport(range, bucket);
  const maxCreated = Math.max(0, ...report.createdSeries.map((r) => r.count));

  return (
    <>
      <PageHeader title="Orders" description="Orders created in the range, how they are doing, and how fast they are delivered." />
      <ReportRangeBar />
      <ClampNotice clamped={clamped} />

      <Section title="Summary">
        <MetaList
          items={[
            { label: "Created in range", value: report.createdCount },
            { label: "Delivered in range", value: report.deliveredCount },
            { label: "Average time to deliver", value: report.averageHoursToDeliver === null ? "—" : `${report.averageHoursToDeliver} h` },
            { label: "Delivered on time", value: report.onTimeRate === null ? "—" : `${report.onTimeRate}%` },
            { label: "Overdue right now", value: report.overdueNow },
          ]}
        />
      </Section>

      <Section title={`Created by ${bucket}`}>
        {report.createdSeries.length === 0 ? (
          <NoData what="orders" />
        ) : (
          <TableWrap>
            <Table>
              <caption className="sr-only">Orders created by {bucket}</caption>
              <THead>
                <TR>
                  <TH>Period</TH>
                  <TH className="text-right">Orders</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {report.createdSeries.map((row) => (
                  <TR key={row.period.toISOString()}>
                    <TD className="text-ink-muted">{formatPeriod(row.period, bucket)}</TD>
                    <TD className="text-right text-ink">{row.count}</TD>
                    <TD>
                      <Bar value={row.count} max={maxCreated} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Section>

      <div className="grid gap-x-10 md:grid-cols-2">
        <Section title="By status">
          <ul className="space-y-1.5 text-[13px]">
            {report.byStatus.map((row) => (
              <li key={row.status} className="flex justify-between gap-3">
                <span className="text-ink-muted">{ORDER_STATUS_LABELS[row.status as keyof typeof ORDER_STATUS_LABELS] ?? row.status}</span>
                <span className="text-ink">{row.count}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="By source">
          <ul className="space-y-1.5 text-[13px]">
            {report.bySource.map((row) => (
              <li key={row.source} className="flex justify-between gap-3">
                <span className="text-ink-muted">{SOURCE_LABELS[row.source] ?? row.source}</span>
                <span className="text-ink">{row.count}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}
