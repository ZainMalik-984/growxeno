import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader, Section } from "@/components/ui/page";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/authorize";
import { resolveReportRange } from "@/lib/reports/params";
import { getCustomersReport } from "@/lib/reports/queries";
import { ClampNotice, money, NoData, ReportRangeBar } from "../report-parts";

export const metadata: Metadata = { title: "Customers report" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

export default async function CustomersReportPage({ searchParams }: PageProps<"/reports/customers">) {
  const actor = await requirePermission("reports.customers");
  const { range, clamped } = resolveReportRange(await searchParams);
  const showMoney = actor.permissions.has("finance.revenue.view");
  const rows = await getCustomersReport(range, showMoney);

  return (
    <>
      <PageHeader title="Customers" description="Customers who ordered in the range, and — where you may see it — what those orders were worth." />
      <ReportRangeBar />
      <ClampNotice clamped={clamped} />

      <Section title="By customer" description="Top 100 by orders in the range.">
        {rows.length === 0 ? (
          <NoData what="customer orders" />
        ) : (
          <TableWrap>
            <Table>
              <caption className="sr-only">Customer report</caption>
              <THead>
                <TR>
                  <TH>Customer</TH>
                  <TH className="text-right">Orders</TH>
                  <TH>Last order</TH>
                  {showMoney ? <TH className="text-right">Revenue</TH> : null}
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.customerId}>
                    <TD>
                      <Link href={`/customers/${row.customerId}`} className="text-ink hover:underline">
                        {row.name}
                      </Link>
                    </TD>
                    <TD className="text-right text-ink">{row.orders}</TD>
                    <TD className="text-ink-muted">{row.lastOrderAt ? dateFormat.format(row.lastOrderAt) : "—"}</TD>
                    {showMoney ? <TD className="text-right text-ink-muted">{money(row.revenue)}</TD> : null}
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
